'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  Database,
  Files,
  Globe2,
  KeyRound,
  LoaderCircle,
  MapPin,
  Network,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
  Workflow,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/sovereign-cloud-systems-authority-placement-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/sovereign-cloud-systems/data/authority-placement-model.json';

const DATA_SURFACES = [
  'primary',
  'replicas',
  'backups',
  'indexes',
  'logs',
  'support-artifacts',
] as const;
const AUTHORITY_PLANES = ['identity', 'keys', 'operations'] as const;

type DataSurface = (typeof DATA_SURFACES)[number];
type AuthorityPlane = (typeof AUTHORITY_PLANES)[number];

type Workload = {
  id: string;
  label: string;
  detail: string;
  legalBoundary: string;
  requiredLocalSurfaces: DataSurface[];
  requiresLocalControlPlane: boolean;
  requiresScreenedOperators: boolean;
  requiredCustomerAuthorities: AuthorityPlane[];
  forbidsProviderBypass: boolean;
  maximumExternalCriticalDependencies: number;
};

type Platform = {
  id: string;
  label: string;
  detail: string;
  localSurfaces: DataSurface[];
  localControlPlane: boolean;
  screenedOperators: boolean;
  externalCriticalDependencies: number;
  dependencyNote: string;
};

type AuthorityModel = {
  id: string;
  label: string;
  detail: string;
  customerControls: AuthorityPlane[];
  providerCanBypass: boolean;
  identityOwner: string;
  keyOwner: string;
  operationsOwner: string;
};

type PlacementModel = {
  kind: 'sovereign-authority-placement';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    workloadId: string;
    platformId: string;
    authorityId: string;
  };
  workloads: Workload[];
  platforms: Platform[];
  authorityModels: AuthorityModel[];
};

const SURFACE_LABELS: Record<DataSurface, string> = {
  primary: 'Primary records',
  replicas: 'Replicas',
  backups: 'Backups',
  indexes: 'Indexes',
  logs: 'Logs',
  'support-artifacts': 'Support artifacts',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function containsOnly<T extends string>(
  values: string[],
  allowed: readonly T[],
): values is T[] {
  return values.every((value) => allowed.includes(value as T));
}

function isPlacementModel(value: unknown): value is PlacementModel {
  if (
    !isRecord(value)
    || value.kind !== 'sovereign-authority-placement'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.workloadId !== 'string'
    || typeof value.defaults.platformId !== 'string'
    || typeof value.defaults.authorityId !== 'string'
    || !Array.isArray(value.workloads)
    || value.workloads.length < 3
    || !Array.isArray(value.platforms)
    || value.platforms.length < 4
    || !Array.isArray(value.authorityModels)
    || value.authorityModels.length < 3
  ) {
    return false;
  }

  const validWorkloads = value.workloads.every((workload) => (
    isRecord(workload)
    && typeof workload.id === 'string'
    && typeof workload.label === 'string'
    && typeof workload.detail === 'string'
    && typeof workload.legalBoundary === 'string'
    && isStringArray(workload.requiredLocalSurfaces)
    && containsOnly(workload.requiredLocalSurfaces, DATA_SURFACES)
    && typeof workload.requiresLocalControlPlane === 'boolean'
    && typeof workload.requiresScreenedOperators === 'boolean'
    && isStringArray(workload.requiredCustomerAuthorities)
    && containsOnly(workload.requiredCustomerAuthorities, AUTHORITY_PLANES)
    && typeof workload.forbidsProviderBypass === 'boolean'
    && typeof workload.maximumExternalCriticalDependencies === 'number'
  ));
  const validPlatforms = value.platforms.every((platform) => (
    isRecord(platform)
    && typeof platform.id === 'string'
    && typeof platform.label === 'string'
    && typeof platform.detail === 'string'
    && isStringArray(platform.localSurfaces)
    && containsOnly(platform.localSurfaces, DATA_SURFACES)
    && typeof platform.localControlPlane === 'boolean'
    && typeof platform.screenedOperators === 'boolean'
    && typeof platform.externalCriticalDependencies === 'number'
    && typeof platform.dependencyNote === 'string'
  ));
  const validAuthorities = value.authorityModels.every((authority) => (
    isRecord(authority)
    && typeof authority.id === 'string'
    && typeof authority.label === 'string'
    && typeof authority.detail === 'string'
    && isStringArray(authority.customerControls)
    && containsOnly(authority.customerControls, AUTHORITY_PLANES)
    && typeof authority.providerCanBypass === 'boolean'
    && typeof authority.identityOwner === 'string'
    && typeof authority.keyOwner === 'string'
    && typeof authority.operationsOwner === 'string'
  ));

  if (!validWorkloads || !validPlatforms || !validAuthorities) return false;

  const defaults = value.defaults as PlacementModel['defaults'];
  return (
    value.workloads.some((item) => item.id === defaults.workloadId)
    && value.platforms.some((item) => item.id === defaults.platformId)
    && value.authorityModels.some((item) => item.id === defaults.authorityId)
  );
}

function workloadIcon(id: string) {
  if (id === 'public-catalog') return Globe2;
  if (id === 'resident-benefits') return UsersRound;
  return Files;
}

function platformIcon(id: string) {
  if (id === 'global-saas') return Globe2;
  if (id === 'regional-managed') return MapPin;
  if (id === 'sovereign-zone') return ShieldCheck;
  return ServerCog;
}

export default function SovereignCloudAuthorityPlacementLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PlacementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPlacementModel(payload)) {
          throw new Error('The authority-placement contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the placement contract.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Authority and placement lab"
            title="Evaluate location and control separately"
            description="Loading workload, platform, and authority contracts."
            icon={MapPin}
            accent="cyan"
          />
          <LearningLabBody>
            <LoadState
              error={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <AuthorityPlacementLab model={model} />
    </div>
  );
}

function AuthorityPlacementLab({ model }: { model: PlacementModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [platformId, setPlatformId] = useState(model.defaults.platformId);
  const [authorityId, setAuthorityId] = useState(model.defaults.authorityId);

  const workload = model.workloads.find((item) => item.id === workloadId)
    ?? model.workloads[0];
  const platform = model.platforms.find((item) => item.id === platformId)
    ?? model.platforms[0];
  const authority = model.authorityModels.find((item) => item.id === authorityId)
    ?? model.authorityModels[0];

  const decision = useMemo(() => {
    const missingSurfaces = workload.requiredLocalSurfaces.filter(
      (surface) => !platform.localSurfaces.includes(surface),
    );
    const missingAuthorities = workload.requiredCustomerAuthorities.filter(
      (plane) => !authority.customerControls.includes(plane),
    );
    const residencyRequired = workload.requiredLocalSurfaces.length > 0;
    const residencyMet = missingSurfaces.length === 0;
    const controlPlaneMet =
      !workload.requiresLocalControlPlane || platform.localControlPlane;
    const operatorsMet =
      !workload.requiresScreenedOperators || platform.screenedOperators;
    const dependenciesMet =
      platform.externalCriticalDependencies
      <= workload.maximumExternalCriticalDependencies;
    const bypassMet =
      !workload.forbidsProviderBypass || !authority.providerCanBypass;

    const blockers = [
      missingSurfaces.length > 0
        ? `Non-local required surfaces: ${missingSurfaces.map((surface) => SURFACE_LABELS[surface]).join(', ')}.`
        : null,
      !controlPlaneMet
        ? 'The administrative control plane is outside the required boundary.'
        : null,
      !operatorsMet
        ? 'Privileged operations are not restricted to the required screened operator pool.'
        : null,
      missingAuthorities.length > 0
        ? `Customer authority is missing for: ${missingAuthorities.join(', ')}.`
        : null,
      !bypassMet
        ? 'The provider retains a unilateral bypass over a protected control.'
        : null,
      !dependenciesMet
        ? `${platform.externalCriticalDependencies} critical external dependencies exceed the allowed maximum of ${workload.maximumExternalCriticalDependencies}.`
        : null,
    ].filter((item): item is string => Boolean(item));

    return {
      allowed: blockers.length === 0,
      blockers,
      missingSurfaces,
      residencyRequired,
      residencyMet,
      controlPlaneMet,
      operatorsMet,
      dependenciesMet,
      bypassMet,
    };
  }, [authority, platform, workload]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setPlatformId(model.defaults.platformId);
    setAuthorityId(model.defaults.authorityId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Authority and placement lab"
        title={model.title}
        description={model.description}
        icon={MapPin}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload contract
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workloads.map((item) => {
                  const Icon = workloadIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'restricted-cases' ? 'rose' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Platform footprint
              </legend>
              <div className="mt-3 grid gap-2">
                {model.platforms.map((item) => {
                  const Icon = platformIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === platform.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={
                        item.externalCriticalDependencies === 0
                          ? 'emerald'
                          : item.localControlPlane
                            ? 'cyan'
                            : 'amber'
                      }
                      onClick={() => setPlatformId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Administrative authority
              </legend>
              <div className="mt-3 grid gap-2">
                {model.authorityModels.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === authority.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.providerCanBypass ? UserRoundCog : ShieldCheck}
                    accent={item.providerCanBypass ? 'amber' : 'violet'}
                    onClick={() => setAuthorityId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Placement decision"
              value={decision.allowed ? 'Allowed' : 'Denied'}
              detail={
                decision.allowed
                  ? 'Every mandatory workload boundary passes.'
                  : `${decision.blockers.length} mandatory boundary ${decision.blockers.length === 1 ? 'fails' : 'fail'}.`
              }
              icon={decision.allowed ? CheckCircle2 : Ban}
              tone={decision.allowed ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Residency"
              value={
                !decision.residencyRequired
                  ? 'Not required'
                  : decision.residencyMet
                    ? 'Complete'
                    : 'Incomplete'
              }
              detail={
                decision.residencyRequired
                  ? `${workload.requiredLocalSurfaces.length - decision.missingSurfaces.length}/${workload.requiredLocalSurfaces.length} required surfaces are local.`
                  : 'Location is still recorded as evidence.'
              }
              icon={Database}
              tone={
                !decision.residencyRequired
                  ? 'neutral'
                  : decision.residencyMet
                    ? 'emerald'
                    : 'rose'
              }
            />
            <LabMetric
              label="Customer authority"
              value={`${authority.customerControls.length}/3`}
              detail={
                authority.providerCanBypass
                  ? 'Provider retains a unilateral bypass.'
                  : 'No provider-only bypass in this model.'
              }
              icon={KeyRound}
              tone={decision.bypassMet ? 'violet' : 'rose'}
            />
            <LabMetric
              label="External dependencies"
              value={String(platform.externalCriticalDependencies)}
              detail={`Maximum allowed: ${workload.maximumExternalCriticalDependencies}.`}
              icon={Network}
              tone={decision.dependenciesMet ? 'blue' : 'rose'}
            />
          </div>

          <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Legal and workload boundary
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {workload.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {workload.legalBoundary}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                Policy-specific
              </span>
            </div>
          </section>

          <section className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Data surfaces
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
              {DATA_SURFACES.map((surface) => {
                const local = platform.localSurfaces.includes(surface);
                const required = workload.requiredLocalSurfaces.includes(surface);
                return (
                  <SurfaceState
                    key={surface}
                    label={SURFACE_LABELS[surface]}
                    local={local}
                    required={required}
                  />
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Authority planes
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <AuthorityState
                icon={UsersRound}
                label="Identity"
                owner={authority.identityOwner}
                controlled={authority.customerControls.includes('identity')}
                required={workload.requiredCustomerAuthorities.includes('identity')}
              />
              <AuthorityState
                icon={KeyRound}
                label="Keys"
                owner={authority.keyOwner}
                controlled={authority.customerControls.includes('keys')}
                required={workload.requiredCustomerAuthorities.includes('keys')}
              />
              <AuthorityState
                icon={Workflow}
                label="Operations"
                owner={authority.operationsOwner}
                controlled={authority.customerControls.includes('operations')}
                required={workload.requiredCustomerAuthorities.includes('operations')}
              />
            </div>
          </section>

          <section
            className={`mt-6 rounded-md border p-4 ${
              decision.allowed
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {decision.allowed ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {decision.allowed
                    ? 'The workload may be admitted'
                    : 'Keep the workload out of this placement'}
                </p>
                {decision.blockers.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm leading-6">
                    {decision.blockers.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-2">
                        <XCircle
                          aria-hidden="true"
                          className="mt-1 h-4 w-4 shrink-0"
                        />
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    Location, local control plane, operator eligibility, authority,
                    provider bypass, and critical dependency limits all meet the
                    selected contract.
                  </p>
                )}
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <BoundaryFact
              label="Control plane"
              ready={decision.controlPlaneMet}
              detail={platform.localControlPlane ? 'Local' : 'External'}
            />
            <BoundaryFact
              label="Operator pool"
              ready={decision.operatorsMet}
              detail={platform.screenedOperators ? 'Screened local operators' : 'Global provider operations'}
            />
            <BoundaryFact
              label="Dependency path"
              ready={decision.dependenciesMet}
              detail={platform.dependencyNote}
            />
          </div>

          <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function SurfaceState({
  label,
  local,
  required,
}: {
  label: string;
  local: boolean;
  required: boolean;
}) {
  return (
    <div
      className={`min-h-24 min-w-0 rounded-md border p-3 ${
        required && !local
          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
          : local
            ? 'border-emerald-300 bg-white dark:border-emerald-900 dark:bg-neutral-950'
            : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {local ? (
          <MapPin aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <Globe2 aria-hidden="true" className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        )}
        <span className="text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          {required ? 'Required' : 'Observed'}
        </span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {label}
      </p>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
        {local ? 'Inside selected jurisdiction' : 'Outside selected jurisdiction'}
      </p>
    </div>
  );
}

function AuthorityState({
  icon: Icon,
  label,
  owner,
  controlled,
  required,
}: {
  icon: typeof KeyRound;
  label: string;
  owner: string;
  controlled: boolean;
  required: boolean;
}) {
  const passed = !required || controlled;

  return (
    <div
      className={`min-h-32 min-w-0 rounded-md border p-4 ${
        passed
          ? 'border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/25'
          : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="h-5 w-5 text-violet-600 dark:text-violet-300" />
        {passed ? (
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <XCircle aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {owner}
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {required ? 'Customer authority required' : 'Authority recorded'}
      </p>
    </div>
  );
}

function BoundaryFact({
  label,
  ready,
  detail,
}: {
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div
      className={`min-h-24 min-w-0 rounded-md border p-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
          : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-200">
        {ready ? (
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
        )}
        {label}
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {detail}
      </p>
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
    <div className="flex min-h-[420px] items-center justify-center">
      {error ? (
        <div className="max-w-md text-center">
          <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Placement data could not be loaded
          </p>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300" role="status">
          <LoaderCircle
            aria-hidden="true"
            className="h-5 w-5 animate-spin text-cyan-500 motion-reduce:animate-none"
          />
          Loading authority-placement contract...
        </div>
      )}
    </div>
  );
}
