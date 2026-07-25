'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleGauge,
  Database,
  KeyRound,
  LoaderCircle,
  MapPin,
  Network,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type NodeModel = {
  id: string;
  label: string;
  rack: string;
  tokenPosition: number;
};

type KeyShape = {
  id: string;
  label: string;
  detail: string;
  partitionKey: string;
  sampleKey: string;
  sampleToken: number;
  activePartitions: number;
  hottestPartitionWritesPerSecond: number;
  rowsInHottestPartition: number;
  nodeShares: number[];
  consequence: string;
};

type PartitionPlacementModel = {
  title: string;
  description: string;
  defaultKeyShapeId: string;
  defaultReplicationFactor: number;
  planningThresholdWritesPerSecond: number;
  nodes: NodeModel[];
  keyShapes: KeyShape[];
  replicationFactors: number[];
};

const BLOCK_ID = 'technology/cassandra-partition-placement-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/cassandra/data/partition-placement-model.json';
const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNodeModel(value: unknown): value is NodeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NodeModel>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.rack === 'string'
    && isFiniteNumber(candidate.tokenPosition);
}

function isKeyShape(value: unknown, nodeCount: number): value is KeyShape {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KeyShape>;
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.detail === 'string'
    && typeof candidate.partitionKey === 'string'
    && typeof candidate.sampleKey === 'string'
    && isFiniteNumber(candidate.sampleToken)
    && isFiniteNumber(candidate.activePartitions)
    && isFiniteNumber(candidate.hottestPartitionWritesPerSecond)
    && isFiniteNumber(candidate.rowsInHottestPartition)
    && Array.isArray(candidate.nodeShares)
    && candidate.nodeShares.length === nodeCount
    && candidate.nodeShares.every(isFiniteNumber);
}

function isPartitionPlacementModel(
  value: unknown,
): value is PartitionPlacementModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PartitionPlacementModel>;
  if (
    typeof candidate.title !== 'string'
    || typeof candidate.description !== 'string'
    || typeof candidate.defaultKeyShapeId !== 'string'
    || !isFiniteNumber(candidate.defaultReplicationFactor)
    || !isFiniteNumber(candidate.planningThresholdWritesPerSecond)
    || !Array.isArray(candidate.nodes)
    || candidate.nodes.length < 3
    || !candidate.nodes.every(isNodeModel)
    || !Array.isArray(candidate.keyShapes)
    || candidate.keyShapes.length < 3
    || !Array.isArray(candidate.replicationFactors)
    || !candidate.replicationFactors.every(isFiniteNumber)
  ) {
    return false;
  }

  const nodeCount = candidate.nodes.length;
  return candidate.keyShapes.every((shape) => isKeyShape(shape, nodeCount))
    && candidate.keyShapes.some(
      (shape) => shape.id === candidate.defaultKeyShapeId,
    )
    && candidate.replicationFactors.includes(
      candidate.defaultReplicationFactor,
    );
}

function replicaWalk(
  nodes: NodeModel[],
  sampleToken: number,
  replicationFactor: number,
) {
  const ordered = [...nodes].sort(
    (left, right) => left.tokenPosition - right.tokenPosition,
  );
  const ownerIndex = ordered.findIndex(
    (node) => node.tokenPosition >= sampleToken,
  );
  const startIndex = ownerIndex === -1 ? 0 : ownerIndex;
  const walk = [
    ...ordered.slice(startIndex),
    ...ordered.slice(0, startIndex),
  ];
  const replicas: NodeModel[] = [];
  const usedRacks = new Set<string>();

  for (const node of walk) {
    if (replicas.length >= replicationFactor) break;
    if (usedRacks.has(node.rack)) continue;
    replicas.push(node);
    usedRacks.add(node.rack);
  }

  for (const node of walk) {
    if (replicas.length >= replicationFactor) break;
    if (replicas.some((replica) => replica.id === node.id)) continue;
    replicas.push(node);
  }

  return { ordered, replicas };
}

export default function CassandraPartitionPlacementLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PartitionPlacementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [keyShapeId, setKeyShapeId] = useState('');
  const [replicationFactor, setReplicationFactor] = useState(3);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPartitionPlacementModel(payload)) {
          throw new Error('The partition-placement model is incomplete.');
        }
        setData(payload);
        setKeyShapeId(payload.defaultKeyShapeId);
        setReplicationFactor(payload.defaultReplicationFactor);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the partition-placement model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const selectedShape = data?.keyShapes.find(
    (shape) => shape.id === keyShapeId,
  ) ?? data?.keyShapes[0];

  const placement = useMemo(() => {
    if (!data || !selectedShape) return { ordered: [], replicas: [] };
    return replicaWalk(
      data.nodes,
      selectedShape.sampleToken,
      replicationFactor,
    );
  }, [data, replicationFactor, selectedShape]);

  if (!data || !selectedShape) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Partition and placement lab"
            title="Where does one Cassandra partition live?"
            description="Loading the query-key and rack-placement model."
            icon={Network}
            accent="cyan"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  const isHot = selectedShape.hottestPartitionWritesPerSecond
    > data.planningThresholdWritesPerSecond;
  const selectedReplicaIds = new Set(
    placement.replicas.map((node) => node.id),
  );
  const {
    defaultKeyShapeId,
    defaultReplicationFactor,
  } = data;

  function reset() {
    setKeyShapeId(defaultKeyShapeId);
    setReplicationFactor(defaultReplicationFactor);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Partition and placement lab"
          title={data.title}
          description={data.description}
          icon={Network}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Partition-key shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.keyShapes.map((shape) => (
                    <LabChoice
                      key={shape.id}
                      selected={shape.id === selectedShape.id}
                      label={shape.label}
                      detail={shape.detail}
                      icon={KeyRound}
                      accent={
                        shape.id === 'tenant-device-day'
                          ? 'emerald'
                          : shape.id === 'tenant-day'
                            ? 'blue'
                            : 'amber'
                      }
                      onClick={() => setKeyShapeId(shape.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Replicas per datacenter
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {data.replicationFactors.map((factor) => (
                    <button
                      key={factor}
                      type="button"
                      aria-pressed={factor === replicationFactor}
                      onClick={() => setReplicationFactor(factor)}
                      className={`min-h-11 rounded-md border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        factor === replicationFactor
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-400 dark:bg-cyan-950/45 dark:text-cyan-50 dark:ring-cyan-400'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      RF {factor}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected CQL partition key
                </p>
                <code className="mt-2 block break-words text-sm font-semibold text-neutral-950 dark:text-white">
                  {selectedShape.partitionKey}
                </code>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Sample value: {selectedShape.sampleKey}
                </p>
              </div>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Active partitions"
                value={integerFormatter.format(selectedShape.activePartitions)}
                detail="Modeled partitions receiving writes now"
                icon={Boxes}
                tone="blue"
              />
              <LabMetric
                label="Hottest partition"
                value={`${integerFormatter.format(selectedShape.hottestPartitionWritesPerSecond)}/s`}
                detail={`${integerFormatter.format(data.planningThresholdWritesPerSecond)}/s review threshold for this exercise`}
                icon={CircleGauge}
                tone={isHot ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Rows in hottest"
                value={integerFormatter.format(selectedShape.rowsInHottestPartition)}
                detail="Modeled rows before expiry or bucket rollover"
                icon={Database}
                tone={selectedShape.rowsInHottestPartition > 1_000_000 ? 'amber' : 'cyan'}
              />
              <LabMetric
                label="Replica copies"
                value={replicationFactor.toString()}
                detail={`${new Set(placement.replicas.map((node) => node.rack)).size} rack failure domains`}
                icon={MapPin}
                tone={replicationFactor >= 3 ? 'violet' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Sampled token distribution
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    These bars use a fixed teaching sample. Production balance depends
                    on real partition keys, sizes, token allocation, and traffic.
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold uppercase ${
                  isHot
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}>
                  {isHot ? 'Hot-key review required' : 'Within exercise threshold'}
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {placement.ordered.map((node, index) => {
                  const share = selectedShape.nodeShares[
                    data.nodes.findIndex((candidate) => candidate.id === node.id)
                  ] ?? 0;
                  return (
                    <div key={node.id} className="min-w-0">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                          {node.label} · {node.rack}
                        </span>
                        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                          {share}%
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                        role="meter"
                        aria-label={`${node.label} sampled partition share`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={share}
                      >
                        <div
                          className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                            index % 3 === 0
                              ? 'bg-cyan-600 dark:bg-cyan-400'
                              : index % 3 === 1
                                ? 'bg-violet-600 dark:bg-violet-400'
                                : 'bg-emerald-600 dark:bg-emerald-400'
                          }`}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Clockwise rack-aware replica walk
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The sample token lands at {selectedShape.sampleToken}. The first
                  eligible node is primary for this model; NetworkTopologyStrategy
                  continues to distinct racks while they are available.
                </p>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-3">
                {placement.ordered.map((node) => {
                  const replicaIndex = placement.replicas.findIndex(
                    (replica) => replica.id === node.id,
                  );
                  const selected = selectedReplicaIds.has(node.id);
                  return (
                    <li
                      key={node.id}
                      className={`relative min-w-0 rounded-md border p-3 ${
                        selected
                          ? 'border-cyan-400 bg-white text-neutral-950 shadow-sm dark:border-cyan-700 dark:bg-neutral-950 dark:text-white'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{node.label}</p>
                          <p className="mt-1 text-xs">{node.rack}</p>
                        </div>
                        {selected ? (
                          <span className="rounded bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
                            {replicaIndex === 0 ? 'Primary' : `Replica ${replicaIndex + 1}`}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs tabular-nums">
                        Token position {node.tokenPosition}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className={`rounded-md border p-5 ${
              isHot
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
            }`}>
              <div className="flex items-start gap-3">
                {isHot ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <h4 className="text-base font-semibold">
                    {isHot
                      ? 'The logical key concentrates this workload'
                      : 'The extra key dimensions spread active writes'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {selectedShape.consequence}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
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
    <LearningLabBody>
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Partition model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
          />
          Loading partition and placement model...
        </div>
      )}
    </LearningLabBody>
  );
}
