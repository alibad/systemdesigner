'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive,
  CheckCircle2,
  Cloud,
  Database,
  FileStack,
  GitBranch,
  HardDrive,
  Link2,
  LoaderCircle,
  TriangleAlert,
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

const BLOCK_ID = 'technology/dvc-data-versioning-artifact-placement-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/dvc-data-versioning/data/artifact-placement-model.json';

type Dataset = {
  id: string;
  label: string;
  detail: string;
  sizeGb: number;
  fileCount: number;
  changeBoundary: string;
};

type CacheMode = {
  id: string;
  label: string;
  detail: string;
  workspaceCopyFactor: number;
  caveat: string;
};

type RemoteState = {
  id: string;
  label: string;
  detail: string;
  retainedVersionLimit: number | null;
  durable: boolean;
};

type ArtifactPlacementModel = {
  kind: 'dvc-artifact-placement';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    datasetId: string;
    versionCount: number;
    changedPercent: number;
    cacheModeId: string;
    remoteStateId: string;
  };
  datasets: Dataset[];
  cacheModes: CacheMode[];
  remoteStates: RemoteState[];
  bounds: {
    versionCount: { min: number; max: number; step: number };
    changedPercent: { min: number; max: number; step: number };
  };
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isArtifactPlacementModel(value: unknown): value is ArtifactPlacementModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'dvc-artifact-placement'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.datasets)
      && value.datasets.length >= 3
      && Array.isArray(value.cacheModes)
      && value.cacheModes.length >= 3
      && Array.isArray(value.remoteStates)
      && value.remoteStates.length >= 3
      && isRecord(value.bounds)
      && typeof value.notice === 'string',
  );
}

export default function DVCDataVersioningArtifactPlacementLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ArtifactPlacementModel | null>(null);
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
        if (!isArtifactPlacementModel(payload)) {
          throw new Error('The DVC artifact placement model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the artifact placement model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ArtifactPlacementWorkbench model={model} />;
}

function ArtifactPlacementWorkbench({ model }: { model: ArtifactPlacementModel }) {
  const [datasetId, setDatasetId] = useState(model.defaults.datasetId);
  const [versionCount, setVersionCount] = useState(model.defaults.versionCount);
  const [changedPercent, setChangedPercent] = useState(model.defaults.changedPercent);
  const [cacheModeId, setCacheModeId] = useState(model.defaults.cacheModeId);
  const [remoteStateId, setRemoteStateId] = useState(model.defaults.remoteStateId);

  const dataset =
    model.datasets.find((item) => item.id === datasetId) ?? model.datasets[0];
  const cacheMode =
    model.cacheModes.find((item) => item.id === cacheModeId) ?? model.cacheModes[0];
  const remoteState =
    model.remoteStates.find((item) => item.id === remoteStateId)
    ?? model.remoteStates[0];

  const result = useMemo(() => {
    const effectiveChangedPercent = dataset.fileCount === 1 ? 100 : changedPercent;
    const changedGb = dataset.sizeGb * (effectiveChangedPercent / 100);
    const uniqueContentGb = dataset.sizeGb + changedGb * (versionCount - 1);
    const naiveHistoryGb = dataset.sizeGb * versionCount;
    const workspaceGb = dataset.sizeGb * cacheMode.workspaceCopyFactor;
    const localFootprintGb = uniqueContentGb + workspaceGb;
    const retainedVersions =
      remoteState.retainedVersionLimit === null
        ? versionCount
        : Math.min(versionCount, remoteState.retainedVersionLimit);
    const historyComplete = retainedVersions === versionCount;
    const reusedPercent = Math.max(0, 100 - effectiveChangedPercent);

    return {
      changedGb,
      effectiveChangedPercent,
      historyComplete,
      localFootprintGb,
      naiveHistoryGb,
      retainedVersions,
      reusedPercent,
      uniqueContentGb,
      workspaceGb,
    };
  }, [cacheMode, changedPercent, dataset, remoteState, versionCount]);

  function reset() {
    setDatasetId(model.defaults.datasetId);
    setVersionCount(model.defaults.versionCount);
    setChangedPercent(model.defaults.changedPercent);
    setCacheModeId(model.defaults.cacheModeId);
    setRemoteStateId(model.defaults.remoteStateId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Artifact placement lab"
          title={model.title}
          description={model.description}
          icon={Archive}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose an artifact shape">
                {model.datasets.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === dataset.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.fileCount === 1 ? Archive : FileStack}
                    accent="blue"
                    onClick={() => setDatasetId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Retained versions"
                value={versionCount}
                output={`${versionCount}`}
                min={model.bounds.versionCount.min}
                max={model.bounds.versionCount.max}
                step={model.bounds.versionCount.step}
                accent="violet"
                lowLabel="Short history"
                highLabel="Long history"
                onChange={setVersionCount}
              />

              <LabRange
                label="Logical data changed per version"
                value={changedPercent}
                output={`${changedPercent}%`}
                min={model.bounds.changedPercent.min}
                max={model.bounds.changedPercent.max}
                step={model.bounds.changedPercent.step}
                accent="cyan"
                lowLabel="Mostly reused"
                highLabel="Full rewrite"
                onChange={setChangedPercent}
              />

              <ChoiceGroup label="2. Choose a workspace link mode">
                {model.cacheModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === cacheMode.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'copy' ? HardDrive : Link2}
                    accent="cyan"
                    onClick={() => setCacheModeId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="3. Set remote retention">
                {model.remoteStates.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === remoteState.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Cloud}
                    accent={item.durable ? 'emerald' : 'amber'}
                    onClick={() => setRemoteStateId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <section
              className={`rounded-md border p-5 ${
                result.historyComplete
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.historyComplete ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Revision recovery verdict
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {result.historyComplete
                      ? 'Every retained Git revision has a remote copy'
                      : `${versionCount - result.retainedVersions} revisions depend on cache bytes that are not retained remotely`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.historyComplete
                      ? 'A clean runner can fetch each modeled content hash, subject to remote availability and credentials.'
                      : 'Git still preserves the pointers, but those revisions cannot be restored after the remaining local cache disappears.'}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Unique cache content"
                value={formatStorage(result.uniqueContentGb)}
                detail={`${formatStorage(result.naiveHistoryGb)} without reuse`}
                icon={Database}
                tone="violet"
              />
              <LabMetric
                label="Next version adds"
                value={formatStorage(result.changedGb)}
                detail={`${result.effectiveChangedPercent}% at the ${dataset.changeBoundary.toLowerCase()} boundary`}
                icon={Archive}
                tone={result.effectiveChangedPercent === 100 ? 'amber' : 'cyan'}
              />
              <LabMetric
                label="Local footprint"
                value={formatStorage(result.localFootprintGb)}
                detail={
                  result.workspaceGb > 0
                    ? `${formatStorage(result.workspaceGb)} workspace copy included`
                    : `${cacheMode.label} has no immediate full-copy estimate`
                }
                icon={HardDrive}
                tone="blue"
              />
              <LabMetric
                label="Remote history"
                value={`${result.retainedVersions}/${versionCount}`}
                detail="Modeled revisions recoverable"
                icon={Cloud}
                tone={result.historyComplete ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Content reuse by version
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {dataset.label}: {dataset.fileCount.toLocaleString()} object
                    {dataset.fileCount === 1 ? '' : 's'}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {result.reusedPercent}% reused / {result.effectiveChangedPercent}% new
                </p>
              </div>
              <div className="mt-4 space-y-2">
                {Array.from({ length: versionCount }, (_, index) => (
                  <VersionBar
                    key={index}
                    number={index + 1}
                    reusedPercent={index === 0 ? 0 : result.reusedPercent}
                    changedPercent={index === 0 ? 100 : result.effectiveChangedPercent}
                  />
                ))}
              </div>
              {dataset.fileCount === 1 ? (
                <p className="mt-4 text-xs leading-5 text-amber-700 dark:text-amber-300">
                  The logical-change slider is {changedPercent}%, but one monolithic
                  checkpoint is modeled as a 100% new DVC object whenever its bytes change.
                </p>
              ) : null}
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <Boundary
                icon={GitBranch}
                title="Git"
                detail={`${versionCount} small revision pointers`}
              />
              <Boundary
                icon={Database}
                title="Cache"
                detail={`${formatStorage(result.uniqueContentGb)} of modeled unique content`}
              />
              <Boundary
                icon={Cloud}
                title="Remote"
                detail={`${result.retainedVersions} revision${result.retainedVersions === 1 ? '' : 's'} retained`}
              />
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {cacheMode.caveat} {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">{children}</div>
    </fieldset>
  );
}

function VersionBar({
  changedPercent,
  number,
  reusedPercent,
}: {
  changedPercent: number;
  number: number;
  reusedPercent: number;
}) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        v{number}
      </span>
      <div
        className="flex h-6 min-w-0 overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
        aria-label={`Version ${number}: ${reusedPercent}% reused and ${changedPercent}% new content`}
      >
        {reusedPercent > 0 ? (
          <span
            className="flex items-center justify-center bg-emerald-200 text-[10px] font-semibold text-emerald-950 dark:bg-emerald-800 dark:text-emerald-50"
            style={{ width: `${reusedPercent}%` }}
          >
            {reusedPercent >= 24 ? 'reused' : ''}
          </span>
        ) : null}
        <span
          className="flex items-center justify-center bg-violet-300 text-[10px] font-semibold text-violet-950 dark:bg-violet-700 dark:text-white"
          style={{ width: `${changedPercent}%` }}
        >
          {changedPercent >= 24 ? 'new' : ''}
        </span>
      </div>
    </div>
  );
}

function Boundary({
  detail,
  icon: Icon,
  title,
}: {
  detail: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <Icon aria-hidden="true" className="h-5 w-5 text-violet-600 dark:text-violet-300" />
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">
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
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-56 items-center justify-center">
            {error ? (
              <div className="max-w-md text-center" role="alert">
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-300"
                />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Artifact placement model unavailable
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading artifact placement model
              </p>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatStorage(gigabytes: number) {
  if (gigabytes >= 1000) return `${(gigabytes / 1000).toFixed(2)} TB`;
  return `${gigabytes.toFixed(gigabytes >= 100 ? 0 : 1)} GB`;
}
