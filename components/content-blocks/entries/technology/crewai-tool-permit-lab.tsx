'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Bot,
  CheckCircle2,
  CircleAlert,
  Download,
  Gauge,
  KeyRound,
  LoaderCircle,
  Mail,
  Receipt,
  Repeat2,
  Search,
  Server,
  ShieldCheck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Identity = 'model' | 'caller' | 'service';
type Scope = 'global' | 'tenant' | 'resource';
type Effect = 'read' | 'write';
type StageStatus = 'complete' | 'protected' | 'exposed' | 'blocked';

type Operation = {
  id: string;
  label: string;
  detail: string;
  effect: Effect;
  requiredIdentity: Exclude<Identity, 'model'>;
  requiredScope: Scope;
  requiresApproval: boolean;
  requiresIdempotency: boolean;
  ambiguousOutcome: boolean;
  safeResult: string;
  unsafeResult: string;
};

type ToolPermitData = {
  title: string;
  description: string;
  defaults: {
    operationId: string;
    identity: Identity;
    scope: Scope;
    approval: boolean;
    idempotency: boolean;
    reconcile: boolean;
    retries: number;
  };
  stages: string[];
  operations: Operation[];
};

const BLOCK_ID = 'technology/crewai-tool-permit-lab';
const identities: Identity[] = ['model', 'caller', 'service'];
const scopes: Scope[] = ['global', 'tenant', 'resource'];
const effects: Effect[] = ['read', 'write'];

const identityLabels: Record<Identity, string> = {
  model: 'Model-provided identity',
  caller: 'Authenticated caller',
  service: 'Service principal',
};

const identityDetails: Record<Identity, string> = {
  model: 'The prompt or tool arguments claim who is acting.',
  caller: 'The application injects the signed-in user and tenant.',
  service: 'A workload identity acts for a scheduled automation.',
};

const scopeLabels: Record<Scope, string> = {
  global: 'Global',
  tenant: 'One tenant',
  resource: 'One resource',
};

const scopeRank: Record<Scope, number> = {
  global: 0,
  tenant: 1,
  resource: 2,
};

const operationIcons: Record<string, LucideIcon> = {
  'policy-search': Search,
  'refund-payment': Receipt,
  'send-digest': Mail,
  'customer-export': Download,
};

const identityIcons: Record<Identity, LucideIcon> = {
  model: Bot,
  caller: UserCheck,
  service: Server,
};

function isIdentity(value: unknown): value is Identity {
  return identities.includes(value as Identity);
}

function isScope(value: unknown): value is Scope {
  return scopes.includes(value as Scope);
}

function isEffect(value: unknown): value is Effect {
  return effects.includes(value as Effect);
}

function isToolPermitData(value: unknown): value is ToolPermitData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ToolPermitData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.operationId
      && isIdentity(candidate.defaults.identity)
      && isScope(candidate.defaults.scope)
      && typeof candidate.defaults.approval === 'boolean'
      && typeof candidate.defaults.idempotency === 'boolean'
      && typeof candidate.defaults.reconcile === 'boolean'
      && Number.isInteger(candidate.defaults.retries)
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 5
      && candidate.stages.every((stage) => typeof stage === 'string')
      && Array.isArray(candidate.operations)
      && candidate.operations.length > 0
      && candidate.operations.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isEffect(item.effect)
        && (item.requiredIdentity === 'caller' || item.requiredIdentity === 'service')
        && isScope(item.requiredScope)
        && typeof item.requiresApproval === 'boolean'
        && typeof item.requiresIdempotency === 'boolean'
        && typeof item.ambiguousOutcome === 'boolean'
        && typeof item.safeResult === 'string'
        && typeof item.unsafeResult === 'string'
      )),
  );
}

export default function CrewAIToolPermitLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ToolPermitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No tool-permit model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isToolPermitData(payload)) throw new Error('The tool-permit model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }

  return <PermitBuilder data={data} />;
}

function PermitBuilder({ data }: { data: ToolPermitData }) {
  const [operationId, setOperationId] = useState(data.defaults.operationId);
  const [identity, setIdentity] = useState<Identity>(data.defaults.identity);
  const [scope, setScope] = useState<Scope>(data.defaults.scope);
  const [approval, setApproval] = useState(data.defaults.approval);
  const [idempotency, setIdempotency] = useState(data.defaults.idempotency);
  const [reconcile, setReconcile] = useState(data.defaults.reconcile);
  const [retries, setRetries] = useState(data.defaults.retries);

  const operation = data.operations.find((item) => item.id === operationId) ?? data.operations[0];

  const result = useMemo(() => {
    const identityFits = identity === operation.requiredIdentity;
    const scopeFits = scopeRank[scope] >= scopeRank[operation.requiredScope];
    const approvalFits = !operation.requiresApproval || approval;
    const idempotencyFits = !operation.requiresIdempotency || idempotency;
    const reconcileFits = !operation.ambiguousOutcome || retries === 0 || reconcile;
    const authorizationFits = identityFits && scopeFits;
    const safe = authorizationFits && approvalFits && idempotencyFits && reconcileFits;
    const missing = [
      !identityFits ? identityLabels[operation.requiredIdentity] : null,
      !scopeFits ? `${scopeLabels[operation.requiredScope]} scope` : null,
      !approvalFits ? 'Trusted approval' : null,
      !idempotencyFits ? 'Idempotency key' : null,
      !reconcileFits ? 'Outcome reconciliation' : null,
    ].filter((item): item is string => Boolean(item));
    const possibleEffects = operation.effect === 'write'
      ? idempotency ? 1 : retries + 1
      : 0;
    const posture = safe
      ? 'Permit ready'
      : !authorizationFits || !approvalFits
        ? 'Permit denied'
        : 'Unsafe retry path';

    const statuses: StageStatus[] = [
      'complete',
      authorizationFits ? 'protected' : 'exposed',
      !authorizationFits
        ? 'blocked'
        : operation.requiresApproval
          ? approval ? 'protected' : 'exposed'
          : 'complete',
      !authorizationFits || !approvalFits
        ? 'blocked'
        : operation.requiresIdempotency
          ? idempotency ? 'protected' : 'exposed'
          : 'complete',
      !authorizationFits || !approvalFits || !idempotencyFits
        ? 'blocked'
        : operation.ambiguousOutcome && retries > 0
          ? reconcile ? 'protected' : 'exposed'
          : 'complete',
    ];

    return {
      approvalFits,
      authorizationFits,
      idempotencyFits,
      identityFits,
      missing,
      possibleEffects,
      posture,
      reconcileFits,
      safe,
      scopeFits,
      statuses,
    };
  }, [approval, idempotency, identity, operation, reconcile, retries, scope]);

  function reset() {
    setOperationId(data.defaults.operationId);
    setIdentity(data.defaults.identity);
    setScope(data.defaults.scope);
    setApproval(data.defaults.approval);
    setIdempotency(data.defaults.idempotency);
    setReconcile(data.defaults.reconcile);
    setRetries(data.defaults.retries);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Tool permit builder"
          title={data.title}
          description={data.description}
          icon={KeyRound}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Proposed operation
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.operations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === operation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={operationIcons[item.id] ?? KeyRound}
                      accent={item.effect === 'write' ? 'amber' : 'blue'}
                      onClick={() => setOperationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution identity
                </legend>
                <div className="mt-3 grid gap-2">
                  {identities.map((item) => (
                    <LabChoice
                      key={item}
                      selected={identity === item}
                      label={identityLabels[item]}
                      detail={identityDetails[item]}
                      icon={identityIcons[item]}
                      accent={item === 'model' ? 'rose' : item === 'caller' ? 'blue' : 'violet'}
                      onClick={() => setIdentity(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Maximum resource scope
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {scopes.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={scope === item}
                      onClick={() => setScope(item)}
                      className={`min-h-16 rounded-md border px-2 py-3 text-center text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${scope === item ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-700 dark:bg-amber-950/45 dark:text-amber-50' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
                    >
                      {scopeLabels[item]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Side-effect controls
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <LabChoice
                    selected={approval}
                    label="Approval"
                    detail={approval ? 'A trusted reviewer released this operation.' : 'No reviewer release is attached.'}
                    icon={UserCheck}
                    accent="emerald"
                    onClick={() => setApproval((value) => !value)}
                  />
                  <LabChoice
                    selected={idempotency}
                    label="Idempotency"
                    detail={idempotency ? 'Repeated attempts share one operation identity.' : 'Each attempt can create a new effect.'}
                    icon={Repeat2}
                    accent="blue"
                    onClick={() => setIdempotency((value) => !value)}
                  />
                  <LabChoice
                    selected={reconcile}
                    label="Reconciliation"
                    detail={reconcile ? 'Check the authoritative outcome before retrying.' : 'Retry without checking the first attempt.'}
                    icon={ShieldCheck}
                    accent="violet"
                    onClick={() => setReconcile((value) => !value)}
                  />
                </div>
              </fieldset>

              <LabRange
                label="Automatic retries"
                value={retries}
                output={`${retries}`}
                min={0}
                max={3}
                step={1}
                accent="amber"
                lowLabel="Stop and inspect"
                highLabel="Three retries"
                onChange={setRetries}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Policy posture"
                value={result.posture}
                detail={result.safe ? 'Every required boundary is present.' : 'This proposal must not execute as configured.'}
                icon={result.safe ? CheckCircle2 : Ban}
                tone={result.safe ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Missing controls"
                value={`${result.missing.length}`}
                detail={result.missing.length ? result.missing.join(', ') : 'No required control is missing'}
                icon={ShieldCheck}
                tone={result.missing.length ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Tool attempts"
                value={`${retries + 1}`}
                detail="One initial attempt plus configured automatic retries."
                icon={Repeat2}
                tone={retries > 1 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Possible side effects"
                value={operation.effect === 'write' ? `${result.possibleEffects}` : '0'}
                detail={operation.effect === 'write' ? 'Without deduplication, each write attempt may commit.' : 'This operation is read-only.'}
                icon={Gauge}
                tone={result.possibleEffects > 1 ? 'rose' : result.possibleEffects === 1 ? 'blue' : 'neutral'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="grid border-b border-neutral-200 md:grid-cols-[minmax(0,1fr)_auto] dark:border-neutral-800">
                <div className="min-w-0 p-4">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Proposed permit</p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{operation.label}</h4>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Principal</dt>
                      <dd className="mt-1 font-semibold text-neutral-900 dark:text-white">{identityLabels[identity]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Scope</dt>
                      <dd className="mt-1 font-semibold text-neutral-900 dark:text-white">{scopeLabels[scope]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Effect</dt>
                      <dd className="mt-1 font-semibold capitalize text-neutral-900 dark:text-white">{operation.effect}</dd>
                    </div>
                  </dl>
                </div>
                <div className={`flex min-h-24 min-w-44 items-center justify-center border-t px-5 py-4 md:border-l md:border-t-0 ${result.safe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'}`}>
                  <div className="text-center">
                    {result.safe
                      ? <CheckCircle2 aria-hidden="true" className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" />
                      : <XCircle aria-hidden="true" className="mx-auto h-7 w-7 text-rose-700 dark:text-rose-300" />}
                    <p className="mt-2 text-sm font-bold uppercase tracking-wide text-neutral-950 dark:text-white">
                      {result.safe ? 'Ready' : 'Denied'}
                    </p>
                  </div>
                </div>
              </div>

              <ol className="grid gap-2 p-4 sm:grid-cols-5">
                {data.stages.map((stage, index) => {
                  const status = result.statuses[index];
                  const styles = stageStyles[status];
                  const Icon = status === 'complete'
                    ? CheckCircle2
                    : status === 'protected'
                      ? ShieldCheck
                      : status === 'exposed'
                        ? CircleAlert
                        : XCircle;
                  return (
                    <li key={stage} className={`min-w-0 rounded-md border p-3 ${styles.container}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${styles.badge}`}>
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${styles.icon}`} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{stage}</p>
                      <p className="mt-1 text-xs capitalize text-neutral-600 dark:text-neutral-300">{status}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required permit
                </p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-200">
                  <PermitCheck ok={result.identityFits} label={identityLabels[operation.requiredIdentity]} />
                  <PermitCheck ok={result.scopeFits} label={`${scopeLabels[operation.requiredScope]} scope or narrower`} />
                  {operation.requiresApproval ? <PermitCheck ok={result.approvalFits} label="Trusted approval" /> : null}
                  {operation.requiresIdempotency ? <PermitCheck ok={result.idempotencyFits} label="Idempotency key" /> : null}
                  {operation.ambiguousOutcome && retries > 0 ? <PermitCheck ok={result.reconcileFits} label="Outcome reconciliation" /> : null}
                </ul>
              </section>

              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Retry interpretation
                </p>
                <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
                  {retries === 0 ? 'No automatic retry' : `${retries} automatic ${retries === 1 ? 'retry' : 'retries'}`}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {operation.effect === 'read'
                    ? 'Reads still need budgets and authorization, but they do not create the modeled business side effect.'
                    : idempotency && (!operation.ambiguousOutcome || reconcile)
                      ? 'Repeated attempts resolve to one operation identity, and ambiguous outcomes are checked first.'
                      : 'A timeout can hide a committed write. Retrying now can repeat the side effect.'}
                </p>
              </section>
            </div>

            <div className={`rounded-md border p-4 ${result.safe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
              <div className="flex items-start gap-3">
                {result.safe
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Observed consequence</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.safe ? operation.safeResult : operation.unsafeResult}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PermitCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
      <span>{label}</span>
    </li>
  );
}

const stageStyles: Record<StageStatus, { container: string; badge: string; icon: string }> = {
  complete: {
    container: 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950',
    badge: 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  protected: {
    container: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    badge: 'bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  exposed: {
    container: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    badge: 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950',
    icon: 'text-rose-700 dark:text-rose-300',
  },
  blocked: {
    container: 'border-neutral-200 bg-neutral-100 opacity-70 dark:border-neutral-800 dark:bg-neutral-900',
    badge: 'bg-neutral-400 text-white dark:bg-neutral-700',
    icon: 'text-neutral-500 dark:text-neutral-400',
  },
};

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Tool permit builder"
          title="Loading the tool policy"
          description="The lab is reading operation and permit contracts."
          icon={KeyRound}
          accent="amber"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Unable to load the lab</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                Loading tool permits
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
