'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Network,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Replica = { id: string; label: string; latencyMs: number };
type FailureScenario = { failedCount: number; failedReplicaIds: string[]; detail: string };

type QuorumModel = {
  replicaCount: number;
  defaults: { readQuorum: number; writeQuorum: number; failedReplicas: number };
  bounds: { readQuorum: Bound; writeQuorum: Bound; failedReplicas: Bound };
  coordinationOverheadMs: { read: number; write: number };
  replicas: Replica[];
  failureScenarios: FailureScenario[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/advanced-scaling/data/replication-quorum-model.json';

function operationLatency(liveReplicas: Replica[], quorum: number, overheadMs: number) {
  if (liveReplicas.length < quorum) return null;
  return liveReplicas[quorum - 1].latencyMs + overheadMs;
}

function formatLatency(value: number | null) {
  return value === null ? 'Unavailable' : `${value} ms`;
}

export default function AdvancedScalingQuorumLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<QuorumModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [readQuorum, setReadQuorum] = useState(3);
  const [writeQuorum, setWriteQuorum] = useState(3);
  const [failedReplicas, setFailedReplicas] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<QuorumModel>;
      })
      .then((model) => {
        if (model.replicaCount !== model.replicas.length || model.failureScenarios.length < 1) {
          throw new Error('The quorum model has an invalid replica set.');
        }
        setData(model);
        setReadQuorum(model.defaults.readQuorum);
        setWriteQuorum(model.defaults.writeQuorum);
        setFailedReplicas(model.defaults.failedReplicas);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load quorum data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const scenario =
      data.failureScenarios.find((item) => item.failedCount === failedReplicas) ??
      data.failureScenarios[0];
    const failedIds = new Set(scenario.failedReplicaIds);
    const liveReplicas = data.replicas
      .filter((replica) => !failedIds.has(replica.id))
      .sort((left, right) => left.latencyMs - right.latencyMs);
    const readLatency = operationLatency(
      liveReplicas,
      readQuorum,
      data.coordinationOverheadMs.read,
    );
    const writeLatency = operationLatency(
      liveReplicas,
      writeQuorum,
      data.coordinationOverheadMs.write,
    );
    const readWriteOverlap = readQuorum + writeQuorum > data.replicaCount;
    const writeWriteOverlap = writeQuorum * 2 > data.replicaCount;
    const readAckIds = new Set(
      liveReplicas.slice(0, Math.min(readQuorum, liveReplicas.length)).map((item) => item.id),
    );
    const writeAckIds = new Set(
      liveReplicas.slice(0, Math.min(writeQuorum, liveReplicas.length)).map((item) => item.id),
    );

    return {
      failedIds,
      liveReplicas,
      readAckIds,
      readLatency,
      readWriteOverlap,
      scenario,
      writeAckIds,
      writeLatency,
      writeWriteOverlap,
    };
  }, [data, failedReplicas, readQuorum, writeQuorum]);

  function reset() {
    if (!data) return;
    setReadQuorum(data.defaults.readQuorum);
    setWriteQuorum(data.defaults.writeQuorum);
    setFailedReplicas(data.defaults.failedReplicas);
  }

  const unavailable = Boolean(view && (view.readLatency === null || view.writeLatency === null));
  const overlapMissing = Boolean(
    view && (!view.readWriteOverlap || !view.writeWriteOverlap),
  );

  return (
    <div data-content-block="fundamentals/advanced-scaling-quorum-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replica failure lab"
          title="Move the acknowledgement frontier"
          description="Tune read and write quorums, then remove replicas. Watch latency, failure tolerance, and quorum overlap change as one coupled contract."
          icon={Gauge}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {loadError ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Quorum data could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none"
                />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Loading replica model...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <LabRange
                  label="Read quorum R"
                  value={readQuorum}
                  output={`${readQuorum} of ${data.replicaCount}`}
                  {...data.bounds.readQuorum}
                  accent="blue"
                  lowLabel="fastest one"
                  highLabel="all replicas"
                  onChange={setReadQuorum}
                />
                <LabRange
                  label="Write quorum W"
                  value={writeQuorum}
                  output={`${writeQuorum} of ${data.replicaCount}`}
                  {...data.bounds.writeQuorum}
                  accent="violet"
                  lowLabel="fastest one"
                  highLabel="all replicas"
                  onChange={setWriteQuorum}
                />
                <LabRange
                  label="Failed replicas"
                  value={failedReplicas}
                  output={`${failedReplicas}`}
                  {...data.bounds.failedReplicas}
                  accent="rose"
                  lowLabel="healthy set"
                  highLabel="one survivor"
                  onChange={setFailedReplicas}
                />
                <div className="rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
                    <Network aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                    Injected topology
                  </div>
                  <p className="mt-2">{view.scenario.detail}</p>
                </div>
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Modeled read"
                  value={formatLatency(view.readLatency)}
                  detail={view.readLatency === null ? `${view.liveReplicas.length} live replicas cannot satisfy R = ${readQuorum}.` : `Waits for ${readQuorum} acknowledgements plus coordination.`}
                  icon={Clock3}
                  tone={view.readLatency === null ? 'rose' : 'blue'}
                />
                <LabMetric
                  label="Modeled write"
                  value={formatLatency(view.writeLatency)}
                  detail={view.writeLatency === null ? `${view.liveReplicas.length} live replicas cannot satisfy W = ${writeQuorum}.` : `Waits for ${writeQuorum} acknowledgements plus durable coordination.`}
                  icon={Database}
                  tone={view.writeLatency === null ? 'rose' : 'violet'}
                />
                <LabMetric
                  label="Read/write overlap"
                  value={`${readQuorum} + ${writeQuorum} ${view.readWriteOverlap ? '>' : '<='} ${data.replicaCount}`}
                  detail={view.readWriteOverlap ? 'Every read quorum intersects a completed write quorum.' : 'A read can miss an entire completed write quorum.'}
                  icon={ShieldCheck}
                  tone={view.readWriteOverlap ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Write/write overlap"
                  value={`${writeQuorum * 2} ${view.writeWriteOverlap ? '>' : '<='} ${data.replicaCount}`}
                  detail={view.writeWriteOverlap ? 'Any two write quorums share a replica.' : 'Two write quorums can be disjoint.'}
                  icon={ShieldCheck}
                  tone={view.writeWriteOverlap ? 'emerald' : 'amber'}
                />
              </div>

              <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Acknowledgement frontier
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Replicas are ordered by modeled response time. Badges show which live responses each operation waits for.
                  </p>
                </header>
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  {data.replicas.map((replica) => {
                    const failed = view.failedIds.has(replica.id);
                    const readAck = view.readAckIds.has(replica.id);
                    const writeAck = view.writeAckIds.has(replica.id);
                    return (
                      <div
                        key={replica.id}
                        className={`rounded-md border p-3 ${
                          failed
                            ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                            : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                            {failed ? (
                              <WifiOff aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                            ) : (
                              <Database aria-hidden="true" className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                            )}
                            {replica.label}
                          </span>
                          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                            {replica.latencyMs} ms
                          </span>
                        </div>
                        <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                          {failed ? (
                            <span className="rounded bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-800 dark:bg-rose-900 dark:text-rose-100">
                              Failed
                            </span>
                          ) : (
                            <>
                              {readAck ? (
                                <span className="rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                  Read ack
                                </span>
                              ) : null}
                              {writeAck ? (
                                <span className="rounded bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">
                                  Write ack
                                </span>
                              ) : null}
                              {!readAck && !writeAck ? (
                                <span className="rounded bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                  Not awaited
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <LabMetric
                  label="Read failure budget"
                  value={`${data.replicaCount - readQuorum} replicas`}
                  detail="N - R failures before this read quorum is impossible."
                  icon={ShieldCheck}
                  tone="blue"
                />
                <LabMetric
                  label="Write failure budget"
                  value={`${data.replicaCount - writeQuorum} replicas`}
                  detail="N - W failures before this write quorum is impossible."
                  icon={ShieldCheck}
                  tone="violet"
                />
              </div>

              <section
                className={`mt-5 rounded-md border p-4 ${
                  unavailable
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                    : overlapMissing
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {unavailable || overlapMissing ? (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {unavailable
                        ? 'The selected operation cannot collect enough acknowledgements'
                        : overlapMissing
                          ? 'The operations complete without all intended overlap'
                          : 'Both overlap checks hold under the injected failures'}
                    </p>
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      {unavailable
                        ? 'Lowering a quorum may restore completion, but it can also remove the overlap required by the consistency protocol.'
                        : overlapMissing
                          ? 'Fast completion is not the same as safe coordination. Increase the appropriate quorum or use a stronger authority rule.'
                          : 'Version checks, fencing, durable acknowledgement, and idempotent retries are still required for the complete guarantee.'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
