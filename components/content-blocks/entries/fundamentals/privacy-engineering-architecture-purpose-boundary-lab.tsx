'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Database,
  FileKey2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/privacy-engineering-architecture-purpose-boundary-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/privacy-engineering-architecture/data/purpose-boundary-model.json';

type Purpose = {
  id: string;
  label: string;
  detail: string;
  lawfulBasis: string;
  retentionDays: number;
  requiresConsent: boolean;
  allowedFields: string[];
};

type DataPackage = {
  id: string;
  label: string;
  detail: string;
  fields: string[];
};

type PurposeBoundaryModel = {
  kind: 'privacy-purpose-boundary';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    purposeId: string;
    packageId: string;
    consentActive: boolean;
  };
  purposes: Purpose[];
  packages: DataPackage[];
  fieldLabels: Record<string, string>;
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPurpose(value: unknown): value is Purpose {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.lawfulBasis === 'string'
    && typeof value.retentionDays === 'number'
    && typeof value.requiresConsent === 'boolean'
    && isStringArray(value.allowedFields);
}

function isDataPackage(value: unknown): value is DataPackage {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isStringArray(value.fields);
}

function isPurposeBoundaryModel(value: unknown): value is PurposeBoundaryModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.fieldLabels)) {
    return false;
  }
  const defaults = value.defaults;

  return value.kind === 'privacy-purpose-boundary'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof defaults.purposeId === 'string'
    && typeof defaults.packageId === 'string'
    && typeof defaults.consentActive === 'boolean'
    && Array.isArray(value.purposes)
    && value.purposes.length >= 2
    && value.purposes.every(isPurpose)
    && value.purposes.some((item) => item.id === defaults.purposeId)
    && Array.isArray(value.packages)
    && value.packages.length >= 2
    && value.packages.every(isDataPackage)
    && value.packages.some((item) => item.id === defaults.packageId)
    && Object.values(value.fieldLabels).every((item) => typeof item === 'string')
    && typeof value.notice === 'string';
}

export default function PrivacyEngineeringPurposeBoundaryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PurposeBoundaryModel | null>(null);
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
        if (!isPurposeBoundaryModel(payload)) {
          throw new Error('The purpose-boundary model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the purpose-boundary model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <PurposeBoundaryWorkbench model={model} />;
}

function PurposeBoundaryWorkbench({ model }: { model: PurposeBoundaryModel }) {
  const [purposeId, setPurposeId] = useState(model.defaults.purposeId);
  const [packageId, setPackageId] = useState(model.defaults.packageId);
  const [consentActive, setConsentActive] = useState(model.defaults.consentActive);

  const purpose =
    model.purposes.find((item) => item.id === purposeId) ?? model.purposes[0];
  const dataPackage =
    model.packages.find((item) => item.id === packageId) ?? model.packages[0];

  const result = useMemo(() => {
    const consentBlocked = purpose.requiresConsent && !consentActive;
    const allowed = consentBlocked
      ? []
      : dataPackage.fields.filter((field) => purpose.allowedFields.includes(field));
    const excess = dataPackage.fields.filter(
      (field) => !purpose.allowedFields.includes(field),
    );
    const status = consentBlocked ? 'blocked' : excess.length > 0 ? 'review' : 'allowed';

    return {
      allowed,
      consentBlocked,
      excess,
      status,
    };
  }, [consentActive, dataPackage.fields, purpose]);

  const reset = () => {
    setPurposeId(model.defaults.purposeId);
    setPackageId(model.defaults.packageId);
    setConsentActive(model.defaults.consentActive);
  };

  const statusCopy = result.status === 'allowed'
    ? {
        title: 'The request stays inside its declared purpose',
        detail: 'Every proposed field is necessary for this workflow, and the lawful basis is active.',
        tone: 'emerald' as const,
        icon: CheckCircle2,
      }
    : result.status === 'blocked'
      ? {
          title: 'Processing must stop at the policy boundary',
          detail: 'This purpose depends on consent, and the current preference no longer authorizes it.',
          tone: 'rose' as const,
          icon: Ban,
        }
      : {
          title: 'Minimize the package before processing',
          detail: `${result.excess.length} proposed field${result.excess.length === 1 ? '' : 's'} exceed the selected purpose.`,
          tone: 'amber' as const,
          icon: TriangleAlert,
        };

  const StatusIcon = statusCopy.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Purpose boundary lab"
          title="Can this data cross the boundary?"
          description={model.description}
          icon={FileKey2}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <ControlGroup label="1. Processing purpose">
                {model.purposes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === purpose.id}
                    label={item.label}
                    detail={item.detail}
                    icon={FileKey2}
                    accent="cyan"
                    onClick={() => setPurposeId(item.id)}
                  />
                ))}
              </ControlGroup>

              <ControlGroup label="2. Proposed data">
                {model.packages.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === dataPackage.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Database}
                    accent="blue"
                    onClick={() => setPackageId(item.id)}
                  />
                ))}
              </ControlGroup>

              <ControlGroup label="3. Consent state">
                <LabChoice
                  selected={consentActive}
                  label="Consent active"
                  detail="The current preference permits consent-based processing."
                  icon={UserCheck}
                  accent="emerald"
                  onClick={() => setConsentActive(true)}
                />
                <LabChoice
                  selected={!consentActive}
                  label="Consent withdrawn"
                  detail="New processing must stop and downstream grants must be revoked."
                  icon={Ban}
                  accent="rose"
                  onClick={() => setConsentActive(false)}
                />
              </ControlGroup>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            result.status === 'allowed'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : result.status === 'blocked'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
          }`}>
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Policy decision</p>
                <h4 className="mt-1 text-lg font-semibold">{statusCopy.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{statusCopy.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Allowed fields"
              value={String(result.allowed.length)}
              detail={`${dataPackage.fields.length} proposed`}
              icon={ShieldCheck}
              tone={result.allowed.length > 0 ? 'emerald' : 'neutral'}
            />
            <LabMetric
              label="Excess fields"
              value={String(result.excess.length)}
              detail="Must be removed or separately justified"
              icon={TriangleAlert}
              tone={result.excess.length > 0 ? 'amber' : 'neutral'}
            />
            <LabMetric
              label="Retention"
              value={`${purpose.retentionDays}d`}
              detail={`${purpose.lawfulBasis} basis`}
              icon={LockKeyhole}
              tone="blue"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Enforced request path
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
              <FlowNode label="Declare" detail={purpose.label} state="active" />
              <ArrowRight aria-hidden="true" className="hidden h-4 w-4 text-neutral-400 md:block" />
              <FlowNode
                label="Authorize"
                detail={result.consentBlocked ? 'Consent missing' : purpose.lawfulBasis}
                state={result.consentBlocked ? 'blocked' : 'active'}
              />
              <ArrowRight aria-hidden="true" className="hidden h-4 w-4 text-neutral-400 md:block" />
              <FlowNode
                label="Minimize"
                detail={`${result.allowed.length}/${dataPackage.fields.length} fields`}
                state={result.excess.length > 0 ? 'warning' : 'active'}
              />
              <ArrowRight aria-hidden="true" className="hidden h-4 w-4 text-neutral-400 md:block" />
              <FlowNode
                label="Process"
                detail={result.status === 'allowed' ? 'Permitted' : 'Gate closed'}
                state={result.status === 'allowed' ? 'active' : 'blocked'}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Field-level decision
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {dataPackage.fields.map((field) => {
                const permitted = !result.consentBlocked && purpose.allowedFields.includes(field);
                return (
                  <div
                    key={field}
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                      permitted
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                        : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    }`}
                  >
                    <span className="font-medium">{model.fieldLabels[field] ?? field}</span>
                    <span className="text-xs font-semibold uppercase">
                      {permitted ? 'allow' : 'block'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            {model.notice}
          </p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FlowNode({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: 'active' | 'warning' | 'blocked';
}) {
  const styles = state === 'active'
    ? 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50'
    : state === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            {error ? (
              <>
                <TriangleAlert aria-hidden="true" className="h-6 w-6 text-rose-500" />
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Purpose model unavailable
                </p>
                <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-cyan-500" />
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Loading the purpose policy...
                </p>
              </>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
