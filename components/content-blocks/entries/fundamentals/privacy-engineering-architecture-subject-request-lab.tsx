'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FolderSearch2,
  Gavel,
  LoaderCircle,
  ScanSearch,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/privacy-engineering-architecture-subject-request-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/privacy-engineering-architecture/data/subject-request-model.json';

type PrivacyRequest = {
  id: string;
  label: string;
  detail: string;
  deadlineDays: number;
  action: string;
};

type DataEstate = {
  id: string;
  label: string;
  detail: string;
  systems: number;
  mappedSystems: number;
  derivedCopies: number;
  vendorCopies: number;
  backupDays: number;
};

type SubjectRequestModel = {
  kind: 'privacy-subject-request';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    requestId: string;
    estateId: string;
    legalHold: boolean;
  };
  requests: PrivacyRequest[];
  estates: DataEstate[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRequest(value: unknown): value is PrivacyRequest {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.deadlineDays)
    && value.deadlineDays > 0
    && typeof value.action === 'string';
}

function isEstate(value: unknown): value is DataEstate {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && isFiniteNumber(value.systems)
    && isFiniteNumber(value.mappedSystems)
    && isFiniteNumber(value.derivedCopies)
    && isFiniteNumber(value.vendorCopies)
    && isFiniteNumber(value.backupDays)
    && value.systems > 0
    && value.mappedSystems >= 0
    && value.mappedSystems <= value.systems;
}

function isSubjectRequestModel(value: unknown): value is SubjectRequestModel {
  if (!isRecord(value) || !isRecord(value.defaults)) return false;
  const defaults = value.defaults;

  return value.kind === 'privacy-subject-request'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof defaults.requestId === 'string'
    && typeof defaults.estateId === 'string'
    && typeof defaults.legalHold === 'boolean'
    && Array.isArray(value.requests)
    && value.requests.length >= 2
    && value.requests.every(isRequest)
    && value.requests.some((item) => item.id === defaults.requestId)
    && Array.isArray(value.estates)
    && value.estates.length >= 2
    && value.estates.every(isEstate)
    && value.estates.some((item) => item.id === defaults.estateId)
    && typeof value.notice === 'string';
}

export default function PrivacyEngineeringSubjectRequestLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SubjectRequestModel | null>(null);
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
        if (!isSubjectRequestModel(payload)) {
          throw new Error('The subject-request model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the subject-request model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <SubjectRequestWorkbench model={model} />;
}

function SubjectRequestWorkbench({ model }: { model: SubjectRequestModel }) {
  const [requestId, setRequestId] = useState(model.defaults.requestId);
  const [estateId, setEstateId] = useState(model.defaults.estateId);
  const [legalHold, setLegalHold] = useState(model.defaults.legalHold);

  const request =
    model.requests.find((item) => item.id === requestId) ?? model.requests[0];
  const estate =
    model.estates.find((item) => item.id === estateId) ?? model.estates[0];

  const result = useMemo(() => {
    const unmapped = estate.systems - estate.mappedSystems;
    const coverage = estate.mappedSystems / estate.systems;
    const legalException = request.id === 'delete' && legalHold;
    const backupPending = request.id === 'delete' ? 1 : 0;
    const pendingCopies = unmapped + estate.vendorCopies + backupPending
      + (legalException ? 1 : 0);
    const discoveryDays = unmapped * 4 + estate.vendorCopies * 2;
    const baseDays = request.id === 'withdraw' ? 1 : 5;
    const completionDays = baseDays + discoveryDays;
    const missesDeadline = completionDays > request.deadlineDays;
    const complete = unmapped === 0 && !missesDeadline;

    return {
      complete,
      completionDays,
      coverage,
      legalException,
      missesDeadline,
      pendingCopies,
      unmapped,
    };
  }, [estate, legalHold, request]);

  const reset = () => {
    setRequestId(model.defaults.requestId);
    setEstateId(model.defaults.estateId);
    setLegalHold(model.defaults.legalHold);
  };

  const outcome = result.unmapped > 0
    ? {
        title: 'The request cannot be proven complete',
        detail: `${result.unmapped} system${result.unmapped === 1 ? '' : 's'} lack registered lineage or ownership.`,
        tone: 'rose' as const,
        icon: ShieldAlert,
      }
    : result.missesDeadline
      ? {
          title: 'The workflow misses its response deadline',
          detail: 'Discovery and vendor coordination take longer than the selected request allows.',
          tone: 'amber' as const,
          icon: Clock3,
        }
      : result.legalException
        ? {
            title: 'Eligible data is removed; the hold remains explicit',
            detail: 'The completion record must identify the held record, legal authority, access restriction, and review date.',
            tone: 'blue' as const,
            icon: Gavel,
          }
        : {
            title: 'The workflow can produce defensible completion evidence',
            detail: 'Every system has an owner, the action is bounded, and residual backup handling is documented.',
            tone: 'emerald' as const,
            icon: CheckCircle2,
          };
  const OutcomeIcon = outcome.icon;

  const stages = [
    {
      label: 'Verify',
      detail: 'Identity and authority',
      state: 'done' as const,
      icon: UserRoundCheck,
    },
    {
      label: 'Discover',
      detail: `${estate.mappedSystems}/${estate.systems} systems mapped`,
      state: result.unmapped > 0 ? 'blocked' as const : 'done' as const,
      icon: ScanSearch,
    },
    {
      label: 'Execute',
      detail: request.action,
      state: result.unmapped > 0 ? 'waiting' as const : 'done' as const,
      icon: request.id === 'delete' ? Trash2 : FileCheck2,
    },
    {
      label: 'Prove',
      detail: result.complete ? 'Evidence sealed' : 'Evidence incomplete',
      state: result.complete ? 'done' as const : 'waiting' as const,
      icon: FileCheck2,
    },
  ];

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Subject-request completion lab"
          title="Can the system prove the request is finished?"
          description={model.description}
          icon={FolderSearch2}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <ControlGroup label="1. Request">
                {model.requests.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === request.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'delete' ? Trash2 : FileCheck2}
                    accent="violet"
                    onClick={() => setRequestId(item.id)}
                  />
                ))}
              </ControlGroup>

              <ControlGroup label="2. Data estate">
                {model.estates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === estate.id}
                    label={item.label}
                    detail={item.detail}
                    icon={FolderSearch2}
                    accent="blue"
                    onClick={() => setEstateId(item.id)}
                  />
                ))}
              </ControlGroup>

              <ControlGroup label="3. Retention exception">
                <LabChoice
                  selected={!legalHold}
                  label="No legal hold"
                  detail="Eligible records follow the normal request workflow."
                  icon={CheckCircle2}
                  accent="emerald"
                  onClick={() => setLegalHold(false)}
                />
                <LabChoice
                  selected={legalHold}
                  label="Documented legal hold"
                  detail="A narrow record must remain restricted until the hold expires."
                  icon={Gavel}
                  accent="amber"
                  onClick={() => setLegalHold(true)}
                />
              </ControlGroup>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            outcome.tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : outcome.tone === 'rose'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                : outcome.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35'
          }`}>
            <div className="flex items-start gap-3">
              <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Observed outcome</p>
                <h4 className="mt-1 text-lg font-semibold">{outcome.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Lineage coverage"
              value={`${Math.round(result.coverage * 100)}%`}
              detail={`${estate.mappedSystems} of ${estate.systems} systems`}
              icon={ScanSearch}
              tone={result.coverage === 1 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Completion"
              value={`${result.completionDays}d`}
              detail={`${request.deadlineDays}-day deadline`}
              icon={Clock3}
              tone={result.missesDeadline ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Copies pending"
              value={String(result.pendingCopies)}
              detail="Vendors, unknown systems, backup, or hold"
              icon={ArchiveRestore}
              tone={result.pendingCopies > 2 ? 'rose' : 'neutral'}
            />
            <LabMetric
              label="Backup expiry"
              value={`${estate.backupDays}d`}
              detail="Logically deleted and access-blocked until rotation"
              icon={ArchiveRestore}
              tone="violet"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Request execution trace
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.label}
                    className={`relative rounded-md border p-4 ${
                      stage.state === 'done'
                        ? 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50'
                        : stage.state === 'blocked'
                          ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-current text-xs font-semibold">
                        {index + 1}
                      </span>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">{stage.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <EvidenceItem
              ready
              title="Request ledger"
              detail="Identity proof, policy version, deadline, owner, and event timestamps."
            />
            <EvidenceItem
              ready={result.unmapped === 0}
              title="Lineage manifest"
              detail={result.unmapped === 0
                ? 'Every primary, derived, vendor, and backup location has a recorded action.'
                : `${result.unmapped} system owner${result.unmapped === 1 ? ' is' : 's are'} still unknown.`}
            />
            <EvidenceItem
              ready={!result.missesDeadline}
              title="Completion receipt"
              detail={result.missesDeadline
                ? 'The estimated workflow exceeds the response deadline.'
                : 'Each executor signs its action and the coordinator seals the final result.'}
            />
            <EvidenceItem
              ready={!result.legalException || request.id !== 'delete'}
              title="Exception register"
              detail={result.legalException && request.id === 'delete'
                ? 'Record the legal authority, held fields, access restriction, and expiry review.'
                : 'No active exception changes the selected request.'}
            />
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

function EvidenceItem({
  ready,
  title,
  detail,
}: {
  ready: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className={`rounded-md border p-4 ${
      ready
        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
        : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    }`}>
      <div className="flex items-center gap-2">
        {ready
          ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          : <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
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
                  Subject-request model unavailable
                </p>
                <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-violet-500" />
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Loading the request workflow...
                </p>
              </>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
