'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Layers3,
  Search,
  ServerCog,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/advanced-search-systems/data/retrieval-capacity-lab.json';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  documentMillions: number;
  targetQps: number;
  dimensions: number;
  baseServiceMs: number;
};

type StorageProfile = {
  id: string;
  label: string;
  detail: string;
  bytesPerDimension: number;
  graphBytesPerDocument: number;
  candidateCostMs: number;
  dimensionCostMs: number;
  qualityNote: string;
};

type CapacityData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    storageProfileId: string;
    candidateDepth: number;
    targetLatencyMs: number;
  };
  candidateRange: RangeDefinition;
  latencyRange: RangeDefinition;
  constants: {
    metadataBytesPerDocument: number;
    indexOverheadFactor: number;
    memoryHeadroomFactor: number;
    maxPrimaryShardGiB: number;
    concurrentQueriesPerServingCopy: number;
    targetUtilization: number;
    burstHeadroomFactor: number;
    p95Multiplier: number;
  };
  workloads: Workload[];
  storageProfiles: StorageProfile[];
};

function isRange(value: unknown): value is RangeDefinition {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeDefinition>;
  return [range.min, range.max, range.step].every((item) => typeof item === 'number');
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CapacityData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && isRange(data.candidateRange)
      && isRange(data.latencyRange)
      && data.constants
      && typeof data.constants.maxPrimaryShardGiB === 'number'
      && typeof data.constants.concurrentQueriesPerServingCopy === 'number'
      && Array.isArray(data.workloads)
      && data.workloads.length > 0
      && data.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.documentMillions === 'number'
        && typeof workload.targetQps === 'number'
        && typeof workload.dimensions === 'number'
        && typeof workload.baseServiceMs === 'number'
      ))
      && Array.isArray(data.storageProfiles)
      && data.storageProfiles.length > 0
      && data.storageProfiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.bytesPerDimension === 'number'
        && typeof profile.graphBytesPerDocument === 'number'
        && typeof profile.candidateCostMs === 'number'
        && typeof profile.dimensionCostMs === 'number'
        && typeof profile.qualityNote === 'string'
      )),
  );
}

function formatStorage(gibibytes: number) {
  if (gibibytes >= 1024) return `${(gibibytes / 1024).toFixed(1)} TiB`;
  return `${gibibytes.toFixed(gibibytes >= 100 ? 0 : 1)} GiB`;
}

export default function AdvancedSearchSystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [candidateDepth, setCandidateDepth] = useState(200);
  const [targetLatencyMs, setTargetLatencyMs] = useState(100);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load capacity data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity data is incomplete.');
        setData(payload);
        setWorkloadId(payload.defaults.workloadId);
        setProfileId(payload.defaults.storageProfileId);
        setCandidateDepth(payload.defaults.candidateDepth);
        setTargetLatencyMs(payload.defaults.targetLatencyMs);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load capacity data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const workload = data?.workloads.find((item) => item.id === workloadId)
    ?? data?.workloads[0];
  const profile = data?.storageProfiles.find((item) => item.id === profileId)
    ?? data?.storageProfiles[0];

  const model = useMemo(() => {
    if (!data || !workload || !profile) return null;

    const documentCount = workload.documentMillions * 1_000_000;
    const bytesToGiB = 1024 ** 3;
    const vectorGiB = (
      documentCount * workload.dimensions * profile.bytesPerDimension
    ) / bytesToGiB;
    const graphGiB = (
      documentCount * (
        profile.graphBytesPerDocument + data.constants.metadataBytesPerDocument
      )
    ) / bytesToGiB;
    const primaryIndexGiB = (
      vectorGiB + graphGiB
    ) * data.constants.indexOverheadFactor;
    const primaryShards = Math.max(
      1,
      Math.ceil(primaryIndexGiB / data.constants.maxPrimaryShardGiB),
    );

    const corpusLookupMs = Math.log2(documentCount) * 0.12;
    const estimatedServiceMs = workload.baseServiceMs
      + corpusLookupMs
      + candidateDepth * profile.candidateCostMs
      + workload.dimensions * profile.dimensionCostMs;
    const modeledP95Ms = estimatedServiceMs * data.constants.p95Multiplier;
    const qpsPerServingCopy = (
      data.constants.concurrentQueriesPerServingCopy
      * data.constants.targetUtilization
      * 1000
    ) / estimatedServiceMs;
    const servingCopies = Math.max(
      2,
      Math.ceil(
        workload.targetQps
          * data.constants.burstHeadroomFactor
          / qpsPerServingCopy,
      ),
    );
    const residentGiB = primaryIndexGiB
      * servingCopies
      * data.constants.memoryHeadroomFactor;
    const totalShardCopies = primaryShards * servingCopies;
    const withinLatency = modeledP95Ms <= targetLatencyMs;
    const vectorShare = primaryIndexGiB === 0 ? 0 : vectorGiB / (vectorGiB + graphGiB);

    const diagnosis = !withinLatency
      ? {
          title: 'The candidate budget misses the latency target',
          detail: 'Reduce candidates, use a cheaper first stage, or move expensive scoring into a bounded reranker. Adding replicas improves queueing headroom but does not remove per-query work.',
          tone: 'rose' as const,
        }
      : servingCopies >= 16
        ? {
            title: 'The SLO fits, but serving fan-out is expensive',
            detail: 'Demand requires many complete serving copies in this model. Benchmark shard fan-out and consider routing, caching, or a cheaper retrieval profile before scaling linearly.',
            tone: 'amber' as const,
          }
        : {
            title: 'The modeled retrieval budget has headroom',
            detail: 'The estimated p95 fits the target with burst capacity and at least two serving copies. Validate recall and tail latency on production-like queries before choosing the index.',
            tone: 'emerald' as const,
          };

    return {
      diagnosis,
      graphGiB,
      modeledP95Ms,
      primaryIndexGiB,
      primaryShards,
      residentGiB,
      servingCopies,
      totalShardCopies,
      vectorGiB,
      vectorShare,
      withinLatency,
    };
  }, [candidateDepth, data, profile, targetLatencyMs, workload]);

  function reset() {
    if (!data) return;
    setWorkloadId(data.defaults.workloadId);
    setProfileId(data.defaults.storageProfileId);
    setCandidateDepth(data.defaults.candidateDepth);
    setTargetLatencyMs(data.defaults.targetLatencyMs);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Retrieval capacity lab"
        title={data?.title ?? 'Budget the candidate stage before sizing it'}
        description={data?.description ?? 'Loading the retrieval model...'}
        icon={Search}
        accent="cyan"
        onReset={data ? reset : undefined}
      />

      {!data || !workload || !profile || !model ? (
        <LoadState error={error} />
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'commerce' ? Boxes : item.id === 'marketplace' ? Database : Search}
                      accent={item.id === 'commerce' ? 'cyan' : item.id === 'marketplace' ? 'amber' : 'violet'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Vector storage
                </legend>
                <div className="mt-3 space-y-2">
                  {data.storageProfiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Layers3}
                      accent={item.id === 'float32' ? 'blue' : item.id === 'int8' ? 'emerald' : 'violet'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-6">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Query budget
                </legend>
                <LabRange
                  label="Candidates per retriever"
                  value={candidateDepth}
                  output={candidateDepth.toLocaleString()}
                  min={data.candidateRange.min}
                  max={data.candidateRange.max}
                  step={data.candidateRange.step}
                  accent="violet"
                  lowLabel="Fast, narrow"
                  highLabel="Broad, costly"
                  onChange={setCandidateDepth}
                />
                <LabRange
                  label="End-to-end p95 target"
                  value={targetLatencyMs}
                  output={`${targetLatencyMs} ms`}
                  min={data.latencyRange.min}
                  max={data.latencyRange.max}
                  step={data.latencyRange.step}
                  accent="cyan"
                  lowLabel="Strict"
                  highLabel="Relaxed"
                  onChange={setTargetLatencyMs}
                />
              </fieldset>
            </div>
          )}
        >
          <div
            aria-live="polite"
            className={`rounded-md border p-4 ${
              model.diagnosis.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                : model.diagnosis.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
            }`}
          >
            <div className="flex items-start gap-3">
              {model.diagnosis.tone === 'emerald' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {model.diagnosis.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.diagnosis.detail}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Primary index"
              value={formatStorage(model.primaryIndexGiB)}
              detail={`${workload.documentMillions}M documents, ${workload.dimensions} dimensions`}
              icon={Database}
              tone="blue"
            />
            <LabMetric
              label="Resident capacity"
              value={formatStorage(model.residentGiB)}
              detail={`${model.servingCopies} complete serving copies with headroom`}
              icon={ServerCog}
              tone="violet"
            />
            <LabMetric
              label="Shard copies"
              value={model.totalShardCopies.toLocaleString()}
              detail={`${model.primaryShards} primary partitions x ${model.servingCopies} copies`}
              icon={Layers3}
              tone="cyan"
            />
            <LabMetric
              label="Modeled retrieval p95"
              value={`${model.modeledP95Ms.toFixed(0)} ms`}
              detail={`${targetLatencyMs} ms end-to-end target`}
              icon={Clock3}
              tone={model.withinLatency ? 'emerald' : 'rose'}
            />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Primary index composition</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Before serving copies and memory headroom</p>
            </div>
            <div className="mt-4 flex h-4 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
              <span className="bg-cyan-500" style={{ width: `${model.vectorShare * 100}%` }} />
              <span className="flex-1 bg-amber-500" />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-cyan-500" />Vectors: {formatStorage(model.vectorGiB)}</p>
              <p><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Graph and metadata: {formatStorage(model.graphGiB)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Stage label="Retrieve" value={`${candidateDepth} + ${candidateDepth}`} detail="Lexical and semantic candidates are gathered independently." />
            <Stage label="Fuse" value="One bounded set" detail="Deduplicate and combine ranks before expensive scoring." />
            <Stage label="Rerank" value="Top results only" detail="Spend model latency where it can still change the page." />
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            <Gauge aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            This planning model includes vector payload, graph and metadata bytes, index overhead, serving-copy headroom, bounded concurrency, and burst demand. It is not a hardware benchmark. {profile.qualityNote}
          </p>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function Stage({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  if (error) {
    return (
      <div className="flex min-h-52 items-center gap-3 p-5 text-sm text-rose-800 dark:text-rose-300 md:p-6">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="h-72 animate-pulse bg-neutral-50 dark:bg-neutral-900" aria-label="Loading retrieval capacity lab" />
  );
}
