'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  Database,
  Gauge,
  Layers3,
  MemoryStick,
  Network,
  Server,
  ShieldCheck,
  TriangleAlert,
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

type Range = {
  min: number;
  max: number;
  step: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  distinctPools: number;
  activeClientPercent: number;
  averageTransactionMs: number;
};

type CapacityData = {
  title: string;
  description: string;
  database: {
    maxConnections: number;
    postgresReservedConnections: number;
    directConnections: number;
    estimatedPrivateMemoryMbPerBackend: number;
  };
  defaults: {
    workloadId: string;
    clientConnections: number;
    pgbouncerInstances: number;
    poolSize: number;
    reservePoolSize: number;
    reservePoolTimeoutSeconds: number;
    queryWaitTimeoutSeconds: number;
  };
  bounds: {
    clientConnections: Range;
    pgbouncerInstances: Range;
    poolSize: Range;
    reservePoolSize: Range;
    reservePoolTimeoutSeconds: Range;
    queryWaitTimeoutSeconds: Range;
  };
  workloads: Workload[];
};

const BLOCK_ID = 'technology/pgbouncer-performance';

function isRange(value: unknown): value is Range {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<Range>;
  return (
    typeof range.min === 'number'
    && typeof range.max === 'number'
    && typeof range.step === 'number'
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.database?.maxConnections === 'number'
      && typeof candidate.database.postgresReservedConnections === 'number'
      && typeof candidate.database.directConnections === 'number'
      && typeof candidate.database.estimatedPrivateMemoryMbPerBackend === 'number'
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.clientConnections === 'number'
      && typeof candidate.defaults.pgbouncerInstances === 'number'
      && typeof candidate.defaults.poolSize === 'number'
      && typeof candidate.defaults.reservePoolSize === 'number'
      && typeof candidate.defaults.reservePoolTimeoutSeconds === 'number'
      && typeof candidate.defaults.queryWaitTimeoutSeconds === 'number'
      && candidate.bounds
      && isRange(candidate.bounds.clientConnections)
      && isRange(candidate.bounds.pgbouncerInstances)
      && isRange(candidate.bounds.poolSize)
      && isRange(candidate.bounds.reservePoolSize)
      && isRange(candidate.bounds.reservePoolTimeoutSeconds)
      && isRange(candidate.bounds.queryWaitTimeoutSeconds)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0,
  );
}

export default function PgBouncerPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No connection-capacity model was supplied.');
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
        if (!isCapacityData(payload)) throw new Error('The connection-capacity model is incomplete.');
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
  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [clientConnections, setClientConnections] = useState(data.defaults.clientConnections);
  const [pgbouncerInstances, setPgBouncerInstances] = useState(data.defaults.pgbouncerInstances);
  const [poolSize, setPoolSize] = useState(data.defaults.poolSize);
  const [reservePoolSize, setReservePoolSize] = useState(data.defaults.reservePoolSize);
  const [reservePoolTimeoutSeconds, setReservePoolTimeoutSeconds] = useState(
    data.defaults.reservePoolTimeoutSeconds,
  );
  const [queryWaitTimeoutSeconds, setQueryWaitTimeoutSeconds] = useState(
    data.defaults.queryWaitTimeoutSeconds,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const safeServerBudget = Math.max(
      0,
      data.database.maxConnections
        - data.database.postgresReservedConnections
        - data.database.directConnections,
    );
    const totalPools = pgbouncerInstances * workload.distinctPools;
    const configuredBaseConnections = totalPools * poolSize;
    const configuredReserveConnections = totalPools * reservePoolSize;
    const budgetPerPool = Math.floor(safeServerBudget / Math.max(1, totalPools));
    const baseSlotsPerPool = Math.min(poolSize, budgetPerPool);
    const activeClients = Math.ceil(clientConnections * workload.activeClientPercent / 100);
    const demandPerPool = Math.ceil(activeClients / Math.max(1, totalPools));
    const baseWaitWaves = baseSlotsPerPool > 0
      ? Math.max(0, Math.ceil(demandPerPool / baseSlotsPerPool) - 1)
      : Number.POSITIVE_INFINITY;
    const baseWaitMs = baseWaitWaves * workload.averageTransactionMs;
    const reserveTriggered = (
      reservePoolSize > 0
      && baseWaitMs >= reservePoolTimeoutSeconds * 1000
    );
    const reserveSlotsPerPool = reserveTriggered
      ? Math.min(reservePoolSize, Math.max(0, budgetPerPool - baseSlotsPerPool))
      : 0;
    const effectiveSlotsPerPool = baseSlotsPerPool + reserveSlotsPerPool;
    const effectiveServerCapacity = effectiveSlotsPerPool * totalPools;
    const waitWaves = effectiveSlotsPerPool > 0
      ? Math.max(0, Math.ceil(demandPerPool / effectiveSlotsPerPool) - 1)
      : Number.POSITIVE_INFINITY;
    const estimatedWaitMs = waitWaves * workload.averageTransactionMs;
    const queueDepth = Math.max(0, activeClients - effectiveServerCapacity);
    const openedServerConnections = Math.min(activeClients, effectiveServerCapacity);
    const timeoutRisk = estimatedWaitMs >= queryWaitTimeoutSeconds * 1000;
    const baseOverBudget = configuredBaseConnections > safeServerBudget;
    const reserveOverBudget = (
      configuredBaseConnections + configuredReserveConnections > safeServerBudget
    );
    const directBackendsAdmitted = Math.min(clientConnections, safeServerBudget);
    const directConnectionsRefused = Math.max(0, clientConnections - safeServerBudget);
    const directMemoryMb = (
      directBackendsAdmitted * data.database.estimatedPrivateMemoryMbPerBackend
    );
    const pooledMemoryMb = (
      openedServerConnections * data.database.estimatedPrivateMemoryMbPerBackend
    );

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The base pools fit and active demand stays inside the wait budget';
    let detail = 'PgBouncer bounds PostgreSQL backends while idle client sockets remain outside the database.';

    if (baseOverBudget) {
      tone = 'rose';
      verdict = 'The base pools alone exceed the PostgreSQL connection budget';
      detail = 'Reduce pool_size, the number of independent pools, or the number of PgBouncer instances before traffic can open these server connections.';
    } else if (timeoutRisk) {
      tone = 'rose';
      verdict = 'The modeled queue outlives query_wait_timeout';
      detail = 'Clients at the tail can be disconnected before assignment. Reduce transaction time or demand before widening the pool against a saturated database.';
    } else if (reserveOverBudget) {
      tone = 'amber';
      verdict = 'Configured reserve pools can overrun the database budget';
      detail = 'The model clips usable reserve slots to the safe budget. Enforce a database-wide cap and leave PostgreSQL-reserved connections untouched.';
    } else if (estimatedWaitMs > 500) {
      tone = 'amber';
      verdict = 'The pool protects PostgreSQL, but queue delay is material';
      detail = 'Sustained wait is a capacity signal. Check database headroom and transaction duration before increasing concurrency.';
    } else if (reserveTriggered) {
      tone = 'amber';
      verdict = 'Reserve connections absorb the modeled burst';
      detail = 'Reserve capacity reduces the tail temporarily, but it consumes real PostgreSQL slots and must not become the steady state.';
    }

    return {
      activeClients,
      baseOverBudget,
      configuredBaseConnections,
      configuredReserveConnections,
      directConnectionsRefused,
      directMemoryMb,
      effectiveServerCapacity,
      estimatedWaitMs,
      openedServerConnections,
      pooledMemoryMb,
      queueDepth,
      reserveOverBudget,
      reserveSlotsPerPool,
      reserveTriggered,
      safeServerBudget,
      timeoutRisk,
      tone,
      totalPools,
      verdict,
      detail,
    };
  }, [
    clientConnections,
    data.database,
    pgbouncerInstances,
    poolSize,
    queryWaitTimeoutSeconds,
    reservePoolSize,
    reservePoolTimeoutSeconds,
    workload,
  ]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setClientConnections(data.defaults.clientConnections);
    setPgBouncerInstances(data.defaults.pgbouncerInstances);
    setPoolSize(data.defaults.poolSize);
    setReservePoolSize(data.defaults.reservePoolSize);
    setReservePoolTimeoutSeconds(data.defaults.reservePoolTimeoutSeconds);
    setQueryWaitTimeoutSeconds(data.defaults.queryWaitTimeoutSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Connection and queue lab"
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
                      accent="cyan"
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
                lowLabel="Small fleet"
                highLabel="Connection burst"
                accent="cyan"
                onChange={setClientConnections}
              />
              <LabRange
                label="PgBouncer instances"
                value={pgbouncerInstances}
                output={String(pgbouncerInstances)}
                min={data.bounds.pgbouncerInstances.min}
                max={data.bounds.pgbouncerInstances.max}
                step={data.bounds.pgbouncerInstances.step}
                lowLabel="One pooler"
                highLabel="Four replicas"
                accent="blue"
                onChange={setPgBouncerInstances}
              />
              <LabRange
                label="pool_size per pool"
                value={poolSize}
                output={String(poolSize)}
                min={data.bounds.poolSize.min}
                max={data.bounds.poolSize.max}
                step={data.bounds.poolSize.step}
                lowLabel="Queue sooner"
                highLabel="More backends"
                accent="violet"
                onChange={setPoolSize}
              />
              <LabRange
                label="reserve_pool_size"
                value={reservePoolSize}
                output={String(reservePoolSize)}
                min={data.bounds.reservePoolSize.min}
                max={data.bounds.reservePoolSize.max}
                step={data.bounds.reservePoolSize.step}
                lowLabel="Disabled"
                highLabel="Large overflow"
                accent="amber"
                onChange={setReservePoolSize}
              />
              <LabRange
                label="reserve_pool_timeout"
                value={reservePoolTimeoutSeconds}
                output={`${reservePoolTimeoutSeconds}s`}
                min={data.bounds.reservePoolTimeoutSeconds.min}
                max={data.bounds.reservePoolTimeoutSeconds.max}
                step={data.bounds.reservePoolTimeoutSeconds.step}
                lowLabel="Open reserve sooner"
                highLabel="Queue longer"
                accent="amber"
                onChange={setReservePoolTimeoutSeconds}
              />
              <LabRange
                label="query_wait_timeout"
                value={queryWaitTimeoutSeconds}
                output={`${queryWaitTimeoutSeconds}s`}
                min={data.bounds.queryWaitTimeoutSeconds.min}
                max={data.bounds.queryWaitTimeoutSeconds.max}
                step={data.bounds.queryWaitTimeoutSeconds.step}
                lowLabel="Fail fast"
                highLabel="Wait longer"
                accent="rose"
                onChange={setQueryWaitTimeoutSeconds}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Client fan-in"
                value={clientConnections.toLocaleString()}
                detail={`${result.activeClients.toLocaleString()} modeled active clients`}
                icon={Users}
                tone="cyan"
              />
              <LabMetric
                label="Independent pools"
                value={String(result.totalPools)}
                detail={`${pgbouncerInstances} instances x ${workload.distinctPools} database/user pairs`}
                icon={Layers3}
                tone="violet"
              />
              <LabMetric
                label="Server capacity"
                value={String(result.effectiveServerCapacity)}
                detail={`${result.openedServerConnections} modeled open backends`}
                icon={Server}
                tone={result.baseOverBudget ? 'rose' : result.reserveTriggered ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Tail queue wait"
                value={formatDuration(result.estimatedWaitMs)}
                detail={`${result.queueDepth.toLocaleString()} active clients beyond current slots`}
                icon={Clock3}
                tone={result.timeoutRisk ? 'rose' : result.estimatedWaitMs > 500 ? 'amber' : 'emerald'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  PostgreSQL server-connection budget
                </p>
                <p className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                  {result.safeServerBudget} usable of {data.database.maxConnections} max
                </p>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full transition-[width] motion-reduce:transition-none ${
                    result.baseOverBudget ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${Math.min(100, result.configuredBaseConnections / Math.max(1, result.safeServerBudget) * 100)}%`,
                  }}
                  title={`${result.configuredBaseConnections} configured base connections`}
                />
                <div
                  className={`h-full transition-[width] motion-reduce:transition-none ${
                    result.reserveOverBudget ? 'bg-rose-300 dark:bg-rose-700' : 'bg-amber-400'
                  }`}
                  style={{
                    width: `${Math.min(
                      Math.max(0, 100 - result.configuredBaseConnections / Math.max(1, result.safeServerBudget) * 100),
                      result.configuredReserveConnections / Math.max(1, result.safeServerBudget) * 100,
                    )}%`,
                  }}
                  title={`${result.configuredReserveConnections} configured reserve connections`}
                />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
                <p>Base configured: {result.configuredBaseConnections}</p>
                <p>Reserve configured: {result.configuredReserveConnections}</p>
                <p>PostgreSQL-reserved: {data.database.postgresReservedConnections}</p>
                <p>Direct/non-pooled: {data.database.directConnections}</p>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Database aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Direct-to-PostgreSQL fan-in
                  </h4>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {result.directConnectionsRefused.toLocaleString()} refused
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  {clientConnections.toLocaleString()} clients request one backend each; the modeled
                  safe budget admits {Math.min(clientConnections, result.safeServerBudget)}.
                </p>
                <p className="mt-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  Rough private-memory envelope: {formatMemory(result.directMemoryMb)}
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    PgBouncer-bounded fan-in
                  </h4>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {result.openedServerConnections} backends
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Client sockets remain connected to PgBouncer while active work is admitted through
                  the server pools.
                </p>
                <p className="mt-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  Rough private-memory envelope: {formatMemory(result.pooledMemoryMb)}
                </p>
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
                {result.tone === 'rose' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                ) : (
                  <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {result.verdict}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.detail}
                  </p>
                  <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-300">
                    Reserve status: {result.reserveTriggered
                      ? `${result.reserveSlotsPerPool} extra slots per pool are eligible`
                      : 'not triggered'}.
                  </p>
                </div>
              </div>
            </section>

            <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <MemoryStick aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Memory uses a planning estimate of {data.database.estimatedPrivateMemoryMbPerBackend} MB
              per PostgreSQL backend. Measure your process and query-memory profile; this is not a
              benchmark or a complete host-memory model.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return 'Blocked';
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.round(milliseconds)}ms`;
}

function formatMemory(megabytes: number) {
  if (megabytes >= 1024) return `${(megabytes / 1024).toFixed(1)} GB`;
  return `${Math.round(megabytes)} MB`;
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className="min-h-[760px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading PgBouncer connection-capacity lab"
      />
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        role="alert"
        className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      >
        <p className="font-semibold">The connection-capacity lab could not load.</p>
        <p className="mt-2 opacity-80">{detail}</p>
      </div>
    </div>
  );
}
