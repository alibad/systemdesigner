'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TimerOff,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Identity = {
  id: string;
  label: string;
  detail: string;
  maximumTokenTtlMin: number;
  renewable: boolean;
};

type Secret = {
  id: string;
  label: string;
  detail: string;
  dynamic: boolean;
  defaultLeaseTtlMin: number | null;
};

type ClientMode = {
  id: string;
  label: string;
  detail: string;
  renews: boolean;
  explicitRevoke: boolean;
};

type LeaseModel = {
  kind: 'vault-lease-planner';
  title: string;
  description: string;
  defaults: {
    identityId: string;
    secretId: string;
    clientModeId: string;
    tokenTtlMin: number;
    credentialTtlMin: number;
    renewalIntervalMin: number;
    workloadDurationMin: number;
  };
  ranges: {
    tokenTtlMin: { min: number; max: number; step: number };
    credentialTtlMin: { min: number; max: number; step: number };
    renewalIntervalMin: { min: number; max: number; step: number };
    workloadDurationMin: { min: number; max: number; step: number };
  };
  identities: Identity[];
  secrets: Secret[];
  clientModes: ClientMode[];
};

const BLOCK_ID = 'technology/vault-access-monitor';
const DEFAULT_DATA_FILE = '/api/content/technology/vault/data/lease-lifecycle-model.json';

function isLeaseModel(value: unknown): value is LeaseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LeaseModel>;
  return Boolean(
    candidate.kind === 'vault-lease-planner'
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && candidate.ranges
      && Array.isArray(candidate.identities)
      && candidate.identities.length > 0
      && candidate.identities.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.maximumTokenTtlMin === 'number'
        && typeof item.renewable === 'boolean')
      && Array.isArray(candidate.secrets)
      && candidate.secrets.length > 0
      && candidate.secrets.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.dynamic === 'boolean')
      && Array.isArray(candidate.clientModes)
      && candidate.clientModes.length > 0
      && candidate.clientModes.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.renews === 'boolean'
        && typeof item.explicitRevoke === 'boolean'),
  );
}

export default function VaultAccessMonitor({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<LeaseModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [identityId, setIdentityId] = useState('');
  const [secretId, setSecretId] = useState('');
  const [clientModeId, setClientModeId] = useState('');
  const [tokenTtlMin, setTokenTtlMin] = useState(0);
  const [credentialTtlMin, setCredentialTtlMin] = useState(0);
  const [renewalIntervalMin, setRenewalIntervalMin] = useState(0);
  const [workloadDurationMin, setWorkloadDurationMin] = useState(0);

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
        if (!isLeaseModel(payload)) throw new Error('The lease lifecycle model is incomplete.');
        setModel(payload);
        setIdentityId(payload.defaults.identityId);
        setSecretId(payload.defaults.secretId);
        setClientModeId(payload.defaults.clientModeId);
        setTokenTtlMin(payload.defaults.tokenTtlMin);
        setCredentialTtlMin(payload.defaults.credentialTtlMin);
        setRenewalIntervalMin(payload.defaults.renewalIntervalMin);
        setWorkloadDurationMin(payload.defaults.workloadDurationMin);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load lease data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const identity = model?.identities.find((item) => item.id === identityId)
    ?? model?.identities[0];
  const secret = model?.secrets.find((item) => item.id === secretId) ?? model?.secrets[0];
  const clientMode = model?.clientModes.find((item) => item.id === clientModeId)
    ?? model?.clientModes[0];

  const result = useMemo(() => {
    if (!identity || !secret || !clientMode) return null;

    const effectiveTokenTtlMin = Math.min(tokenTtlMin, identity.maximumTokenTtlMin);
    const effectiveCredentialTtlMin = secret.dynamic ? credentialTtlMin : null;
    const renewalMarginMin = Math.min(
      effectiveTokenTtlMin,
      effectiveCredentialTtlMin ?? effectiveTokenTtlMin,
    ) - renewalIntervalMin;
    const canRenew = identity.renewable
      && clientMode.renews
      && renewalMarginMin > 0;
    const coverageMin = canRenew
      ? identity.maximumTokenTtlMin
      : Math.min(
        effectiveTokenTtlMin,
        effectiveCredentialTtlMin ?? effectiveTokenTtlMin,
      );
    const coversWorkload = coverageMin >= workloadDurationMin;
    const worstCaseExposureMin = clientMode.explicitRevoke
      ? 0
      : secret.dynamic
        ? Math.min(effectiveTokenTtlMin, effectiveCredentialTtlMin ?? effectiveTokenTtlMin)
        : null;
    const clamped = effectiveTokenTtlMin < tokenTtlMin;
    const blockers = [
      !coversWorkload ? 'The modeled identity or lease expires before the workload finishes.' : null,
      clientMode.renews && !identity.renewable ? 'The client expects renewal, but this token is not renewable.' : null,
      clientMode.renews && renewalMarginMin <= 0 ? 'The renewal attempt occurs at or after the shortest lease expires.' : null,
      !secret.dynamic && !clientMode.explicitRevoke ? 'A KV value has no automatic external revocation; rotation remains an explicit system workflow.' : null,
    ].filter((item): item is string => Boolean(item));

    return {
      blockers,
      canRenew,
      clamped,
      coverageMin,
      coversWorkload,
      effectiveCredentialTtlMin,
      effectiveTokenTtlMin,
      renewalMarginMin,
      worstCaseExposureMin,
    };
  }, [
    clientMode,
    credentialTtlMin,
    identity,
    renewalIntervalMin,
    secret,
    tokenTtlMin,
    workloadDurationMin,
  ]);

  if (!model || !identity || !secret || !clientMode || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Lease lifecycle lab"
            title="Match credential lifetime to workload identity"
            description="Loading identities, secret engines, and renewal contracts."
            icon={KeyRound}
            accent="amber"
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
                Loading lease model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setIdentityId(model.defaults.identityId);
    setSecretId(model.defaults.secretId);
    setClientModeId(model.defaults.clientModeId);
    setTokenTtlMin(model.defaults.tokenTtlMin);
    setCredentialTtlMin(model.defaults.credentialTtlMin);
    setRenewalIntervalMin(model.defaults.renewalIntervalMin);
    setWorkloadDurationMin(model.defaults.workloadDurationMin);
  };
  const healthy = result.blockers.length === 0;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Lease lifecycle lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Authenticated identity"
                items={model.identities}
                selectedId={identity.id}
                icon={Fingerprint}
                accent="blue"
                onSelect={setIdentityId}
              />
              <ChoiceGroup
                label="2. Secret contract"
                items={model.secrets}
                selectedId={secret.id}
                icon={Database}
                accent="violet"
                onSelect={setSecretId}
              />
              <ChoiceGroup
                label="3. Client lifecycle"
                items={model.clientModes}
                selectedId={clientMode.id}
                icon={RefreshCw}
                accent="amber"
                onSelect={setClientModeId}
              />
            </div>
          )}
        >
          <div aria-live="polite">
            <section className="mb-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="mb-4">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Tune the lifetime contract
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Compare identity, credential, renewal, and workload windows before accepting the lifecycle.
                </p>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <LabRange
                  label="Requested token TTL"
                  value={tokenTtlMin}
                  output={`${tokenTtlMin} min`}
                  {...model.ranges.tokenTtlMin}
                  lowLabel="short identity"
                  highLabel="long identity"
                  accent="blue"
                  onChange={setTokenTtlMin}
                />
                <LabRange
                  label="Dynamic credential TTL"
                  value={credentialTtlMin}
                  output={secret.dynamic ? `${credentialTtlMin} min` : 'Not leased'}
                  {...model.ranges.credentialTtlMin}
                  lowLabel="short credential"
                  highLabel="long credential"
                  accent="violet"
                  onChange={setCredentialTtlMin}
                />
                <LabRange
                  label="Renewal interval"
                  value={renewalIntervalMin}
                  output={`${renewalIntervalMin} min`}
                  {...model.ranges.renewalIntervalMin}
                  lowLabel="early renewal"
                  highLabel="late renewal"
                  accent="amber"
                  onChange={setRenewalIntervalMin}
                />
                <LabRange
                  label="Workload duration"
                  value={workloadDurationMin}
                  output={`${workloadDurationMin} min`}
                  {...model.ranges.workloadDurationMin}
                  lowLabel="short job"
                  highLabel="long service"
                  accent="emerald"
                  onChange={setWorkloadDurationMin}
                />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Effective token TTL"
                value={`${result.effectiveTokenTtlMin} min`}
                detail={result.clamped ? `Clamped by ${identity.label}` : 'Within role maximum'}
                icon={UserRoundCheck}
                tone={result.clamped ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Credential TTL"
                value={result.effectiveCredentialTtlMin === null ? 'Static' : `${result.effectiveCredentialTtlMin} min`}
                detail={secret.dynamic ? 'Lease-backed external credential' : 'KV value requires rotation'}
                icon={KeyRound}
                tone={secret.dynamic ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Renewal margin"
                value={`${result.renewalMarginMin >= 0 ? '+' : ''}${result.renewalMarginMin} min`}
                detail={result.canRenew ? 'Renewal contract is feasible' : 'No effective renewal path'}
                icon={RefreshCw}
                tone={result.canRenew ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Worst exposure after loss"
                value={result.worstCaseExposureMin === null ? 'Until rotation' : `${result.worstCaseExposureMin} min`}
                detail={clientMode.explicitRevoke ? 'Explicit revoke modeled at completion' : 'Upper bound without successful revoke'}
                icon={TimerOff}
                tone={result.worstCaseExposureMin === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Modeled workload coverage
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    Coverage ends when the shortest required identity or credential contract can no longer be renewed.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {Math.min(result.coverageMin, workloadDurationMin)} / {workloadDurationMin} min
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full ${result.coversWorkload ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, result.coverageMin / workloadDurationMin * 100)}%` }}
                />
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                healthy
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {healthy ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {healthy
                      ? 'Identity, lease, renewal, and workload boundaries agree'
                      : 'The selected lifecycle has an unresolved failure boundary'}
                  </p>
                  {healthy ? (
                    <p className="mt-1 text-sm leading-6 opacity-80">
                      The client authenticates with a bounded identity, obtains only the selected secret contract,
                      renews before expiry when allowed, and has an explicit end-of-work path.
                    </p>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
                      {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This model teaches lease relationships; it does not simulate Vault's expiration manager,
              backend-specific revocation latency, token types, periodic tokens, or network partitions.
              Verify exact behavior for the selected auth method, token role, secrets engine, and client.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'amber';
  onSelect: (id: string) => void;
}) {
  const Icon = icon;
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const accents = {
    blue: {
      selected: 'border-blue-500 bg-blue-50 text-blue-950 ring-blue-500/15 dark:border-blue-400 dark:bg-blue-950/35 dark:text-blue-50',
      icon: 'text-blue-600 dark:text-blue-300',
      detail: 'border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-100',
    },
    violet: {
      selected: 'border-violet-500 bg-violet-50 text-violet-950 ring-violet-500/15 dark:border-violet-400 dark:bg-violet-950/35 dark:text-violet-50',
      icon: 'text-violet-600 dark:text-violet-300',
      detail: 'border-violet-200 bg-violet-50/70 text-violet-950 dark:border-violet-900 dark:bg-violet-950/25 dark:text-violet-100',
    },
    amber: {
      selected: 'border-amber-500 bg-amber-50 text-amber-950 ring-amber-500/15 dark:border-amber-400 dark:bg-amber-950/35 dark:text-amber-50',
      icon: 'text-amber-700 dark:text-amber-300',
      detail: 'border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100',
    },
  } as const;

  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
            className={`flex min-h-20 flex-col items-start justify-between rounded-md border p-2.5 text-left text-xs font-semibold leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              item.id === selectedId
                ? `${accents[accent].selected} ring-4`
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900'
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`h-4 w-4 ${item.id === selectedId ? accents[accent].icon : 'text-neutral-500 dark:text-neutral-400'}`}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <p className={`mt-2 rounded-md border px-3 py-2 text-xs leading-5 ${accents[accent].detail}`}>
        {selected.detail}
      </p>
    </fieldset>
  );
}
