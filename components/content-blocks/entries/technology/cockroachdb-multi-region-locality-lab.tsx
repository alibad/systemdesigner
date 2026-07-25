'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Globe2,
  LoaderCircle,
  MapPin,
  Network,
  Route,
  ServerCrash,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/cockroachdb-multi-region-locality-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/cockroachdb/data/multi-region-locality-model.json';

type Region = {
  id: string;
  label: string;
  shortLabel: string;
};

type HomeMode = 'primary' | 'row' | 'global';
type Operation = 'read' | 'write' | 'transaction';

type TableLocality = {
  id: string;
  label: string;
  detail: string;
  homeMode: HomeMode;
  localReadEverywhere: boolean;
  globalWritePenaltyMs: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  operation: Operation;
  rowRegionIds: string[];
  idealLocalityId: string;
};

type SurvivalGoal = {
  id: string;
  label: string;
  detail: string;
  replicaCount: number;
  regionFailureGuaranteed: boolean;
  writeCoordinationMs: number;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  failedRegionId: string | null;
};

type RoundTripMatrix = Record<string, Record<string, number>>;

type MultiRegionLocalityModel = {
  kind: 'cockroachdb-multi-region-locality';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  primaryRegionId: string;
  regions: Region[];
  roundTripMs: RoundTripMatrix;
  defaults: {
    gatewayRegionId: string;
    localityId: string;
    workloadId: string;
    survivalId: string;
    incidentId: string;
  };
  localities: TableLocality[];
  workloads: Workload[];
  survivalGoals: SurvivalGoal[];
  incidents: Incident[];
  baseReadMs: number;
  baseWriteMs: number;
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isRegion(value: unknown): value is Region {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.shortLabel);
}

function isHomeMode(value: unknown): value is HomeMode {
  return value === 'primary' || value === 'row' || value === 'global';
}

function isOperation(value: unknown): value is Operation {
  return value === 'read'
    || value === 'write'
    || value === 'transaction';
}

function isTableLocality(value: unknown): value is TableLocality {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isHomeMode(value.homeMode)
    && typeof value.localReadEverywhere === 'boolean'
    && isFiniteNumber(value.globalWritePenaltyMs)
    && value.globalWritePenaltyMs >= 0;
}

function isWorkload(value: unknown): value is Workload {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isOperation(value.operation)
    && Array.isArray(value.rowRegionIds)
    && value.rowRegionIds.length > 0
    && value.rowRegionIds.every(isNonEmptyString)
    && isNonEmptyString(value.idealLocalityId);
}

function isSurvivalGoal(value: unknown): value is SurvivalGoal {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.replicaCount)
    && value.replicaCount > 0
    && typeof value.regionFailureGuaranteed === 'boolean'
    && isFiniteNumber(value.writeCoordinationMs)
    && value.writeCoordinationMs >= 0;
}

function isIncident(value: unknown): value is Incident {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && (value.failedRegionId === null || isNonEmptyString(value.failedRegionId));
}

function isRoundTripMatrix(
  value: unknown,
  regionIds: string[],
): value is RoundTripMatrix {
  if (!isRecord(value)) return false;
  return regionIds.every((fromId) => {
    const row = value[fromId];
    return isRecord(row) && regionIds.every((toId) =>
      isFiniteNumber(row[toId]) && row[toId] >= 0);
  });
}

function referencesOnly(ids: string[], allowedIds: Set<string>): boolean {
  return ids.every((id) => allowedIds.has(id));
}

function isMultiRegionLocalityModel(
  value: unknown,
): value is MultiRegionLocalityModel {
  if (!isRecord(value) || !isRecord(value.defaults)) {
    return false;
  }

  const defaults = value.defaults;
  if (
    !Array.isArray(value.regions)
    || value.regions.length !== 3
    || !value.regions.every(isRegion)
    || !hasUniqueIds(value.regions)
  ) {
    return false;
  }

  const regionIds = value.regions.map((region) => region.id);
  const regionIdSet = new Set(regionIds);

  if (
    value.kind !== 'cockroachdb-multi-region-locality'
    || value.blockId !== BLOCK_ID
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.description)
    || !isNonEmptyString(value.primaryRegionId)
    || !regionIdSet.has(value.primaryRegionId)
    || !isRoundTripMatrix(value.roundTripMs, regionIds)
    || !isNonEmptyString(defaults.gatewayRegionId)
    || !regionIdSet.has(defaults.gatewayRegionId)
    || !isNonEmptyString(defaults.localityId)
    || !isNonEmptyString(defaults.workloadId)
    || !isNonEmptyString(defaults.survivalId)
    || !isNonEmptyString(defaults.incidentId)
    || !Array.isArray(value.localities)
    || value.localities.length !== 3
    || !value.localities.every(isTableLocality)
    || !hasUniqueIds(value.localities)
    || !value.localities.some((item) => item.id === defaults.localityId)
    || !Array.isArray(value.workloads)
    || value.workloads.length !== 3
    || !value.workloads.every(isWorkload)
    || !hasUniqueIds(value.workloads)
    || !value.workloads.some((item) => item.id === defaults.workloadId)
    || !Array.isArray(value.survivalGoals)
    || value.survivalGoals.length !== 2
    || !value.survivalGoals.every(isSurvivalGoal)
    || !hasUniqueIds(value.survivalGoals)
    || !value.survivalGoals.some((item) => item.id === defaults.survivalId)
    || !Array.isArray(value.incidents)
    || value.incidents.length !== 2
    || !value.incidents.every(isIncident)
    || !hasUniqueIds(value.incidents)
    || !value.incidents.some((item) => item.id === defaults.incidentId)
    || !isFiniteNumber(value.baseReadMs)
    || value.baseReadMs <= 0
    || !isFiniteNumber(value.baseWriteMs)
    || value.baseWriteMs <= 0
    || !isNonEmptyString(value.notice)
  ) {
    return false;
  }

  const localityIds = new Set(
    value.localities.map((locality) => locality.id),
  );
  return value.workloads.every(
    (workload) =>
      referencesOnly(workload.rowRegionIds, regionIdSet)
      && localityIds.has(workload.idealLocalityId),
  ) && value.incidents.every(
    (incident) =>
      incident.failedRegionId === null
      || regionIdSet.has(incident.failedRegionId),
  );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function CockroachDBMultiRegionLocalityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MultiRegionLocalityModel | null>(null);
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
        if (!isMultiRegionLocalityModel(payload)) {
          throw new Error('The multi-region locality model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the multi-region locality model.',
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

  return <MultiRegionWorkbench model={model} />;
}

function MultiRegionWorkbench({
  model,
}: {
  model: MultiRegionLocalityModel;
}) {
  const [gatewayRegionId, setGatewayRegionId] = useState(
    model.defaults.gatewayRegionId,
  );
  const [localityId, setLocalityId] = useState(model.defaults.localityId);
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [survivalId, setSurvivalId] = useState(model.defaults.survivalId);
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);

  const gateway = findById(model.regions, gatewayRegionId);
  const locality = findById(model.localities, localityId);
  const workload = findById(model.workloads, workloadId);
  const survival = findById(model.survivalGoals, survivalId);
  const incident = findById(model.incidents, incidentId);

  const result = useMemo(() => {
    const rowHomeIds = [...new Set(workload.rowRegionIds)];
    const homeRegionId = locality.homeMode === 'primary'
      ? model.primaryRegionId
      : locality.homeMode === 'row'
        ? rowHomeIds[0]
        : gateway.id;
    const homeRegion = findById(model.regions, homeRegionId);
    const gatewayToHomeMs = model.roundTripMs[gateway.id][homeRegion.id];
    const rowSpanMs = rowHomeIds.length > 1
      ? Math.max(
        ...rowHomeIds.flatMap((fromId) =>
          rowHomeIds.map((toId) => model.roundTripMs[fromId][toId])),
      )
      : 0;

    const readLatencyMs = model.baseReadMs + (
      locality.localReadEverywhere ? 0 : gatewayToHomeMs
    );
    const writes = workload.operation !== 'read';
    const writeLatencyMs = writes
      ? model.baseWriteMs
        + gatewayToHomeMs
        + survival.writeCoordinationMs
        + locality.globalWritePenaltyMs
        + (workload.operation === 'transaction' ? rowSpanMs : 0)
      : null;
    const regionFailure = incident.failedRegionId !== null;
    const availability = !regionFailure
      ? 'Healthy'
      : survival.regionFailureGuaranteed
        ? 'Guaranteed by goal'
        : 'Outside guarantee';
    const availableByGoal =
      !regionFailure || survival.regionFailureGuaranteed;
    const localityFit = locality.id === workload.idealLocalityId;
    const pathRegionIds = locality.homeMode === 'global'
      ? model.regions.map((region) => region.id)
      : locality.homeMode === 'row'
        ? rowHomeIds
        : [model.primaryRegionId];

    return {
      availability,
      availableByGoal,
      homeRegion,
      localityFit,
      pathRegionIds,
      readLatencyMs,
      rowSpanMs,
      writeLatencyMs,
    };
  }, [
    gateway,
    incident.failedRegionId,
    locality,
    model,
    survival,
    workload,
  ]);

  function reset() {
    setGatewayRegionId(model.defaults.gatewayRegionId);
    setLocalityId(model.defaults.localityId);
    setWorkloadId(model.defaults.workloadId);
    setSurvivalId(model.defaults.survivalId);
    setIncidentId(model.defaults.incidentId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Multi-region contract lab"
          title={model.title}
          description={model.description}
          icon={Globe2}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. SQL gateway
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {model.regions.map((region) => (
                    <LabChoice
                      key={region.id}
                      selected={region.id === gateway.id}
                      label={region.label}
                      icon={MapPin}
                      accent="violet"
                      onClick={() => setGatewayRegionId(region.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.operation === 'read'
                        ? TableProperties
                        : Database}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Table locality
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.localities.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === locality.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.homeMode === 'global' ? Globe2 : Route}
                      accent="emerald"
                      onClick={() => setLocalityId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Survival goal
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.survivalGoals.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === survival.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent="amber"
                      onClick={() => setSurvivalId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  5. Failure state
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.failedRegionId ? ServerCrash : CheckCircle2}
                      accent={item.failedRegionId ? 'rose' : 'emerald'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Modeled read"
                value={`${Math.round(result.readLatencyMs)} ms`}
                detail={`Gateway: ${gateway.label}`}
                icon={Clock3}
                tone="blue"
              />
              <LabMetric
                label="Modeled write"
                value={result.writeLatencyMs === null
                  ? 'Read only'
                  : `${Math.round(result.writeLatencyMs)} ms`}
                detail={workload.operation === 'transaction'
                  ? `${result.rowSpanMs} ms row-to-row span included`
                  : 'Commit path for this workload'}
                icon={Network}
                tone={result.writeLatencyMs !== null
                  && result.writeLatencyMs > 150
                  ? 'amber'
                  : 'violet'}
              />
              <LabMetric
                label="Replica policy"
                value={`${survival.replicaCount} replicas`}
                detail={survival.label}
                icon={ShieldCheck}
                tone="emerald"
              />
              <LabMetric
                label="Region outage"
                value={result.availability}
                detail={incident.label}
                icon={result.availableByGoal
                  ? CheckCircle2
                  : AlertTriangle}
                tone={result.availableByGoal ? 'emerald' : 'rose'}
              />
            </div>

            <RegionRoute
              model={model}
              gatewayRegionId={gateway.id}
              pathRegionIds={result.pathRegionIds}
              failedRegionId={incident.failedRegionId}
            />

            <div
              role="status"
              className={`rounded-md border p-4 ${
                !result.availableByGoal
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                  : result.localityFit
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {!result.availableByGoal ? (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                ) : result.localityFit ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                ) : (
                  <Route
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold">
                    {!result.availableByGoal
                      ? 'The tested outage exceeds the configured guarantee'
                      : result.localityFit
                        ? 'Locality matches this workload'
                        : `Reconsider ${locality.label} for this access pattern`}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {result.localityFit
                      ? `${workload.label} is optimized by ${locality.label}.`
                      : `${workload.label} is normally better served by ${findById(model.localities, workload.idealLocalityId).label}.`}
                    {' '}
                    The modeled home is {result.homeRegion.label}.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RegionRoute({
  model,
  gatewayRegionId,
  pathRegionIds,
  failedRegionId,
}: {
  model: MultiRegionLocalityModel;
  gatewayRegionId: string;
  pathRegionIds: string[];
  failedRegionId: string | null;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div>
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
          Request and data placement
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Labels show the gateway, data path, and injected failure.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
        {model.regions.map((region, index) => {
          const isGateway = region.id === gatewayRegionId;
          const isDataPath = pathRegionIds.includes(region.id);
          const isFailed = region.id === failedRegionId;

          return (
            <div key={region.id} className="contents">
              <div
                className={`min-w-0 rounded-md border p-4 ${
                  isFailed
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                    : isDataPath
                      ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50'
                      : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {isFailed ? (
                    <span className="rounded border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      Failed
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 font-semibold">{region.label}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {isGateway ? (
                    <span className="rounded bg-blue-100 px-2 py-1 text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                      SQL gateway
                    </span>
                  ) : null}
                  {isDataPath ? (
                    <span className="rounded bg-violet-100 px-2 py-1 text-violet-900 dark:bg-violet-950 dark:text-violet-100">
                      Data path
                    </span>
                  ) : null}
                </div>
              </div>

              {index < model.regions.length - 1 ? (
                <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                  <ArrowDown
                    aria-hidden="true"
                    className="h-5 w-5 md:hidden"
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden h-5 w-5 md:block"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
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
        <LearningLabHeader
          eyebrow="Multi-region contract lab"
          title="Place data against latency and failure goals"
          description="Loading regional paths, locality policies, and survival goals."
          icon={Globe2}
          accent="violet"
        />
        <LearningLabBody>
          <div
            role={error ? 'alert' : 'status'}
            className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-900/60"
          >
            {error ? (
              <div>
                <ServerCrash
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 text-rose-500"
                />
                <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
                  The locality model could not be loaded
                </p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                <LoaderCircle
                  aria-hidden="true"
                  className="mx-auto h-6 w-6 animate-spin text-violet-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                  Loading the regional model...
                </p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
