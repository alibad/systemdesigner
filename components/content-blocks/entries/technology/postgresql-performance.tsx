'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  MemoryStick,
  Network,
  Server,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  activeQueryPercent: number;
  memoryOperatorsPerQuery: number;
  averageQueryMs: number;
  tpsPerActiveConnection: number;
};
type EnvelopeData = {
  title: string;
  description: string;
  host: {
    ramGb: number;
    osReserveGb: number;
    maintenanceReserveGb: number;
    connectionOverheadMb: number;
  };
  defaults: {
    workloadId: string;
    clientConnections: number;
    serverConnections: number;
    sharedBuffersGb: number;
    workMemMb: number;
  };
  bounds: {
    clientConnections: Bound;
    serverConnections: Bound;
    sharedBuffersGb: Bound;
    workMemMb: Bound;
  };
  workloads: Workload[];
};

const BLOCK_ID = 'technology/postgresql-performance';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isEnvelopeData(value: unknown): value is EnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EnvelopeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.host
      && typeof candidate.host.ramGb === 'number'
      && typeof candidate.host.osReserveGb === 'number'
      && typeof candidate.host.maintenanceReserveGb === 'number'
      && typeof candidate.host.connectionOverheadMb === 'number'
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.clientConnections === 'number'
      && typeof candidate.defaults.serverConnections === 'number'
      && typeof candidate.defaults.sharedBuffersGb === 'number'
      && typeof candidate.defaults.workMemMb === 'number'
      && isBound(candidate.bounds?.clientConnections)
      && isBound(candidate.bounds?.serverConnections)
      && isBound(candidate.bounds?.sharedBuffersGb)
      && isBound(candidate.bounds?.workMemMb)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0,
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function PostgreSQLPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<EnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No PostgreSQL capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEnvelopeData(payload)) throw new Error('The capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ConnectionEnvelopeWorkbench data={data} />;
}

function ConnectionEnvelopeWorkbench({ data }: { data: EnvelopeData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [clientConnections, setClientConnections] = useState(data.defaults.clientConnections);
  const [serverConnections, setServerConnections] = useState(data.defaults.serverConnections);
  const [sharedBuffersGb, setSharedBuffersGb] = useState(data.defaults.sharedBuffersGb);
  const [workMemMb, setWorkMemMb] = useState(data.defaults.workMemMb);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const activeQueries = Math.max(
      1,
      Math.min(serverConnections, Math.ceil(clientConnections * workload.activeQueryPercent / 100)),
    );
    const operatorMemoryGb = activeQueries * workload.memoryOperatorsPerQuery * workMemMb / 1024;
    const connectionMemoryGb = serverConnections * data.host.connectionOverheadMb / 1024;
    const committedMemoryGb = sharedBuffersGb
      + operatorMemoryGb
      + connectionMemoryGb
      + data.host.osReserveGb
      + data.host.maintenanceReserveGb;
    const headroomGb = data.host.ramGb - committedMemoryGb;
    const memoryUsePercent = committedMemoryGb / data.host.ramGb * 100;
    const queueDepth = Math.max(0, clientConnections - serverConnections);
    const queueWaves = Math.max(0, clientConnections / Math.max(serverConnections, 1) - 1);
    const queueDelayMs = Math.round(queueWaves * workload.averageQueryMs);
    const modeledTps = activeQueries * workload.tpsPerActiveConnection;
    const poolRatio = clientConnections / serverConnections;

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The pool protects PostgreSQL and preserves host headroom';
    let detail = 'Client concurrency is multiplexed onto a bounded server pool, while query memory leaves room for maintenance and cache behavior.';

    if (headroomGb < 0) {
      tone = 'rose';
      verdict = 'The configured memory envelope exceeds physical RAM';
      detail = 'work_mem is available per active sort or hash operation, not once per server. Reduce pool width or per-operator memory before load can trigger swapping or termination.';
    } else if (memoryUsePercent > 88) {
      tone = 'rose';
      verdict = 'Memory headroom is too small for burst and maintenance work';
      detail = 'Autovacuum, index builds, parallel workers, and uneven query plans can exceed this steady-state estimate. Keep an explicit reserve rather than filling RAM on paper.';
    } else if (queueDelayMs > 250) {
      tone = 'amber';
      verdict = 'The database is protected, but clients wait too long at the pool';
      detail = 'A queue is safer than unbounded backends, but sustained delay means demand exceeds useful database concurrency. Scale the read path, reduce query time, or shed load.';
    } else if (poolRatio < 2 && serverConnections > 200) {
      tone = 'amber';
      verdict = 'The pool is barely multiplexing client demand';
      detail = 'Many PostgreSQL backends consume memory and scheduling overhead. Keep only the concurrency the workload can use, then queue excess clients outside the server.';
    }

    return {
      activeQueries,
      committedMemoryGb,
      detail,
      headroomGb,
      memoryUsePercent,
      modeledTps,
      operatorMemoryGb,
      poolRatio,
      queueDelayMs,
      queueDepth,
      tone,
      verdict,
    };
  }, [clientConnections, data.host, serverConnections, sharedBuffersGb, workMemMb, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setClientConnections(data.defaults.clientConnections);
    setServerConnections(data.defaults.serverConnections);
    setSharedBuffersGb(data.defaults.sharedBuffersGb);
    setWorkMemMb(data.defaults.workMemMb);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Connection and memory lab"
          title={data.title}
          description={data.description}
          icon={Database}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Activity}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Client connections"
                value={clientConnections}
                output={clientConnections.toLocaleString()}
                min={data.bounds.clientConnections.min}
                max={data.bounds.clientConnections.max}
                step={data.bounds.clientConnections.step}
                lowLabel="Small service"
                highLabel="Fleet burst"
                accent="cyan"
                onChange={setClientConnections}
              />
              <LabRange
                label="PostgreSQL backends"
                value={serverConnections}
                output={serverConnections.toLocaleString()}
                min={data.bounds.serverConnections.min}
                max={data.bounds.serverConnections.max}
                step={data.bounds.serverConnections.step}
                lowLabel="Tight pool"
                highLabel="Wide pool"
                accent="blue"
                onChange={setServerConnections}
              />
              <LabRange
                label="Shared buffers"
                value={sharedBuffersGb}
                output={`${sharedBuffersGb} GB`}
                min={data.bounds.sharedBuffersGb.min}
                max={data.bounds.sharedBuffersGb.max}
                step={data.bounds.sharedBuffersGb.step}
                lowLabel="More OS cache"
                highLabel="More PostgreSQL cache"
                accent="violet"
                onChange={setSharedBuffersGb}
              />
              <LabRange
                label="work_mem"
                value={workMemMb}
                output={`${workMemMb} MB`}
                min={data.bounds.workMemMb.min}
                max={data.bounds.workMemMb.max}
                step={data.bounds.workMemMb.step}
                lowLabel="More spills"
                highLabel="More RAM per operator"
                accent="amber"
                onChange={setWorkMemMb}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Active queries"
                value={String(result.activeQueries)}
                detail={`${result.poolRatio.toFixed(1)} client connections per backend`}
                icon={Users}
                tone="blue"
              />
              <LabMetric
                label="Memory envelope"
                value={`${result.committedMemoryGb.toFixed(1)} GB`}
                detail={`${Math.max(0, result.headroomGb).toFixed(1)} GB host headroom`}
                icon={MemoryStick}
                tone={result.memoryUsePercent <= 75 ? 'emerald' : result.memoryUsePercent <= 88 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Pool wait"
                value={`${result.queueDelayMs} ms`}
                detail={`${result.queueDepth.toLocaleString()} clients beyond pool width`}
                icon={Clock3}
                tone={result.queueDelayMs <= 100 ? 'emerald' : result.queueDelayMs <= 250 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Modeled throughput"
                value={`${formatCompact(result.modeledTps)} TPS`}
                detail="Planning estimate, not a benchmark"
                icon={Gauge}
                tone="cyan"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-neutral-900 dark:text-white">Host memory commitment</span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                  {result.memoryUsePercent.toFixed(0)}% of {data.host.ramGb} GB
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    result.memoryUsePercent <= 75
                      ? 'bg-emerald-500'
                      : result.memoryUsePercent <= 88
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, result.memoryUsePercent)}%` }}
                />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
                <p>Shared cache: {sharedBuffersGb.toFixed(1)} GB</p>
                <p>Active query operators: {result.operatorMemoryGb.toFixed(1)} GB</p>
                <p>OS reserve: {data.host.osReserveGb.toFixed(1)} GB</p>
                <p>Maintenance reserve: {data.host.maintenanceReserveGb.toFixed(1)} GB</p>
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <Network aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Pooling changes where clients wait; it does not make a slow query faster. Validate this envelope with real plans, concurrency tests, and peak maintenance work.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <Server aria-hidden="true" className="h-5 w-5 animate-pulse motion-reduce:animate-none" />
        Loading the PostgreSQL capacity model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Capacity lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
