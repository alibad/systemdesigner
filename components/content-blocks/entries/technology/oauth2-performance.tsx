'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  Code2,
  KeyRound,
  Laptop,
  LockKeyhole,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/oauth2-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/oauth2/data/client-grant-policy.json';

type ClientProfile = {
  id: string;
  label: string;
  detail: string;
  clientType: 'public' | 'confidential';
  userPresent: boolean;
  allowedGrants: string[];
  allowedStorage: string[];
  requirements: string[];
  refreshGuidance: string;
};

type GrantOption = {
  id: string;
  label: string;
  detail: string;
  userRequired: boolean;
  deprecated: boolean;
};

type StorageOption = {
  id: string;
  label: string;
  detail: string;
};

type ClientGrantPolicy = {
  title: string;
  description: string;
  defaults: {
    clientId: string;
    grantId: string;
    storageId: string;
  };
  clients: ClientProfile[];
  grants: GrantOption[];
  storage: StorageOption[];
};

function isClientGrantPolicy(value: unknown): value is ClientGrantPolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ClientGrantPolicy>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.clientId
      && candidate.defaults.grantId
      && candidate.defaults.storageId
      && Array.isArray(candidate.clients)
      && candidate.clients.length === 4
      && candidate.clients.every((client) => (
        typeof client.id === 'string'
        && typeof client.label === 'string'
        && typeof client.detail === 'string'
        && (client.clientType === 'public' || client.clientType === 'confidential')
        && typeof client.userPresent === 'boolean'
        && Array.isArray(client.allowedGrants)
        && Array.isArray(client.allowedStorage)
        && Array.isArray(client.requirements)
        && typeof client.refreshGuidance === 'string'
      ))
      && Array.isArray(candidate.grants)
      && candidate.grants.length >= 4
      && candidate.grants.every((grant) => (
        typeof grant.id === 'string'
        && typeof grant.label === 'string'
        && typeof grant.detail === 'string'
        && typeof grant.userRequired === 'boolean'
        && typeof grant.deprecated === 'boolean'
      ))
      && Array.isArray(candidate.storage)
      && candidate.storage.length >= 5
      && candidate.storage.every((storage) => (
        typeof storage.id === 'string'
        && typeof storage.label === 'string'
        && typeof storage.detail === 'string'
      )),
  );
}

function clientIcon(id: string) {
  if (id === 'server-web') return Server;
  if (id === 'spa') return Code2;
  if (id === 'native') return MonitorSmartphone;
  if (id === 'machine') return Bot;
  return Laptop;
}

export default function OAuth2ClientGrantLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [policy, setPolicy] = useState<ClientGrantPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPolicy(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isClientGrantPolicy(payload)) {
          throw new Error('The client and grant policy is incomplete.');
        }
        setPolicy(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load OAuth policy.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!policy ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Client and grant lab"
            title="Load the OAuth decision model"
            description="The lesson-owned client boundaries and grant constraints are loading."
            icon={KeyRound}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ClientGrantLab policy={policy} />
      )}
    </div>
  );
}

function ClientGrantLab({ policy }: { policy: ClientGrantPolicy }) {
  const initialClient = policy.clients.find(
    (item) => item.id === policy.defaults.clientId,
  ) ?? policy.clients[0];
  const [clientId, setClientId] = useState(initialClient.id);
  const [grantId, setGrantId] = useState(policy.defaults.grantId);
  const [storageId, setStorageId] = useState(policy.defaults.storageId);

  const client = policy.clients.find((item) => item.id === clientId) ?? policy.clients[0];
  const grant = policy.grants.find((item) => item.id === grantId) ?? policy.grants[0];
  const storage = policy.storage.find((item) => item.id === storageId) ?? policy.storage[0];

  const result = useMemo(() => {
    const failures: string[] = [];
    if (grant.deprecated) {
      failures.push(
        grant.id === 'password'
          ? 'RFC 9700 says the Resource Owner Password Credentials grant must not be used.'
          : 'RFC 9700 says clients should not use the implicit grant because tokens in the authorization response are exposed to leakage and replay.',
      );
    }
    if (!client.allowedGrants.includes(grant.id)) {
      failures.push(
        client.userPresent
          ? `${grant.label} does not preserve this client’s user authorization boundary.`
          : `${grant.label} does not match a workload acting on its own behalf.`,
      );
    }
    if (!client.allowedStorage.includes(storage.id)) {
      failures.push(`${storage.label} is outside the recommended token boundary for this client.`);
    }
    return {
      failures,
      grantFits: client.allowedGrants.includes(grant.id) && !grant.deprecated,
      ready: failures.length === 0,
      storageFits: client.allowedStorage.includes(storage.id),
    };
  }, [client, grant, storage]);

  function applyClient(nextClient: ClientProfile) {
    setClientId(nextClient.id);
    setGrantId(nextClient.allowedGrants[0]);
    setStorageId(nextClient.allowedStorage[0]);
  }

  function reset() {
    setClientId(initialClient.id);
    setGrantId(policy.defaults.grantId);
    setStorageId(policy.defaults.storageId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Client and grant lab"
        title={policy.title}
        description={policy.description}
        icon={KeyRound}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Client environment
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.clients.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === client.id}
                    label={item.label}
                    detail={item.detail}
                    icon={clientIcon(item.id)}
                    accent="cyan"
                    onClick={() => applyClient(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Grant
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.grants.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === grant.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.deprecated ? TriangleAlert : KeyRound}
                    accent={item.deprecated ? 'rose' : 'blue'}
                    onClick={() => setGrantId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Token location
              </legend>
              <div className="mt-3 grid gap-2">
                {policy.storage.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === storage.id}
                    label={item.label}
                    detail={item.detail}
                    icon={LockKeyhole}
                    accent="violet"
                    onClick={() => setStorageId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <DecisionPanel client={client} grant={grant} storage={storage} result={result} />
      </LearningLabBody>
    </LearningLab>
  );
}

function DecisionPanel({
  client,
  grant,
  storage,
  result,
}: {
  client: ClientProfile;
  grant: GrantOption;
  storage: StorageOption;
  result: {
    failures: string[];
    grantFits: boolean;
    ready: boolean;
    storageFits: boolean;
  };
}) {
  const ClientIcon = clientIcon(client.id);

  return (
    <div className="min-w-0 space-y-6" aria-live="polite">
      <div className={`rounded-md border p-5 ${result.ready
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}
      >
        <div className="flex items-start gap-3">
          {result.ready ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase opacity-70">Architecture verdict</p>
            <h4 className="mt-1 text-xl font-semibold">
              {result.ready ? 'The boundaries fit the selected client' : 'Change this OAuth design'}
            </h4>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.ready
                ? `${grant.label} and ${storage.label.toLowerCase()} preserve the expected trust boundary for this scenario.`
                : result.failures[0]}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <LabMetric
          label="Client boundary"
          value={client.clientType}
          detail={client.clientType === 'public' ? 'Cannot keep a shared secret' : 'Can protect server-side credentials'}
          icon={ClientIcon}
          tone={client.clientType === 'public' ? 'amber' : 'blue'}
        />
        <LabMetric
          label="User in grant"
          value={client.userPresent ? 'Present' : 'None'}
          detail={client.userPresent ? 'Delegated user authorization' : 'Client acts as itself'}
          icon={client.userPresent ? Users : Bot}
          tone="cyan"
        />
        <LabMetric
          label="Selected controls"
          value={result.ready ? 'Compatible' : 'Mismatch'}
          detail={`Grant ${result.grantFits ? 'fits' : 'fails'} · storage ${result.storageFits ? 'fits' : 'fails'}`}
          icon={result.ready ? CheckCircle2 : TriangleAlert}
          tone={result.ready ? 'emerald' : 'rose'}
        />
      </div>

      {!result.ready ? (
        <section className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
          <p className="text-xs font-semibold uppercase opacity-70">Why the gate rejects it</p>
          <ul className="mt-3 space-y-2">
            {result.failures.map((failure) => (
              <li key={failure} className="flex items-start gap-2 text-sm leading-6">
                <TriangleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
                <span>{failure}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Required design controls
          </p>
          <ul className="mt-3 space-y-2">
            {client.requirements.map((requirement) => (
              <li key={requirement} className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span>{requirement}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Credential path
          </p>
          <ol className="mt-4 space-y-3">
            <TraceStep
              number="1"
              title={client.userPresent ? 'User authorization' : 'Workload authentication'}
              detail={client.userPresent
                ? 'The browser visits the authorization endpoint; the client never collects the user password.'
                : 'The confidential workload authenticates directly at the token endpoint.'}
            />
            <TraceStep
              number="2"
              title={grant.label}
              detail={grant.id === 'authorization-code-pkce'
                ? 'The one-time code is bound to the redirect and PKCE verifier before token issuance.'
                : grant.id === 'client-credentials'
                  ? 'The resulting access represents the client, not a delegated person.'
                  : grant.detail}
            />
            <TraceStep
              number="3"
              title={storage.label}
              detail={storage.detail}
            />
          </ol>
        </section>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
        <div className="flex items-start gap-3">
          <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase opacity-70">Refresh decision</p>
            <p className="mt-2 text-sm leading-6">{client.refreshGuidance}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceStep({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950">
        {number}
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</span>
      </span>
    </li>
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
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">OAuth decision model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-36 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading OAuth client policy…
        </div>
      )}
    </div>
  );
}
