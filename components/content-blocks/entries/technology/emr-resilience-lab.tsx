'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  HardDrive,
  LoaderCircle,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type StorageMode = {
  id: string;
  label: string;
  detail: string;
  authority: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  computeEffect: string;
  hdfsEffect: string;
  recovery: string;
};

type ReplicationTier = {
  minCoreNodes: number;
  maxCoreNodes: number | null;
  factor: number;
};

type ResilienceModel = {
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    coreNodes: number;
    storagePerCoreGiB: number;
    storageModeId: string;
    incidentId: string;
    primaryMode: 'single' | 'ha';
  };
  bounds: {
    coreNodes: Bounds;
    storagePerCoreGiB: Bounds;
  };
  storageModes: StorageMode[];
  incidents: Incident[];
  replicationTiers: ReplicationTier[];
};

const BLOCK_ID = 'technology/emr-resilience-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/emr/data/ec2-resilience-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return (
    isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min < candidate.max
    && candidate.step > 0
  );
}

function isResilienceModel(value: unknown): value is ResilienceModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResilienceModel>;
  const defaults = candidate.defaults;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && defaults
      && isFiniteNumber(defaults.coreNodes)
      && isFiniteNumber(defaults.storagePerCoreGiB)
      && typeof defaults.storageModeId === 'string'
      && typeof defaults.incidentId === 'string'
      && (defaults.primaryMode === 'single' || defaults.primaryMode === 'ha')
      && isBounds(candidate.bounds?.coreNodes)
      && isBounds(candidate.bounds?.storagePerCoreGiB)
      && Array.isArray(candidate.storageModes)
      && candidate.storageModes.length === 2
      && candidate.storageModes.every((mode) => (
        typeof mode.id === 'string'
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
        && typeof mode.authority === 'string'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length === 3
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && typeof incident.computeEffect === 'string'
        && typeof incident.hdfsEffect === 'string'
        && typeof incident.recovery === 'string'
      ))
      && Array.isArray(candidate.replicationTiers)
      && candidate.replicationTiers.length >= 3
      && candidate.replicationTiers.every((tier) => (
        Number.isInteger(tier.minCoreNodes)
        && (tier.maxCoreNodes === null || Number.isInteger(tier.maxCoreNodes))
        && Number.isInteger(tier.factor)
        && tier.factor > 0
      ))
      && candidate.storageModes.some((mode) => mode.id === defaults.storageModeId)
      && candidate.incidents.some((incident) => incident.id === defaults.incidentId),
  );
}

export default function EmrResilienceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ResilienceModel | null>(null);
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
        if (!isResilienceModel(payload)) {
          throw new Error('The EMR resilience model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the EMR resilience model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Failure and storage lab"
            title="Inject a node interruption"
            description="Loading HDFS defaults and node-role consequences."
            icon={ShieldCheck}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <ResilienceWorkbench model={model} />
      )}
    </div>
  );
}

function ResilienceWorkbench({ model }: { model: ResilienceModel }) {
  const [coreNodes, setCoreNodes] = useState(model.defaults.coreNodes);
  const [storagePerCoreGiB, setStoragePerCoreGiB] = useState(
    model.defaults.storagePerCoreGiB,
  );
  const [storageModeId, setStorageModeId] = useState(model.defaults.storageModeId);
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [primaryMode, setPrimaryMode] = useState<'single' | 'ha'>(
    model.defaults.primaryMode,
  );

  const storageMode = (
    model.storageModes.find((candidate) => candidate.id === storageModeId)
    ?? model.storageModes[0]
  );
  const incident = (
    model.incidents.find((candidate) => candidate.id === incidentId)
    ?? model.incidents[0]
  );
  const replicationFactor = (
    model.replicationTiers.find((tier) => (
      coreNodes >= tier.minCoreNodes
      && (tier.maxCoreNodes === null || coreNodes <= tier.maxCoreNodes)
    ))?.factor ?? 1
  );

  const result = useMemo(() => {
    const rawGiB = coreNodes * storagePerCoreGiB;
    const usableGiB = rawGiB / replicationFactor;
    const primarySurvives = incident.id !== 'primary' || primaryMode === 'ha';
    const dataAuthoritySurvives = (
      storageMode.id === 's3'
      || incident.id === 'task'
      || (incident.id === 'primary' && primaryMode === 'ha')
    );
    const contained = primarySurvives && dataAuthoritySurvives;

    let verdict = 'Task capacity shrinks, but the node held no HDFS blocks';
    let explanation = `${incident.computeEffect} ${incident.recovery}`;

    if (incident.id === 'primary') {
      verdict = primaryMode === 'ha'
        ? 'A standby primary can take over cluster coordination'
        : 'The single primary loss ends the cluster';
      explanation = primaryMode === 'ha'
        ? 'EMR can fail over to a standby primary and replace the failed node. Applications still need retry-safe outputs and external checkpoints.'
        : `${incident.computeEffect} Recreate the cluster from versioned configuration and durable external state.`;
    } else if (incident.id === 'core') {
      verdict = storageMode.id === 's3'
        ? 'Durable S3 data survives, while local HDFS and shuffle remain at risk'
        : 'The interrupted core node puts the selected data authority at risk';
      explanation = storageMode.id === 's3'
        ? `${incident.computeEffect} ${incident.hdfsEffect} ${incident.recovery}`
        : `${incident.hdfsEffect} A replication factor is redundancy, not proof that every block survives a particular set of failures.`;
    }

    return {
      contained,
      dataAuthoritySurvives,
      explanation,
      rawGiB,
      replicaFailureBudget: Math.max(0, replicationFactor - 1),
      usableGiB,
      verdict,
    };
  }, [coreNodes, incident, primaryMode, replicationFactor, storageMode.id, storagePerCoreGiB]);

  function reset() {
    setCoreNodes(model.defaults.coreNodes);
    setStoragePerCoreGiB(model.defaults.storagePerCoreGiB);
    setStorageModeId(model.defaults.storageModeId);
    setIncidentId(model.defaults.incidentId);
    setPrimaryMode(model.defaults.primaryMode);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Failure and storage lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <div className="space-y-6">
              <LabRange
                label="Core nodes"
                value={coreNodes}
                output={`${coreNodes}`}
                {...model.bounds.coreNodes}
                lowLabel="Small cluster"
                highLabel="More storage nodes"
                accent="blue"
                onChange={setCoreNodes}
              />
              <LabRange
                label="Storage per core"
                value={storagePerCoreGiB}
                output={`${storagePerCoreGiB} GiB`}
                {...model.bounds.storagePerCoreGiB}
                lowLabel="100 GiB"
                highLabel="2 TiB"
                accent="violet"
                onChange={setStoragePerCoreGiB}
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Durable data authority
              </legend>
              <div className="mt-3 grid gap-2">
                {model.storageModes.map((mode) => (
                  <LabChoice
                    key={mode.id}
                    selected={mode.id === storageMode.id}
                    label={mode.label}
                    detail={mode.detail}
                    icon={mode.id === 's3' ? Cloud : HardDrive}
                    accent={mode.id === 's3' ? 'emerald' : 'amber'}
                    onClick={() => setStorageModeId(mode.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Inject one interruption
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === incident.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Server}
                    accent="rose"
                    onClick={() => setIncidentId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabChoice
              selected={primaryMode === 'ha'}
              label="Three-primary high availability"
              detail="Enable EMR primary-node failover instead of relying on one coordinator."
              icon={ShieldCheck}
              accent="blue"
              onClick={() => setPrimaryMode((value) => (
                value === 'single' ? 'ha' : 'single'
              ))}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              result.contained
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.contained ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Observed consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">{result.verdict}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{result.explanation}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Raw core storage"
              value={`${result.rawGiB.toLocaleString()} GiB`}
              detail={`${coreNodes} core nodes x ${storagePerCoreGiB} GiB`}
              icon={HardDrive}
              tone="blue"
            />
            <LabMetric
              label="Default replication"
              value={`${replicationFactor}x`}
              detail="AWS-documented HDFS default for this core-node count"
              icon={Database}
              tone="violet"
            />
            <LabMetric
              label="Approx. usable HDFS"
              value={`${Math.round(result.usableGiB).toLocaleString()} GiB`}
              detail="Raw capacity divided by replication, before overhead"
              icon={Calculator}
              tone="cyan"
            />
            <LabMetric
              label="Data authority"
              value={result.dataAuthoritySurvives ? 'External or intact' : 'At risk'}
              detail={storageMode.authority}
              icon={result.dataAuthoritySurvives ? ShieldCheck : CircleAlert}
              tone={result.dataAuthoritySurvives ? 'emerald' : 'rose'}
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 md:w-1/3">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  HDFS capacity model
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                  {replicationFactor} physical copies per logical block
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="h-4 overflow-hidden rounded-sm border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                  <div
                    className="h-full bg-cyan-500 transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${100 / replicationFactor}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>Logical data</span>
                  <span className="text-right">
                    Up to {result.replicaFailureBudget} replica loss
                    {result.replicaFailureBudget === 1 ? '' : 'es'} under ideal placement
                  </span>
                </div>
              </div>
            </div>
          </section>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
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
    <LearningLabBody>
      <div
        role={error ? 'alert' : 'status'}
        className="flex min-h-40 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60"
      >
        <div>
          {error ? (
            <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-rose-600 motion-reduce:animate-none dark:text-rose-400" />
          )}
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            {error ?? 'Loading the resilience model...'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </LearningLabBody>
  );
}
