'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Network,
  ShieldCheck,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };

type Replica = {
  id: string;
  label: string;
  latencyMs: number;
};

type FailureScenario = {
  failedCount: number;
  failedReplicaIds: string[];
  detail: string;
};

type QuorumModel = {
  replicaCount: number;
  defaults: {
    readQuorum: number;
    writeQuorum: number;
    failedReplicas: number;
  };
  bounds: {
    readQuorum: Bound;
    writeQuorum: Bound;
    failedReplicas: Bound;
  };
  coordinationOverheadMs: {
    read: number;
    write: number;
  };
  replicas: Replica[];
  failureScenarios: FailureScenario[];
};

function operationLatency(
  liveReplicas: Replica[],
  quorum: number,
  overheadMs: number,
): number | null {
  if (liveReplicas.length < quorum) return null;
  return liveReplicas[quorum - 1].latencyMs + overheadMs;
}

function formatLatency(value: number | null) {
  return value === null ? 'Unavailable' : `${value} ms`;
}

export default function CapTheoremQuorumLatencyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QuorumModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readQuorum, setReadQuorum] = useState(3);
  const [writeQuorum, setWriteQuorum] = useState(3);
  const [failedReplicas, setFailedReplicas] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The quorum-latency model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<QuorumModel>;
      })
      .then((model) => {
        if (model.replicaCount !== model.replicas.length || model.failureScenarios.length < 1) {
          throw new Error('The quorum-latency model has an invalid replica set.');
        }
        setData(model);
        setReadQuorum(model.defaults.readQuorum);
        setWriteQuorum(model.defaults.writeQuorum);
        setFailedReplicas(model.defaults.failedReplicas);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the quorum model.');
      });

    return () => controller.abort();
  }, [dataFile]);

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
    const readAvailable = readLatency !== null;
    const writeAvailable = writeLatency !== null;
    const readWriteOverlap = readQuorum + writeQuorum > data.replicaCount;
    const writeWriteOverlap = writeQuorum * 2 > data.replicaCount;
    const readAckIds = new Set(
      liveReplicas.slice(0, Math.min(readQuorum, liveReplicas.length)).map((replica) => replica.id),
    );
    const writeAckIds = new Set(
      liveReplicas.slice(0, Math.min(writeQuorum, liveReplicas.length)).map((replica) => replica.id),
    );

    return {
      scenario,
      failedIds,
      liveReplicas,
      readLatency,
      writeLatency,
      readAvailable,
      writeAvailable,
      readWriteOverlap,
      writeWriteOverlap,
      readAckIds,
      writeAckIds,
    };
  }, [data, failedReplicas, readQuorum, writeQuorum]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !view) return <LabLoading />;

  const unavailable = !view.readAvailable || !view.writeAvailable;
  const overlapComplete = view.readWriteOverlap && view.writeWriteOverlap;
  const warning = unavailable || !overlapComplete;
  const consequence = unavailable
    ? `${!view.readAvailable && !view.writeAvailable ? 'Reads and writes' : !view.readAvailable ? 'Reads' : 'Writes'} cannot collect enough acknowledgements from ${view.liveReplicas.length} live replicas. Lowering a quorum restores completion but may remove required overlap.`
    : !view.readWriteOverlap && !view.writeWriteOverlap
      ? 'The selected quorums complete quickly, but reads need not intersect the latest completed write and two write quorums need not intersect each other.'
      : !view.readWriteOverlap
        ? 'Write quorums intersect each other, but a read quorum can miss every replica in the latest completed write quorum.'
        : !view.writeWriteOverlap
          ? 'Reads intersect completed writes, but two coordinators can form disjoint write quorums. The write protocol needs a stronger authority rule or a larger W.'
          : 'Both overlap conditions hold and the current failures still leave enough acknowledgements. Version, leader, fencing, and retry rules must still enforce the intended consistency model.';
  const reset = () => {
    setReadQuorum(data.defaults.readQuorum);
    setWriteQuorum(data.defaults.writeQuorum);
    setFailedReplicas(data.defaults.failedReplicas);
  };

  return (
    <div data-content-block="reference/cap-theorem-quorum-latency-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Quorum and latency lab"
          title="Move the acknowledgement frontier"
          description="Tune read and write quorums, then remove replicas. The model shows which acknowledgements are required, when operations stop completing, and whether quorum intersections still hold."
          icon={Gauge}
          accent="amber"
          onReset={reset}
        />
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
                  <Network aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                  Injected topology
                </div>
                <p className="mt-2">{view.scenario.detail}</p>
              </div>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled read"
                value={formatLatency(view.readLatency)}
                detail={
                  view.readAvailable
                    ? `Wait for the ${readQuorum}${readQuorum === 1 ? 'st' : readQuorum === 2 ? 'nd' : readQuorum === 3 ? 'rd' : 'th'} live acknowledgement plus coordination overhead.`
                    : `${view.liveReplicas.length} live replicas cannot satisfy R = ${readQuorum}.`
                }
                icon={Clock3}
                tone={view.readAvailable ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Modeled write"
                value={formatLatency(view.writeLatency)}
                detail={
                  view.writeAvailable
                    ? `Wait for the ${writeQuorum}${writeQuorum === 1 ? 'st' : writeQuorum === 2 ? 'nd' : writeQuorum === 3 ? 'rd' : 'th'} live acknowledgement plus coordination overhead.`
                    : `${view.liveReplicas.length} live replicas cannot satisfy W = ${writeQuorum}.`
                }
                icon={Database}
                tone={view.writeAvailable ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Read/write overlap"
                value={`${readQuorum} + ${writeQuorum} ${view.readWriteOverlap ? '>' : '<='} ${data.replicaCount}`}
                detail={
                  view.readWriteOverlap
                    ? 'Every read quorum intersects every completed write quorum.'
                    : 'A read quorum can miss an entire completed write quorum.'
                }
                icon={ShieldCheck}
                tone={view.readWriteOverlap ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Write/write overlap"
                value={`${writeQuorum * 2} ${view.writeWriteOverlap ? '>' : '<='} ${data.replicaCount}`}
                detail={
                  view.writeWriteOverlap
                    ? 'Any two write quorums share at least one replica.'
                    : 'Two write quorums can be disjoint.'
                }
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
                  Healthy replicas are ordered by modeled response time. Blue and violet badges show the responses each operation waits for.
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
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <p className="text-xs font-semibold uppercase opacity-75">Read failure budget</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {data.replicaCount - readQuorum} replicas
                </p>
                <p className="mt-1 text-xs leading-5 opacity-80">N - R before a read quorum is impossible.</p>
              </div>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
                <p className="text-xs font-semibold uppercase opacity-75">Write failure budget</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {data.replicaCount - writeQuorum} replicas
                </p>
                <p className="mt-1 text-xs leading-5 opacity-80">N - W before a write quorum is impossible.</p>
              </div>
            </div>

            <section
              className={`mt-5 rounded-md border p-5 ${
                unavailable
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                  : warning
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {unavailable ? (
                  <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : warning ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">Quorum consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block="reference/cap-theorem-quorum-latency-lab">
      <div
        className="min-h-[700px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading quorum-latency model"
      />
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block="reference/cap-theorem-quorum-latency-lab">
      <div
        className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Quorum-latency model unavailable</p>
        <p className="mt-2 opacity-80">{detail}</p>
      </div>
    </div>
  );
}
