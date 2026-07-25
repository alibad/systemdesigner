'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Code2,
  Database,
  KeyRound,
  LoaderCircle,
  PackageCheck,
  Rocket,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type AuthorizationOption = {
  id: string;
  label: string;
  detail: string;
  clientAccess: string;
  ownershipBound: boolean;
  audit: 'pass' | 'warn' | 'blocked';
  consequence: string;
};

type MigrationOption = {
  id: string;
  label: string;
  detail: string;
  productionRisk: 'low' | 'high';
  consequence: string;
};

type ConnectorChange = {
  id: string;
  label: string;
  detail: string;
  compatibility: 'compatible' | 'warning' | 'breaking';
  sdkAction: string;
  consequence: string;
};

type AuthorizationDeploymentModel = {
  kind: 'authorization-deployment';
  title: string;
  description: string;
  defaults: {
    authorizationId: string;
    migrationId: string;
    connectorChangeId: string;
  };
  authorizationOptions: AuthorizationOption[];
  migrationOptions: MigrationOption[];
  connectorChanges: ConnectorChange[];
};

const BLOCK_ID = 'technology/firebase-data-connect-authorization-deployment-lab';

function isAuthorizationDeploymentModel(value: unknown): value is AuthorizationDeploymentModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthorizationDeploymentModel>;
  return Boolean(
    candidate.kind === 'authorization-deployment'
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults?.authorizationId
      && candidate.defaults.migrationId
      && candidate.defaults.connectorChangeId
      && Array.isArray(candidate.authorizationOptions)
      && candidate.authorizationOptions.length > 0
      && candidate.authorizationOptions.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.clientAccess === 'string'
        && typeof item.ownershipBound === 'boolean'
        && ['pass', 'warn', 'blocked'].includes(item.audit)
        && typeof item.consequence === 'string')
      && Array.isArray(candidate.migrationOptions)
      && candidate.migrationOptions.length > 0
      && candidate.migrationOptions.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && ['low', 'high'].includes(item.productionRisk)
        && typeof item.consequence === 'string')
      && Array.isArray(candidate.connectorChanges)
      && candidate.connectorChanges.length > 0
      && candidate.connectorChanges.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && ['compatible', 'warning', 'breaking'].includes(item.compatibility)
        && typeof item.sdkAction === 'string'
        && typeof item.consequence === 'string'),
  );
}

export default function FirebaseDataConnectAuthorizationDeploymentLab({
  dataFile,
  model,
}: {
  dataFile?: string;
  model?: unknown;
}) {
  const [loadedModel, setLoadedModel] = useState<unknown>(model ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (model !== undefined) {
      setLoadedModel(model);
      setLoadError(null);
      return;
    }

    if (!dataFile) {
      setLoadedModel(null);
      setLoadError('No authorization and deployment model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadedModel(null);
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(setLoadedModel)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the release model.');
      });

    return () => controller.abort();
  }, [dataFile, model]);

  if (loadError) {
    return <ModelError message={loadError} />;
  }
  if (!loadedModel) {
    return <ModelLoading label="Loading the authorization and deployment model..." />;
  }
  if (!isAuthorizationDeploymentModel(loadedModel)) {
    return <ModelError message="The authorization and deployment model is invalid." />;
  }
  return <ReleaseWorkbench model={loadedModel} />;
}

function ReleaseWorkbench({ model }: { model: AuthorizationDeploymentModel }) {
  const [authorizationId, setAuthorizationId] = useState(model.defaults.authorizationId);
  const [migrationId, setMigrationId] = useState(model.defaults.migrationId);
  const [connectorChangeId, setConnectorChangeId] = useState(model.defaults.connectorChangeId);

  const authorization = model.authorizationOptions.find((item) => item.id === authorizationId)
    ?? model.authorizationOptions[0];
  const migration = model.migrationOptions.find((item) => item.id === migrationId)
    ?? model.migrationOptions[0];
  const connectorChange = model.connectorChanges.find((item) => item.id === connectorChangeId)
    ?? model.connectorChanges[0];

  const result = useMemo(() => {
    const blockers: string[] = [];
    const cautions: string[] = [];

    if (authorization.audit === 'blocked') blockers.push(authorization.consequence);
    if (authorization.audit === 'warn') cautions.push(authorization.consequence);
    if (migration.productionRisk === 'high') blockers.push(migration.consequence);
    if (connectorChange.compatibility === 'breaking') blockers.push(connectorChange.consequence);
    if (connectorChange.compatibility === 'warning') cautions.push(connectorChange.consequence);

    if (blockers.length) {
      return {
        blockers,
        cautions,
        label: 'Hold release',
        tone: 'rose' as const,
        title: 'The selected deployment crosses a production safety boundary',
        detail: blockers[0],
      };
    }

    if (cautions.length) {
      return {
        blockers,
        cautions,
        label: 'Review',
        tone: 'amber' as const,
        title: 'The release needs explicit review and staged evidence',
        detail: cautions[0],
      };
    }

    return {
      blockers,
      cautions,
      label: 'Ready',
      tone: 'emerald' as const,
      title: 'The contract can move through a bounded production release',
      detail: 'Authorization is resource-bound, the migration preserves unrelated production data, and the connector remains compatible with deployed clients.',
    };
  }, [authorization, connectorChange, migration]);

  const reset = () => {
    setAuthorizationId(model.defaults.authorizationId);
    setMigrationId(model.defaults.migrationId);
    setConnectorChangeId(model.defaults.connectorChangeId);
  };

  const releaseSteps = [
    {
      label: 'Audit auth',
      detail: authorization.clientAccess,
      state: authorization.audit === 'pass' ? 'pass' : authorization.audit,
      icon: ShieldCheck,
    },
    {
      label: 'Diff and migrate',
      detail: migration.label,
      state: migration.productionRisk === 'low' ? 'pass' : 'blocked',
      icon: Database,
    },
    {
      label: 'Deploy connector',
      detail: connectorChange.compatibility,
      state: connectorChange.compatibility === 'compatible' ? 'pass' : connectorChange.compatibility === 'warning' ? 'warn' : 'blocked',
      icon: CloudCog,
    },
    {
      label: 'Regenerate SDK',
      detail: connectorChange.sdkAction,
      state: connectorChange.compatibility === 'breaking' ? 'warn' : 'pass',
      icon: Code2,
    },
    {
      label: 'Observe',
      detail: 'Requests, errors, operation rate, PostgreSQL health',
      state: result.blockers.length ? 'waiting' : 'pass',
      icon: Rocket,
    },
  ] as const;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Authorization and release control"
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
                label="1. Operation authorization"
                items={model.authorizationOptions}
                selectedId={authorization.id}
                icon={ShieldCheck}
                accent="amber"
                onSelect={setAuthorizationId}
              />
              <ChoiceGroup
                label="2. Schema migration mode"
                items={model.migrationOptions}
                selectedId={migration.id}
                icon={Database}
                accent="blue"
                onSelect={setMigrationId}
              />
              <ChoiceGroup
                label="3. Connector change"
                items={model.connectorChanges}
                selectedId={connectorChange.id}
                icon={PackageCheck}
                accent="violet"
                onSelect={setConnectorChangeId}
              />
            </div>
          )}
        >
          <div className="min-w-0" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Release decision"
                value={result.label}
                detail={`${result.blockers.length} blocker${result.blockers.length === 1 ? '' : 's'}, ${result.cautions.length} caution${result.cautions.length === 1 ? '' : 's'}`}
                icon={Rocket}
                tone={result.tone}
              />
              <LabMetric
                label="Client boundary"
                value={authorization.clientAccess}
                detail={authorization.ownershipBound ? 'Resource ownership enforced' : 'No ownership filter'}
                icon={ShieldCheck}
                tone={authorization.audit === 'pass' ? 'emerald' : authorization.audit === 'warn' ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Migration risk"
                value={migration.productionRisk === 'low' ? 'Bounded' : 'Destructive'}
                detail={migration.label}
                icon={Database}
                tone={migration.productionRisk === 'low' ? 'blue' : 'rose'}
              />
              <LabMetric
                label="SDK contract"
                value={connectorChange.compatibility === 'compatible' ? 'Stable' : connectorChange.compatibility === 'warning' ? 'Review' : 'Breaking'}
                detail={connectorChange.sdkAction}
                icon={Code2}
                tone={connectorChange.compatibility === 'compatible' ? 'emerald' : connectorChange.compatibility === 'warning' ? 'amber' : 'rose'}
              />
            </div>

            <section className={`mt-5 rounded-md border p-4 ${result.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : result.tone === 'amber' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{result.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Release path
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr)_auto)_minmax(0,1fr)] lg:items-stretch">
                {releaseSteps.map((step, index) => (
                  <div key={step.label} className="contents">
                    <ReleaseStep {...step} />
                    {index < releaseSteps.length - 1 ? <ReleaseArrow /> : null}
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Consequence title="Authorization consequence" icon={ShieldCheck}>
                {authorization.consequence}
              </Consequence>
              <Consequence title="Migration consequence" icon={Database}>
                {migration.consequence}
              </Consequence>
              <Consequence title="Connector consequence" icon={Code2}>
                {connectorChange.consequence}
              </Consequence>
            </div>

            <div className="mt-5 border-l-4 border-violet-500 bg-violet-50 px-4 py-3 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50">
              <p className="text-sm font-semibold">Recovery boundary</p>
              <p className="mt-1 text-sm leading-6 opacity-80">
                Redeploying an earlier connector can restore an API contract. It cannot recover rows or columns removed by a destructive SQL migration; backups and a tested restore path remain Cloud SQL responsibilities.
              </p>
            </div>
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
  accent: 'amber' | 'blue' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ReleaseStep({
  label,
  detail,
  state,
  icon: Icon,
}: {
  label: string;
  detail: string;
  state: 'pass' | 'warn' | 'blocked' | 'waiting';
  icon: LucideIcon;
}) {
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
    warn: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
    blocked: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
    waiting: 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300',
  } as const;

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[state]}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {state === 'pass' ? (
          <Check aria-label="Pass" className="h-4 w-4 shrink-0" />
        ) : state === 'blocked' ? (
          <CircleAlert aria-label="Blocked" className="h-4 w-4 shrink-0" />
        ) : state === 'warn' ? (
          <TriangleAlert aria-label="Review" className="h-4 w-4 shrink-0" />
        ) : (
          <span className="text-xs font-semibold uppercase">Wait</span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function ReleaseArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 lg:hidden" />
      <ArrowRight className="hidden h-5 w-5 lg:block" />
    </div>
  );
}

function Consequence({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{children}</p>
    </div>
  );
}

function ModelError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      {message}
    </div>
  );
}

function ModelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}
