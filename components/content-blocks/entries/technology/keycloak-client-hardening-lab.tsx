'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  ArrowDown,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  Code2,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/keycloak-client-hardening-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/keycloak/data/client-boundary-model.json';

type AccessMode = 'standard-flow' | 'service-account' | 'direct-access';
type PkceMode = 's256' | 'plain' | 'none' | 'not-applicable';
type RedirectPolicy = 'exact' | 'wildcard' | 'none';

type ExpectedSettings = {
  clientAuthentication: boolean;
  accessMode: AccessMode;
  pkce: PkceMode;
  redirectPolicy: RedirectPolicy;
};

type ClientProfile = {
  id: string;
  label: string;
  summary: string;
  expected: ExpectedSettings;
  tokenSubject: string;
  tokenLocation: string;
  requiredControls: string[];
};

type ClientBoundaryModel = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
  };
  profiles: ClientProfile[];
};

function isAccessMode(value: unknown): value is AccessMode {
  return value === 'standard-flow'
    || value === 'service-account'
    || value === 'direct-access';
}

function isPkceMode(value: unknown): value is PkceMode {
  return value === 's256'
    || value === 'plain'
    || value === 'none'
    || value === 'not-applicable';
}

function isRedirectPolicy(value: unknown): value is RedirectPolicy {
  return value === 'exact' || value === 'wildcard' || value === 'none';
}

function isClientBoundaryModel(value: unknown): value is ClientBoundaryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ClientBoundaryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.profileId
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.summary === 'string'
        && typeof profile.expected?.clientAuthentication === 'boolean'
        && isAccessMode(profile.expected.accessMode)
        && isPkceMode(profile.expected.pkce)
        && isRedirectPolicy(profile.expected.redirectPolicy)
        && typeof profile.tokenSubject === 'string'
        && typeof profile.tokenLocation === 'string'
        && Array.isArray(profile.requiredControls)
        && profile.requiredControls.length >= 2
        && profile.requiredControls.every((control) => typeof control === 'string')
      )),
  );
}

function profileIcon(id: string) {
  if (id === 'server-web') return Server;
  if (id === 'spa') return Code2;
  if (id === 'native') return Smartphone;
  if (id === 'service') return Bot;
  return AppWindow;
}

export default function KeycloakClientHardeningLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ClientBoundaryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isClientBoundaryModel(payload)) {
          throw new Error('The client-boundary model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Client hardening lab"
            title="Load the Keycloak client model"
            description="The lesson-owned client profiles and capability constraints are loading."
            icon={ShieldCheck}
            accent="cyan"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <ClientHardeningLab model={model} />
      )}
    </div>
  );
}

function ClientHardeningLab({ model }: { model: ClientBoundaryModel }) {
  const initialProfile = model.profiles.find(
    (profile) => profile.id === model.defaults.profileId,
  ) ?? model.profiles[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [clientAuthentication, setClientAuthentication] = useState(
    initialProfile.expected.clientAuthentication,
  );
  const [accessMode, setAccessMode] = useState<AccessMode>(
    initialProfile.expected.accessMode,
  );
  const [pkce, setPkce] = useState<PkceMode>(initialProfile.expected.pkce);
  const [redirectPolicy, setRedirectPolicy] = useState<RedirectPolicy>(
    initialProfile.expected.redirectPolicy,
  );

  const profile = model.profiles.find((item) => item.id === profileId)
    ?? model.profiles[0];

  const result = useMemo(() => {
    const failures: string[] = [];

    if (clientAuthentication !== profile.expected.clientAuthentication) {
      failures.push(
        profile.expected.clientAuthentication
          ? 'This workload can protect a credential, so Client authentication must be On for the selected capability.'
          : 'Distributed browser or device code cannot protect a shared secret; Client authentication must be Off.',
      );
    }

    if (accessMode !== profile.expected.accessMode) {
      if (accessMode === 'direct-access') {
        failures.push('Direct access grants collect the user password at the client and are not a safe default for new designs.');
      } else if (profile.expected.accessMode === 'service-account') {
        failures.push('This workload needs Service account roles because no browser user participates.');
      } else {
        failures.push('This user-facing client needs Standard flow so Keycloak, not the application, handles the login interaction.');
      }
    }

    if (pkce !== profile.expected.pkce) {
      failures.push(
        profile.expected.pkce === 's256'
          ? 'Require PKCE S256 for this authorization-code client; plain or optional PKCE weakens code redemption.'
          : 'PKCE belongs to an authorization-code transaction and is not applicable to this service-account request.',
      );
    }

    if (redirectPolicy !== profile.expected.redirectPolicy) {
      failures.push(
        profile.expected.redirectPolicy === 'exact'
          ? 'Register a specific callback. A wildcard expands where an authorization response may be delivered.'
          : 'A service-account client has no browser callback, so it should not carry redirect URI surface.',
      );
    }

    return {
      failures,
      ready: failures.length === 0,
    };
  }, [accessMode, clientAuthentication, pkce, profile, redirectPolicy]);

  function applyProfile(nextProfile: ClientProfile) {
    setProfileId(nextProfile.id);
    setClientAuthentication(nextProfile.expected.clientAuthentication);
    setAccessMode(nextProfile.expected.accessMode);
    setPkce(nextProfile.expected.pkce);
    setRedirectPolicy(nextProfile.expected.redirectPolicy);
  }

  function reset() {
    applyProfile(initialProfile);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Client hardening lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Application boundary
            </legend>
            <div className="mt-3 grid gap-2">
              {model.profiles.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === profile.id}
                  label={item.label}
                  detail={item.summary}
                  icon={profileIcon(item.id)}
                  accent="cyan"
                  onClick={() => applyProfile(item)}
                />
              ))}
            </div>
          </fieldset>
        )}
      >
        <div className="min-w-0 space-y-6">
          <ConfigurationControls
            clientAuthentication={clientAuthentication}
            accessMode={accessMode}
            pkce={pkce}
            redirectPolicy={redirectPolicy}
            onClientAuthentication={setClientAuthentication}
            onAccessMode={setAccessMode}
            onPkce={setPkce}
            onRedirectPolicy={setRedirectPolicy}
          />
          <DecisionResult profile={profile} result={result} accessMode={accessMode} />
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ConfigurationControls({
  clientAuthentication,
  accessMode,
  pkce,
  redirectPolicy,
  onClientAuthentication,
  onAccessMode,
  onPkce,
  onRedirectPolicy,
}: {
  clientAuthentication: boolean;
  accessMode: AccessMode;
  pkce: PkceMode;
  redirectPolicy: RedirectPolicy;
  onClientAuthentication: (value: boolean) => void;
  onAccessMode: (value: AccessMode) => void;
  onPkce: (value: PkceMode) => void;
  onRedirectPolicy: (value: RedirectPolicy) => void;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        2. Keycloak capability settings
      </p>
      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <SegmentedControl
          label="Client authentication"
          value={clientAuthentication ? 'on' : 'off'}
          options={[
            { value: 'off', label: 'Off', detail: 'Public client' },
            { value: 'on', label: 'On', detail: 'Confidential client' },
          ]}
          onChange={(value) => onClientAuthentication(value === 'on')}
        />
        <SegmentedControl
          label="Protocol capability"
          value={accessMode}
          options={[
            { value: 'standard-flow', label: 'Standard', detail: 'Authorization Code' },
            { value: 'service-account', label: 'Service account', detail: 'Client Credentials' },
            { value: 'direct-access', label: 'Direct grant', detail: 'User password at client' },
          ]}
          onChange={(value) => onAccessMode(value as AccessMode)}
        />
        <SegmentedControl
          label="PKCE method"
          value={pkce}
          options={[
            { value: 's256', label: 'S256', detail: 'Required' },
            { value: 'plain', label: 'plain', detail: 'No hash' },
            { value: 'none', label: 'Optional', detail: 'Blank setting' },
            { value: 'not-applicable', label: 'N/A', detail: 'No code flow' },
          ]}
          onChange={(value) => onPkce(value as PkceMode)}
        />
        <SegmentedControl
          label="Redirect URI policy"
          value={redirectPolicy}
          options={[
            { value: 'exact', label: 'Exact', detail: 'Specific callback' },
            { value: 'wildcard', label: 'Wildcard', detail: 'Broader callback' },
            { value: 'none', label: 'None', detail: 'No browser redirect' },
          ]}
          onChange={(value) => onRedirectPolicy(value as RedirectPolicy)}
        />
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; detail: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {label}
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-16 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                selected
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-400 dark:bg-cyan-950/45 dark:text-cyan-50 dark:ring-cyan-400'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`mt-0.5 block text-xs ${selected
                ? 'text-cyan-800 dark:text-cyan-200'
                : 'text-neutral-500 dark:text-neutral-400'}`}
              >
                {option.detail}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function DecisionResult({
  profile,
  result,
  accessMode,
}: {
  profile: ClientProfile;
  result: { failures: string[]; ready: boolean };
  accessMode: AccessMode;
}) {
  const ProfileIcon = profileIcon(profile.id);
  const capabilityLabel = accessMode === 'standard-flow'
    ? 'Authorization Code'
    : accessMode === 'service-account'
      ? 'Client Credentials'
      : 'Password grant';

  return (
    <div className="space-y-5" aria-live="polite">
      <section className={`rounded-md border p-5 ${
        result.ready
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
          : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
      }`}
      >
        <div className="flex items-start gap-3">
          {result.ready ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase opacity-70">Configuration verdict</p>
            <h4 className="mt-1 text-xl font-semibold">
              {result.ready
                ? 'The Keycloak settings match this runtime'
                : `${result.failures.length} trust-boundary mismatch${result.failures.length === 1 ? '' : 'es'}`}
            </h4>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.ready
                ? `The selected client capability and credential boundary preserve the expected subject for ${profile.label.toLowerCase()}.`
                : result.failures[0]}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <LabMetric
          label="Application"
          value={profile.label}
          detail={profile.summary}
          icon={ProfileIcon}
          tone="cyan"
        />
        <LabMetric
          label="Token subject"
          value={profile.tokenSubject}
          detail="The identity the access token represents"
          icon={KeyRound}
          tone="violet"
        />
        <LabMetric
          label="Boundary"
          value={result.ready ? 'Compatible' : 'Rejected'}
          detail={result.ready ? 'All required settings agree' : 'At least one setting crosses trust'}
          icon={result.ready ? ShieldCheck : TriangleAlert}
          tone={result.ready ? 'emerald' : 'rose'}
        />
      </div>

      {!result.ready ? (
        <section className="rounded-md border border-rose-200 bg-white p-4 dark:border-rose-900 dark:bg-neutral-950">
          <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300">
            Repair these settings
          </p>
          <ul className="mt-3 space-y-2">
            {result.failures.map((failure) => (
              <li key={failure} className="flex items-start gap-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">
                <TriangleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                <span>{failure}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Resulting credential path
        </p>
        <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <PathNode
            icon={ProfileIcon}
            label={profile.label}
            detail={profile.id === 'service' ? 'Authenticates as a workload' : 'Starts a user authorization transaction'}
          />
          <FlowArrow />
          <PathNode
            icon={KeyRound}
            label={capabilityLabel}
            detail={accessMode === 'direct-access'
              ? 'The client handles the user password'
              : accessMode === 'service-account'
                ? 'No browser user participates'
                : 'Keycloak handles the login interaction'}
          />
          <FlowArrow />
          <PathNode
            icon={LockKeyhole}
            label={profile.tokenLocation}
            detail={`Expected subject: ${profile.tokenSubject}`}
          />
        </div>
      </section>

      <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
        <p className="text-xs font-semibold uppercase opacity-70">Required controls</p>
        <ul className="mt-3 space-y-2">
          {profile.requiredControls.map((control) => (
            <li key={control} className="flex items-start gap-2 text-sm leading-6">
              <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
              <span>{control}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PathNode({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof AppWindow;
  label: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
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
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Keycloak client model unavailable</p>
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
        <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading Keycloak client boundaries...
        </div>
      )}
    </div>
  );
}
