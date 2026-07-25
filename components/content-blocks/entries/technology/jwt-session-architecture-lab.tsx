'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CircleAlert,
  Clock3,
  Gauge,
  KeyRound,
  Network,
  RefreshCw,
  RotateCcwKey,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/jwt-session-rotation-revocation-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/jwt/data/session-rotation-revocation-architecture.json';

type Choice = {
  id: string;
  label: string;
  detail: string;
};

type RefreshStrategy = Choice & {
  replayBoundary: string;
};

type RevocationMode = Choice & {
  availabilityPosture: string;
};

type IncidentCondition = Choice & {
  kind:
    | 'steady'
    | 'planned-rotation'
    | 'issuer-outage-new-key'
    | 'refresh-replay'
    | 'signing-key-compromise';
};

type SessionArchitectureModel = {
  blockId: string;
  title: string;
  description: string;
  defaults: {
    accessLifetimeMinutes: number;
    sessionLifetimeHours: number;
    keyOverlapMinutes: number;
    revocationPropagationMinutes: number;
    refreshStrategyId: string;
    revocationModeId: string;
    incidentConditionId: string;
  };
  limits: {
    accessLifetimeMinutes: { min: number; max: number; step: number };
    sessionLifetimeHours: { min: number; max: number; step: number };
    keyOverlapMinutes: { min: number; max: number; step: number };
    revocationPropagationMinutes: { min: number; max: number; step: number };
  };
  refreshStrategies: RefreshStrategy[];
  revocationModes: RevocationMode[];
  incidentConditions: IncidentCondition[];
  assumptions: string[];
};

type ArchitectureResult = {
  severity: 'healthy' | 'warning' | 'critical';
  headline: string;
  blastRadius: string;
  decision: string;
  staleAccessMinutes: number;
  staleAccessDetail: string;
  rotationGapMinutes: number;
  refreshBoundary: string;
};

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Choice>;
  return isString(candidate.id) && isString(candidate.label) && isString(candidate.detail);
}

function isLimit(value: unknown): value is { min: number; max: number; step: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { min?: unknown; max?: unknown; step?: unknown };
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isConditionKind(value: unknown): value is IncidentCondition['kind'] {
  return value === 'steady'
    || value === 'planned-rotation'
    || value === 'issuer-outage-new-key'
    || value === 'refresh-replay'
    || value === 'signing-key-compromise';
}

function isSessionArchitectureModel(value: unknown): value is SessionArchitectureModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionArchitectureModel>;

  return Boolean(
    isString(candidate.blockId)
      && isString(candidate.title)
      && isString(candidate.description)
      && typeof candidate.defaults?.accessLifetimeMinutes === 'number'
      && typeof candidate.defaults?.sessionLifetimeHours === 'number'
      && typeof candidate.defaults?.keyOverlapMinutes === 'number'
      && typeof candidate.defaults?.revocationPropagationMinutes === 'number'
      && isString(candidate.defaults?.refreshStrategyId)
      && isString(candidate.defaults?.revocationModeId)
      && isString(candidate.defaults?.incidentConditionId)
      && isLimit(candidate.limits?.accessLifetimeMinutes)
      && isLimit(candidate.limits?.sessionLifetimeHours)
      && isLimit(candidate.limits?.keyOverlapMinutes)
      && isLimit(candidate.limits?.revocationPropagationMinutes)
      && Array.isArray(candidate.refreshStrategies)
      && candidate.refreshStrategies.length >= 3
      && candidate.refreshStrategies.every(
        (item) => isChoice(item)
          && isString((item as Partial<RefreshStrategy>).replayBoundary),
      )
      && Array.isArray(candidate.revocationModes)
      && candidate.revocationModes.length >= 3
      && candidate.revocationModes.every(
        (item) => isChoice(item)
          && isString((item as Partial<RevocationMode>).availabilityPosture),
      )
      && Array.isArray(candidate.incidentConditions)
      && candidate.incidentConditions.length >= 5
      && candidate.incidentConditions.every(
        (item) => isChoice(item)
          && isConditionKind((item as Partial<IncidentCondition>).kind),
      )
      && Array.isArray(candidate.assumptions)
      && candidate.assumptions.length >= 3
      && candidate.assumptions.every(isString),
  );
}

function findById<T extends Choice>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function JwtSessionArchitectureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SessionArchitectureModel | null>(null);
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
        if (!isSessionArchitectureModel(payload) || payload.blockId !== BLOCK_ID) {
          throw new Error('The JWT session architecture model is incomplete or has the wrong block ID.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LabLoadState
        detail={error ?? 'Loading session, refresh, rotation, outage, and replay decisions.'}
        error={Boolean(error)}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ArchitectureWorkbench model={model} />;
}

function ArchitectureWorkbench({ model }: { model: SessionArchitectureModel }) {
  const [accessLifetimeMinutes, setAccessLifetimeMinutes] = useState(
    model.defaults.accessLifetimeMinutes,
  );
  const [sessionLifetimeHours, setSessionLifetimeHours] = useState(
    model.defaults.sessionLifetimeHours,
  );
  const [keyOverlapMinutes, setKeyOverlapMinutes] = useState(
    model.defaults.keyOverlapMinutes,
  );
  const [revocationPropagationMinutes, setRevocationPropagationMinutes] = useState(
    model.defaults.revocationPropagationMinutes,
  );
  const [refreshStrategyId, setRefreshStrategyId] = useState(
    model.defaults.refreshStrategyId,
  );
  const [revocationModeId, setRevocationModeId] = useState(
    model.defaults.revocationModeId,
  );
  const [incidentConditionId, setIncidentConditionId] = useState(
    model.defaults.incidentConditionId,
  );

  const refreshStrategy = findById(model.refreshStrategies, refreshStrategyId);
  const revocationMode = findById(model.revocationModes, revocationModeId);
  const incident = findById(model.incidentConditions, incidentConditionId);

  const result = useMemo<ArchitectureResult>(() => {
    const staleAccessMinutes = revocationMode.id === 'offline'
      ? accessLifetimeMinutes
      : Math.min(accessLifetimeMinutes, revocationPropagationMinutes);
    const rotationGapMinutes = Math.max(0, accessLifetimeMinutes - keyOverlapMinutes);

    if (incident.kind === 'planned-rotation') {
      if (rotationGapMinutes > 0) {
        return {
          severity: 'warning',
          headline: 'The old verification key retires before its longest token',
          blastRadius: `Any request carrying an old-key token during the final ${rotationGapMinutes} minutes of its accepted lifetime fails verification.`,
          decision: `Keep the old public key available for at least ${accessLifetimeMinutes} minutes, or deliberately accept reauthentication and request failures during the ${rotationGapMinutes}-minute gap.`,
          staleAccessMinutes,
          staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
          rotationGapMinutes,
          refreshBoundary: refreshStrategy.replayBoundary,
        };
      }
      return {
        severity: 'healthy',
        headline: 'The planned overlap covers the configured access-token lifetime',
        blastRadius: 'New tokens use the replacement key while old-key access tokens can remain verifiable through their configured lifetime.',
        decision: 'Publish the replacement key before using it, monitor verifier refresh, then remove the old key only after the accepted old-token window closes.',
        staleAccessMinutes,
        staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
        rotationGapMinutes,
        refreshBoundary: refreshStrategy.replayBoundary,
      };
    }

    if (incident.kind === 'issuer-outage-new-key') {
      const online = revocationMode.id === 'introspection';
      return {
        severity: 'critical',
        headline: online
          ? 'The request path depends on an unavailable authority'
          : 'Verifiers cannot obtain the newly activated public key',
        blastRadius: online
          ? 'Every protected request that requires online introspection can fail closed while the authority is unavailable.'
          : 'Requests carrying the unseen kid fail at resource servers that cannot refresh JWKS; tokens using cached, still-trusted keys can continue.',
        decision: 'Do not activate a new signing key until it is published and observable at every verifier. Bound JWKS fetches, retain trusted cached keys, and define fail-closed behavior for an unseen kid.',
        staleAccessMinutes,
        staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
        rotationGapMinutes,
        refreshBoundary: refreshStrategy.replayBoundary,
      };
    }

    if (incident.kind === 'refresh-replay') {
      if (refreshStrategy.id === 'none') {
        return {
          severity: 'healthy',
          headline: 'There is no refresh credential to replay',
          blastRadius: `A stolen access token is still a bearer credential for at most the ${staleAccessMinutes}-minute stale-access bound shown here.`,
          decision: 'Use a fresh authorization flow when the access token expires, and still protect or sender-constrain the access token where replay matters.',
          staleAccessMinutes,
          staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
          rotationGapMinutes,
          refreshBoundary: refreshStrategy.replayBoundary,
        };
      }

      if (refreshStrategy.id === 'reusable') {
        return {
          severity: 'critical',
          headline: 'A copied reusable refresh token has no built-in reuse signal',
          blastRadius: `The compromised grant can mint replacement access tokens until the refresh credential or its session ceiling is revoked, for up to ${sessionLifetimeHours} hours in this model.`,
          decision: 'For a public client, replace reusable bearer refresh tokens with rotation plus family-state reuse detection or a sender-constrained design.',
          staleAccessMinutes,
          staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
          rotationGapMinutes,
          refreshBoundary: refreshStrategy.replayBoundary,
        };
      }

      if (refreshStrategy.id === 'rotating-family') {
        return {
          severity: 'warning',
          headline: 'Reuse detection revokes the refresh-token family',
          blastRadius: `The affected grant is forced through authorization again; access tokens already issued can remain usable for up to ${staleAccessMinutes} minutes after revocation is recorded.`,
          decision: 'Atomically invalidate each refresh token on use, retain family lineage, revoke the active family member on reuse, and alert without trying to guess which presenter was legitimate.',
          staleAccessMinutes,
          staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
          rotationGapMinutes,
          refreshBoundary: refreshStrategy.replayBoundary,
        };
      }

      return {
        severity: 'warning',
        headline: 'The refresh token alone is insufficient, but the proof key matters',
        blastRadius: `Replay from a party that stole only the token is blocked. If token and proof key are both lost, the grant and its ${sessionLifetimeHours}-hour session ceiling are exposed.`,
        decision: 'Verify sender binding on every refresh, protect the proof key, and retain revocation because sender constraint does not contain a combined token-and-key compromise.',
        staleAccessMinutes,
        staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
        rotationGapMinutes,
        refreshBoundary: refreshStrategy.replayBoundary,
      };
    }

    if (incident.kind === 'signing-key-compromise') {
      return {
        severity: 'critical',
        headline: 'Normal overlap is unsafe for a compromised signing key',
        blastRadius: 'Every verifier that still trusts the exposed key can accept attacker-minted tokens whose claims fit that verifier policy.',
        decision: 'Stop signing, publish a replacement, remove or deny the compromised key immediately, distribute the emergency trust change, and plan forced reauthentication. Do not wait for planned overlap.',
        staleAccessMinutes,
        staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
        rotationGapMinutes,
        refreshBoundary: refreshStrategy.replayBoundary,
      };
    }

    const reusableWarning = refreshStrategy.id === 'reusable';
    return {
      severity: reusableWarning ? 'warning' : 'healthy',
      headline: reusableWarning
        ? 'The steady state still lacks refresh-token replay detection'
        : 'The configured windows and state boundaries are explicit',
      blastRadius: `An offline-validated access token can outlive a session or revocation decision by up to ${staleAccessMinutes} minutes under the assumptions below.`,
      decision: reusableWarning
        ? 'Use rotation with family-state reuse detection or sender constraint before issuing refresh tokens to a public client.'
        : 'Test the configured access lifetime, session ceiling, refresh behavior, key overlap, revocation propagation, and outage posture as separate controls.',
      staleAccessMinutes,
      staleAccessDetail: staleDetail(revocationMode, accessLifetimeMinutes, revocationPropagationMinutes),
      rotationGapMinutes,
      refreshBoundary: refreshStrategy.replayBoundary,
    };
  }, [
    accessLifetimeMinutes,
    incident.kind,
    keyOverlapMinutes,
    refreshStrategy,
    revocationMode,
    revocationPropagationMinutes,
    sessionLifetimeHours,
  ]);

  function reset() {
    setAccessLifetimeMinutes(model.defaults.accessLifetimeMinutes);
    setSessionLifetimeHours(model.defaults.sessionLifetimeHours);
    setKeyOverlapMinutes(model.defaults.keyOverlapMinutes);
    setRevocationPropagationMinutes(model.defaults.revocationPropagationMinutes);
    setRefreshStrategyId(model.defaults.refreshStrategyId);
    setRevocationModeId(model.defaults.revocationModeId);
    setIncidentConditionId(model.defaults.incidentConditionId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Session and incident lab"
          title={model.title}
          description={model.description}
          icon={Network}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Refresh strategy
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.refreshStrategies.map((strategy) => (
                    <LabChoice
                      key={strategy.id}
                      selected={strategy.id === refreshStrategy.id}
                      label={strategy.label}
                      detail={strategy.detail}
                      icon={strategy.id === 'none' ? TimerReset : RotateCcwKey}
                      accent="violet"
                      onClick={() => setRefreshStrategyId(strategy.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <SelectControl
                label="Incident condition"
                value={incident.id}
                options={model.incidentConditions}
                onChange={setIncidentConditionId}
              />
              <SelectControl
                label="Revocation enforcement"
                value={revocationMode.id}
                options={model.revocationModes}
                onChange={setRevocationModeId}
              />

              <LabRange
                label="Access-token lifetime"
                value={accessLifetimeMinutes}
                output={`${accessLifetimeMinutes}m`}
                min={model.limits.accessLifetimeMinutes.min}
                max={model.limits.accessLifetimeMinutes.max}
                step={model.limits.accessLifetimeMinutes.step}
                lowLabel="Shorter bearer window"
                highLabel="Fewer renewals"
                accent="violet"
                onChange={setAccessLifetimeMinutes}
              />
              <LabRange
                label="Session ceiling"
                value={sessionLifetimeHours}
                output={`${sessionLifetimeHours}h`}
                min={model.limits.sessionLifetimeHours.min}
                max={model.limits.sessionLifetimeHours.max}
                step={model.limits.sessionLifetimeHours.step}
                lowLabel="Frequent sign-in"
                highLabel="Longer grant exposure"
                accent="violet"
                onChange={setSessionLifetimeHours}
              />
              <LabRange
                label="Old-key overlap"
                value={keyOverlapMinutes}
                output={`${keyOverlapMinutes}m`}
                min={model.limits.keyOverlapMinutes.min}
                max={model.limits.keyOverlapMinutes.max}
                step={model.limits.keyOverlapMinutes.step}
                lowLabel="Fast retirement"
                highLabel="Long verification overlap"
                accent="violet"
                onChange={setKeyOverlapMinutes}
              />
              <LabRange
                label="Revocation propagation"
                value={revocationPropagationMinutes}
                output={`${revocationPropagationMinutes}m`}
                min={model.limits.revocationPropagationMinutes.min}
                max={model.limits.revocationPropagationMinutes.max}
                step={model.limits.revocationPropagationMinutes.step}
                lowLabel="Fast distribution"
                highLabel="More stale access"
                accent="violet"
                onChange={setRevocationPropagationMinutes}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <ArchitectureVerdict result={result} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Stale-access window"
                value={`≤ ${result.staleAccessMinutes}m`}
                detail={result.staleAccessDetail}
                icon={Clock3}
                tone={result.staleAccessMinutes === accessLifetimeMinutes ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Rotation gap"
                value={`${result.rotationGapMinutes}m`}
                detail={result.rotationGapMinutes > 0
                  ? 'Old-key tokens can fail before their configured expiry.'
                  : 'Overlap covers the configured access-token lifetime.'}
                icon={KeyRound}
                tone={result.rotationGapMinutes > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Session ceiling"
                value={`${sessionLifetimeHours}h`}
                detail="Upper bound selected for refresh-backed continuity."
                icon={TimerReset}
                tone="neutral"
              />
              <LabMetric
                label="Refresh replay"
                value={refreshStrategy.label}
                detail={result.refreshBoundary}
                icon={RotateCcwKey}
                tone={refreshStrategy.id === 'reusable' ? 'rose' : 'violet'}
              />
            </div>

            <ArchitecturePath
              accessLifetimeMinutes={accessLifetimeMinutes}
              sessionLifetimeHours={sessionLifetimeHours}
              refreshStrategy={refreshStrategy}
              revocationMode={revocationMode}
            />

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
                <div className="flex items-center gap-2">
                  <ShieldAlert aria-hidden="true" className="h-5 w-5" />
                  <h4 className="text-sm font-semibold">Explicit blast radius</h4>
                </div>
                <p className="mt-3 text-sm leading-6">{result.blastRadius}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
                <div className="flex items-center gap-2">
                  <BadgeCheck aria-hidden="true" className="h-5 w-5" />
                  <h4 className="text-sm font-semibold">Operational decision</h4>
                </div>
                <p className="mt-3 text-sm leading-6">{result.decision}</p>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Model assumptions
              </h4>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600 marker:text-neutral-400 dark:text-neutral-300">
                {model.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function staleDetail(
  revocationMode: RevocationMode,
  accessLifetimeMinutes: number,
  propagationMinutes: number,
) {
  if (revocationMode.id === 'offline') {
    return `Offline verification has no revocation lookup; the planning bound is the ${accessLifetimeMinutes}-minute access lifetime.`;
  }

  return `After revocation is recorded, the model uses the smaller of access lifetime and ${propagationMinutes}-minute propagation.`;
}

function SelectControl<T extends Choice>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: T[];
  onChange: (value: string) => void;
}) {
  const selected = findById(options, value);

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function ArchitectureVerdict({ result }: { result: ArchitectureResult }) {
  const styles = result.severity === 'healthy'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.severity === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50';
  const VerdictIcon = result.severity === 'healthy'
    ? ShieldCheck
    : result.severity === 'warning'
      ? AlertTriangle
      : ShieldAlert;

  return (
    <section className={`rounded-md border p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase opacity-75">
            Architecture consequence
          </p>
          <h4 className="mt-1 text-lg font-semibold">{result.headline}</h4>
          <p className="mt-2 text-sm leading-6 opacity-80">{result.decision}</p>
        </div>
      </div>
    </section>
  );
}

function ArchitecturePath({
  accessLifetimeMinutes,
  sessionLifetimeHours,
  refreshStrategy,
  revocationMode,
}: {
  accessLifetimeMinutes: number;
  sessionLifetimeHours: number;
  refreshStrategy: RefreshStrategy;
  revocationMode: RevocationMode;
}) {
  const stages = [
    {
      label: 'Authorization server',
      value: `${sessionLifetimeHours}h session ceiling`,
      detail: 'Owns the grant, refresh state, signing keys, and revocation decision.',
      icon: Network,
    },
    {
      label: 'Refresh boundary',
      value: refreshStrategy.label,
      detail: refreshStrategy.replayBoundary,
      icon: RotateCcwKey,
    },
    {
      label: 'Access credential',
      value: `${accessLifetimeMinutes}m bearer lifetime`,
      detail: 'Carries claims for one audience; it is not the session database.',
      icon: Gauge,
    },
    {
      label: 'Resource server',
      value: revocationMode.label,
      detail: revocationMode.availabilityPosture,
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
      <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
        State and request path
      </h4>
      <ol className="mt-4 grid gap-3 lg:grid-cols-4">
        {stages.map((stage, index) => {
          const StageIcon = stage.icon;
          return (
            <li
              key={stage.label}
              className="relative min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <StageIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {index + 1}. {stage.label}
              </div>
              <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
                {stage.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                {stage.detail}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LabLoadState({
  detail,
  error,
  onRetry,
}: {
  detail: string;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Session and incident lab"
          title="Load the session architecture model"
          description="The lesson-owned lifecycle and incident assumptions are loaded from co-located JSON."
          icon={Network}
          accent="violet"
        />
        <LearningLabBody>
          <div
            className={`flex min-h-72 flex-col items-center justify-center rounded-md border px-6 text-center ${
              error
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'animate-pulse border-neutral-200 bg-neutral-50 text-neutral-700 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
            }`}
            role={error ? 'alert' : 'status'}
          >
            {error ? (
              <CircleAlert aria-hidden="true" className="h-7 w-7" />
            ) : (
              <Network aria-hidden="true" className="h-7 w-7" />
            )}
            <p className="mt-3 text-sm font-semibold">
              {error ? 'Session architecture model unavailable' : 'Loading session boundaries'}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 opacity-80">{detail}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
