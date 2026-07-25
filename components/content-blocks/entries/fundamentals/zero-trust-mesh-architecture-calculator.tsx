'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileKey2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  Route,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RequestScenario = {
  id: string;
  label: string;
  detail: string;
  destination: string;
  destinationNamespace: string;
  method: string;
  resource: string;
  context: string;
};

type WorkloadIdentity = {
  id: string;
  label: string;
  detail: string;
  principal: string;
  issuer: string;
  trusted: boolean;
  valid: boolean;
};

type PolicyRule = {
  principal: string;
  destination: string;
  method: string;
  resource: string;
  context: string;
};

type PolicyProfile = {
  id: string;
  label: string;
  detail: string;
  mode: 'transport-only' | 'namespace' | 'exact';
  namespace?: string;
  rules: PolicyRule[];
};

type AuthorizationModel = {
  title: string;
  description: string;
  trustedIssuer: string;
  defaults: {
    requestId: string;
    identityId: string;
    policyId: string;
  };
  requests: RequestScenario[];
  identities: WorkloadIdentity[];
  policies: PolicyProfile[];
};

type Decision = {
  authenticated: boolean;
  requestAllowed: boolean;
  authorizationChecked: boolean;
  exactRule: boolean;
  status: string;
  reason: string;
  decisiveGate: string;
  policyRisk: string;
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/zero-trust-mesh-architecture/data/authorization-decision-model.json';

function isAuthorizationModel(value: unknown): value is AuthorizationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthorizationModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.trustedIssuer
      && candidate.defaults?.requestId
      && candidate.defaults.identityId
      && candidate.defaults.policyId
      && Array.isArray(candidate.requests)
      && candidate.requests.length >= 3
      && candidate.requests.every((request) => (
        typeof request.id === 'string'
        && typeof request.label === 'string'
        && typeof request.detail === 'string'
        && typeof request.destination === 'string'
        && typeof request.destinationNamespace === 'string'
        && typeof request.method === 'string'
        && typeof request.resource === 'string'
        && typeof request.context === 'string'
      ))
      && Array.isArray(candidate.identities)
      && candidate.identities.length >= 3
      && candidate.identities.every((identity) => (
        typeof identity.id === 'string'
        && typeof identity.label === 'string'
        && typeof identity.detail === 'string'
        && typeof identity.principal === 'string'
        && typeof identity.issuer === 'string'
        && typeof identity.trusted === 'boolean'
        && typeof identity.valid === 'boolean'
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 3
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && ['transport-only', 'namespace', 'exact'].includes(policy.mode)
        && Array.isArray(policy.rules)
      )),
  );
}

function evaluateDecision(
  request: RequestScenario,
  identity: WorkloadIdentity,
  policy: PolicyProfile,
  trustedIssuer: string,
): Decision {
  const authenticated = identity.trusted
    && identity.valid
    && identity.issuer === trustedIssuer;

  if (!authenticated) {
    const reason = !identity.valid
      ? 'The workload credential is expired, so the mTLS identity cannot be accepted.'
      : 'The credential chains to an issuer outside this trust domain.';
    return {
      authenticated: false,
      requestAllowed: false,
      authorizationChecked: false,
      exactRule: false,
      status: 'Deny before policy',
      reason,
      decisiveGate: 'Workload identity',
      policyRisk: 'No request reaches the service',
    };
  }

  if (policy.mode === 'transport-only') {
    return {
      authenticated: true,
      requestAllowed: true,
      authorizationChecked: false,
      exactRule: false,
      status: 'Allowed without authorization',
      reason: 'mTLS proves which workload connected, but this profile never asks whether that principal may perform this action.',
      decisiveGate: 'No business-policy gate',
      policyRisk: 'Authenticated callers receive broad access',
    };
  }

  if (policy.mode === 'namespace') {
    const sourceInNamespace = identity.principal.includes(`/ns/${policy.namespace}/`);
    const destinationInNamespace = request.destinationNamespace === policy.namespace;
    const authorized = sourceInNamespace && destinationInNamespace;
    return {
      authenticated: true,
      requestAllowed: authorized,
      authorizationChecked: true,
      exactRule: false,
      status: authorized ? 'Allowed by namespace' : 'Denied by namespace',
      reason: authorized
        ? `Both workloads are in ${policy.namespace}, so this broad rule permits every method and resource on the destination.`
        : 'The source and destination do not both match the permitted namespace.',
      decisiveGate: 'Namespace membership',
      policyRisk: authorized
        ? 'Method and resource remain unconstrained'
        : 'The broad boundary still blocks this path',
    };
  }

  const exactRule = policy.rules.some((rule) => (
    rule.principal === identity.principal
      && rule.destination === request.destination
      && rule.method === request.method
      && rule.resource === request.resource
      && rule.context === request.context
  ));

  return {
    authenticated: true,
    requestAllowed: exactRule,
    authorizationChecked: true,
    exactRule,
    status: exactRule ? 'Allowed by exact rule' : 'Denied by default',
    reason: exactRule
      ? 'Principal, destination, method, resource, and context all match one explicit allow rule.'
      : 'No explicit allow rule matches every attribute, so default deny applies.',
    decisiveGate: 'Request authorization',
    policyRisk: exactRule ? 'Least-privilege match' : 'No privilege is inferred',
  };
}

export default function ZeroTrustMeshArchitectureCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AuthorizationModel | null>(null);
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
        if (!isAuthorizationModel(payload)) {
          throw new Error('The authorization decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the authorization decision model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Authorization decision lab"
          title="Load identities, requests, and policy profiles"
          description="The lesson-owned decision model is loading."
          icon={Fingerprint}
          accent="blue"
        />
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      </LearningLab>
    );
  }

  return <AuthorizationLab model={model} />;
}

function AuthorizationLab({ model }: { model: AuthorizationModel }) {
  const [requestId, setRequestId] = useState(model.defaults.requestId);
  const [identityId, setIdentityId] = useState(model.defaults.identityId);
  const [policyId, setPolicyId] = useState(model.defaults.policyId);

  const request = model.requests.find((item) => item.id === requestId) ?? model.requests[0];
  const identity = model.identities.find((item) => item.id === identityId) ?? model.identities[0];
  const policy = model.policies.find((item) => item.id === policyId) ?? model.policies[0];
  const decision = useMemo(
    () => evaluateDecision(request, identity, policy, model.trustedIssuer),
    [identity, model.trustedIssuer, policy, request],
  );

  function reset() {
    setRequestId(model.defaults.requestId);
    setIdentityId(model.defaults.identityId);
    setPolicyId(model.defaults.policyId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Authorization decision lab"
        title={model.title}
        description={model.description}
        icon={Fingerprint}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Requested action
              </legend>
              <div className="mt-3 space-y-2">
                {model.requests.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === request.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Route}
                    accent="blue"
                    onClick={() => setRequestId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Presented identity
              </legend>
              <div className="mt-3 space-y-2">
                {model.identities.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === identity.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.valid && item.trusted ? BadgeCheck : FileKey2}
                    accent={item.valid && item.trusted ? 'emerald' : 'rose'}
                    onClick={() => setIdentityId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Enforcement profile
              </legend>
              <div className="mt-3 space-y-2">
                {model.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.mode === 'exact' ? ShieldCheck : Network}
                    accent={item.mode === 'exact' ? 'violet' : item.mode === 'namespace' ? 'amber' : 'rose'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-5" aria-live="polite">
          <DecisionBanner decision={decision} />

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Identity"
              value={decision.authenticated ? 'Authenticated' : 'Rejected'}
              detail={identity.principal}
              icon={decision.authenticated ? KeyRound : CircleX}
              tone={decision.authenticated ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Authorization"
              value={
                !decision.authorizationChecked
                  ? decision.authenticated ? 'Bypassed' : 'Not reached'
                  : decision.requestAllowed ? 'Allow' : 'Deny'
              }
              detail={decision.decisiveGate}
              icon={decision.requestAllowed ? CheckCircle2 : LockKeyhole}
              tone={
                !decision.authorizationChecked
                  ? 'amber'
                  : decision.requestAllowed ? (decision.exactRule ? 'violet' : 'amber') : 'rose'
              }
            />
            <LabMetric
              label="Privilege shape"
              value={decision.exactRule ? 'Exact' : policy.mode === 'namespace' ? 'Broad' : 'Missing'}
              detail={decision.policyRisk}
              icon={UserRoundCog}
              tone={decision.exactRule ? 'emerald' : 'amber'}
            />
          </div>

          <DecisionPath
            authenticated={decision.authenticated}
            requestAllowed={decision.requestAllowed}
            authorizationChecked={decision.authorizationChecked}
            request={request}
            identity={identity}
          />

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evaluated request tuple
            </p>
            <dl className="mt-3 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Principal" value={identity.principal} />
              <Detail label="Destination" value={request.destination} />
              <Detail label="Operation" value={`${request.method} ${request.resource}`} />
              <Detail label="Context" value={request.context} />
            </dl>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionBanner({ decision }: { decision: Decision }) {
  const secureAllow = decision.requestAllowed && decision.exactRule;
  const riskyAllow = decision.requestAllowed && !decision.exactRule;
  const Icon = secureAllow ? ShieldCheck : riskyAllow ? CircleAlert : LockKeyhole;
  const styles = secureAllow
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : riskyAllow
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';

  return (
    <section className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">Observed decision</p>
          <h4 className="mt-1 text-xl font-semibold">{decision.status}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{decision.reason}</p>
        </div>
      </div>
    </section>
  );
}

function DecisionPath({
  authenticated,
  requestAllowed,
  authorizationChecked,
  request,
  identity,
}: {
  authenticated: boolean;
  requestAllowed: boolean;
  authorizationChecked: boolean;
  request: RequestScenario;
  identity: WorkloadIdentity;
}) {
  const stages = [
    {
      label: 'Caller',
      detail: identity.label,
      status: 'passed',
      icon: Activity,
    },
    {
      label: 'mTLS identity',
      detail: authenticated ? 'Credential accepted' : 'Handshake rejected',
      status: authenticated ? 'passed' : 'blocked',
      icon: Fingerprint,
    },
    {
      label: 'Policy gate',
      detail: !authenticated
        ? 'Not reached'
        : !authorizationChecked
          ? 'Authorization bypassed'
          : requestAllowed ? 'Request allowed' : 'Request denied',
      status: !authenticated
        ? 'idle'
        : !authorizationChecked ? 'warning' : requestAllowed ? 'passed' : 'blocked',
      icon: ShieldCheck,
    },
    {
      label: request.destination,
      detail: requestAllowed ? `${request.method} reaches handler` : 'Handler not invoked',
      status: requestAllowed ? 'passed' : 'idle',
      icon: Network,
    },
  ];

  return (
    <section>
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Enforcement path
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const styles = stage.status === 'passed'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
            : stage.status === 'blocked'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              : stage.status === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-400 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
              : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400';
          return (
            <article key={stage.label} className={`relative min-w-0 rounded-md border p-4 ${styles}`}>
              <div className="flex items-center justify-between gap-2">
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="text-[11px] font-semibold uppercase opacity-60">
                  {index + 1}
                </span>
              </div>
              <h5 className="mt-3 text-sm font-semibold">{stage.label}</h5>
              <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-xs leading-5 text-neutral-800 dark:text-neutral-200">
        {value}
      </dd>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        {error ? (
          <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
        ) : (
          <Activity
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-blue-500 motion-reduce:animate-none"
          />
        )}
        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
          {error ? 'Authorization data could not be loaded' : 'Loading authorization decisions...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
