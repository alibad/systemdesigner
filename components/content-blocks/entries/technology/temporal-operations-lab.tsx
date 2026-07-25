'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Code2,
  Gauge,
  History,
  Layers3,
  LoaderCircle,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  Workflow,
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

type OperationsIncident = {
  id: string;
  label: string;
  detail: string;
  namespace: string;
  taskQueue: string;
  arrivalPerSecond: number;
  initialBacklog: number;
  historyEvents: number;
  historyGrowthPerHour: number;
  checkpointPercent: number;
  requiresHeartbeat: boolean;
  requiresSafeDeployment: boolean;
  visibilityQuery: string;
  response: string[];
};

type OperationsData = {
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    workerCount: number;
    heartbeats: boolean;
    idempotency: boolean;
    workerVersioning: boolean;
    continueAsNew: boolean;
  };
  model: {
    tasksPerSecondPerWorker: number;
    startToCloseSeconds: number;
    heartbeatTimeoutSeconds: number;
    internalHistoryBudgetEvents: number;
    freshRunBaselineEvents: number;
  };
  incidents: OperationsIncident[];
};

const BLOCK_ID = 'technology/temporal-operations-lab';

function isOperationsIncident(value: unknown): value is OperationsIncident {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OperationsIncident>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.namespace
      && candidate.taskQueue
      && typeof candidate.arrivalPerSecond === 'number'
      && typeof candidate.initialBacklog === 'number'
      && typeof candidate.historyEvents === 'number'
      && typeof candidate.historyGrowthPerHour === 'number'
      && typeof candidate.checkpointPercent === 'number'
      && typeof candidate.requiresHeartbeat === 'boolean'
      && typeof candidate.requiresSafeDeployment === 'boolean'
      && candidate.visibilityQuery
      && Array.isArray(candidate.response)
      && candidate.response.length === 4
      && candidate.response.every((item) => typeof item === 'string'),
  );
}

function isOperationsData(value: unknown): value is OperationsData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OperationsData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && typeof candidate.defaults.workerCount === 'number'
      && typeof candidate.defaults.heartbeats === 'boolean'
      && typeof candidate.defaults.idempotency === 'boolean'
      && typeof candidate.defaults.workerVersioning === 'boolean'
      && typeof candidate.defaults.continueAsNew === 'boolean'
      && typeof candidate.model?.tasksPerSecondPerWorker === 'number'
      && typeof candidate.model.startToCloseSeconds === 'number'
      && typeof candidate.model.heartbeatTimeoutSeconds === 'number'
      && typeof candidate.model.internalHistoryBudgetEvents === 'number'
      && typeof candidate.model.freshRunBaselineEvents === 'number'
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 4
      && candidate.incidents.every(isOperationsIncident),
  );
}

export default function TemporalOperationsLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<OperationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No operations model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isOperationsData(payload)) {
          throw new Error('The operations model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the operations model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {data
        ? <OperationsWorkbench data={data} />
        : <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />}
    </div>
  );
}

function OperationsWorkbench({ data }: { data: OperationsData }) {
  const defaultIncident = data.incidents.find(
    (item) => item.id === data.defaults.incidentId,
  ) ?? data.incidents[0];
  const [incidentId, setIncidentId] = useState(defaultIncident.id);
  const [workerCount, setWorkerCount] = useState(data.defaults.workerCount);
  const [heartbeats, setHeartbeats] = useState(data.defaults.heartbeats);
  const [idempotency, setIdempotency] = useState(data.defaults.idempotency);
  const [workerVersioning, setWorkerVersioning] = useState(
    data.defaults.workerVersioning,
  );
  const [continueAsNew, setContinueAsNew] = useState(data.defaults.continueAsNew);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? defaultIncident;

  const result = useMemo(() => {
    const capacity = workerCount * data.model.tasksPerSecondPerWorker;
    const headroom = capacity - incident.arrivalPerSecond;
    const drainSeconds = headroom > 0 ? incident.initialBacklog / headroom : Number.POSITIVE_INFINITY;
    const utilization = capacity > 0 ? incident.arrivalPerSecond / capacity : 1;
    const detectionSeconds = incident.requiresHeartbeat && heartbeats
      ? data.model.heartbeatTimeoutSeconds
      : data.model.startToCloseSeconds;
    const checkpoint = incident.requiresHeartbeat && heartbeats
      ? incident.checkpointPercent
      : 0;
    const projectedHistory = continueAsNew && incident.id === 'history-growth'
      ? data.model.freshRunBaselineEvents
      : incident.historyEvents + incident.historyGrowthPerHour;
    const historyHealthy = projectedHistory < data.model.internalHistoryBudgetEvents;
    const releaseSafe = !incident.requiresSafeDeployment || workerVersioning;
    const sideEffectSafe = idempotency;
    const queueHealthy = headroom > 0 && utilization <= 0.8;
    const healthy = queueHealthy && releaseSafe && sideEffectSafe && historyHealthy;

    let verdict = 'Recovery controls contain the selected incident';
    let detail = 'Capacity, compatibility, history, and external effects have explicit owners and signals.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!sideEffectSafe) {
      verdict = 'Retries can duplicate the external business operation';
      detail = 'Worker recovery is durable, but the destination cannot recognize the same operation across Activity attempts.';
      tone = 'rose';
    } else if (!releaseSafe) {
      verdict = 'The release can route old history to incompatible code';
      detail = 'Replay tests reduce uncertainty, while Worker Versioning keeps open executions on a compatible deployment version.';
      tone = 'rose';
    } else if (!historyHealthy) {
      verdict = 'The run crosses the team Event History budget';
      detail = 'Continue-As-New should pass compact state into a fresh run after message handlers finish.';
      tone = 'rose';
    } else if (headroom <= 0) {
      verdict = 'The Task Queue backlog grows without bound';
      detail = `${incident.arrivalPerSecond} tasks/s arrive while the selected Workers process ${capacity} tasks/s.`;
      tone = 'rose';
    } else if (!queueHealthy || (incident.requiresHeartbeat && !heartbeats)) {
      verdict = 'Recovery works, but detection or capacity is slow';
      detail = incident.requiresHeartbeat && !heartbeats
        ? 'The crashed Activity waits for Start-to-Close instead of a short Heartbeat Timeout, and no progress checkpoint is available.'
        : 'The queue drains with little spare capacity, so another Worker or dependency failure can reverse progress.';
      tone = 'amber';
    }

    return {
      capacity,
      checkpoint,
      detectionSeconds,
      drainSeconds,
      headroom,
      healthy,
      historyHealthy,
      projectedHistory,
      queueHealthy,
      releaseSafe,
      sideEffectSafe,
      tone,
      utilization,
      verdict,
      detail,
    };
  }, [
    continueAsNew,
    data.model,
    heartbeats,
    idempotency,
    incident,
    workerCount,
    workerVersioning,
  ]);

  function reset() {
    setIncidentId(defaultIncident.id);
    setWorkerCount(data.defaults.workerCount);
    setHeartbeats(data.defaults.heartbeats);
    setIdempotency(data.defaults.idempotency);
    setWorkerVersioning(data.defaults.workerVersioning);
    setContinueAsNew(data.defaults.continueAsNew);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Recovery operations lab"
        title={data.title}
        description={data.description}
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Select an incident
              </legend>
              <div className="mt-3 grid gap-2">
                {data.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'queue-surge'
                      ? Gauge
                      : item.id === 'long-activity-crash'
                        ? Activity
                        : item.id === 'unsafe-release'
                          ? Code2
                          : History}
                    accent="cyan"
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Worker processes"
              value={workerCount}
              output={String(workerCount)}
              min={1}
              max={16}
              accent="blue"
              lowLabel="One poller"
              highLabel="Sixteen pollers"
              onChange={setWorkerCount}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Recovery controls
              </legend>
              <div className="mt-3 grid gap-2">
                <ControlToggle
                  enabled={heartbeats}
                  label="Heartbeat checkpoint"
                  detail="Detect missing long-Activity progress and pass checkpoint details to a later attempt."
                  onClick={() => setHeartbeats((value) => !value)}
                />
                <ControlToggle
                  enabled={idempotency}
                  label="Idempotent side effect"
                  detail="The destination enforces a stable business operation ID across Activity attempts."
                  onClick={() => setIdempotency((value) => !value)}
                />
                <ControlToggle
                  enabled={workerVersioning}
                  label="Versioned Worker deployment"
                  detail="Open histories stay on compatible code while a new version ramps."
                  onClick={() => setWorkerVersioning((value) => !value)}
                />
                <ControlToggle
                  enabled={continueAsNew}
                  label="Continue-As-New policy"
                  detail="Long-lived Workflows hand compact state to a fresh run before the team history budget."
                  onClick={() => setContinueAsNew((value) => !value)}
                />
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section className="rounded-md border border-neutral-200 bg-neutral-950 p-4 text-white dark:border-neutral-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-cyan-300">
                  Incident console
                </p>
                <h4 className="mt-1 text-lg font-semibold">{incident.label}</h4>
                <p className="mt-1 text-sm text-neutral-300">
                  Namespace <code>{incident.namespace}</code> | Task Queue <code>{incident.taskQueue}</code>
                </p>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded px-2 py-1 text-xs font-semibold ${
                result.healthy
                  ? 'bg-emerald-950 text-emerald-200'
                  : result.tone === 'amber'
                    ? 'bg-amber-950 text-amber-200'
                    : 'bg-rose-950 text-rose-200'
              }`}>
                {result.healthy
                  ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
                {result.healthy ? 'Contained' : result.tone === 'amber' ? 'Degraded' : 'Action required'}
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-4 text-xs text-neutral-300">
                <span>Arrival {incident.arrivalPerSecond} tasks/s</span>
                <span>Capacity {result.capacity} tasks/s</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded bg-neutral-800">
                <div
                  className={`h-full transition-[width] motion-reduce:transition-none ${
                    result.headroom <= 0
                      ? 'bg-rose-500'
                      : result.utilization > 0.8
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, result.utilization * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Utilization {Math.round(result.utilization * 100)}% | Headroom {result.headroom} tasks/s
              </p>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Backlog drain"
              value={Number.isFinite(result.drainSeconds)
                ? formatDuration(result.drainSeconds)
                : 'Growing'}
              detail={`${incident.initialBacklog.toLocaleString()} queued tasks in this model`}
              icon={Users}
              tone={result.queueHealthy ? 'emerald' : result.headroom > 0 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Failure detection"
              value={formatDuration(result.detectionSeconds)}
              detail={result.checkpoint > 0
                ? `${result.checkpoint}% progress available as a checkpoint`
                : 'No heartbeat checkpoint in this incident'}
              icon={Clock3}
              tone={incident.requiresHeartbeat && !heartbeats ? 'rose' : 'blue'}
            />
            <LabMetric
              label="External effects"
              value={result.sideEffectSafe ? 'Replay-safe' : 'Duplicate risk'}
              detail="Application guarantee at the destination boundary"
              icon={result.sideEffectSafe ? ShieldCheck : ShieldOff}
              tone={result.sideEffectSafe ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Run history"
              value={result.projectedHistory.toLocaleString()}
              detail={`Team budget: ${data.model.internalHistoryBudgetEvents.toLocaleString()} Events`}
              icon={History}
              tone={result.historyHealthy ? 'violet' : 'rose'}
            />
          </div>

          <section className="grid gap-3 md:grid-cols-2">
            <StatusCard
              title="Worker deployment"
              value={result.releaseSafe ? 'Compatible routing' : 'Mixed-code risk'}
              detail={workerVersioning
                ? 'Pinned and auto-upgrade Workflows follow an explicit deployment policy.'
                : 'Open executions can reach any unversioned Worker polling the Task Queue.'}
              icon={Layers3}
              healthy={result.releaseSafe}
            />
            <StatusCard
              title="Visibility query"
              value={incident.namespace}
              detail={incident.visibilityQuery}
              icon={Search}
              healthy
              mono
            />
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2">
              <Workflow aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <h4 className="font-semibold text-neutral-950 dark:text-white">
                Recovery response
              </h4>
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {incident.response.map((step, index) => (
                <li
                  key={step}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={`rounded-md border p-4 ${
            result.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
          }`}>
            <div className="flex items-start gap-3">
              {result.tone === 'emerald'
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <h4 className="font-semibold">{result.verdict}</h4>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ControlToggle({
  enabled,
  label,
  detail,
  onClick,
}: {
  enabled: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
        enabled
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
      }`}
    >
      <span className="flex items-start gap-3">
        {enabled
          ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          : <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function StatusCard({
  title,
  value,
  detail,
  icon: Icon,
  healthy,
  mono = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  healthy: boolean;
  mono?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-4 ${
      healthy
        ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
    }`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {title}
      </div>
      <p className="mt-2 break-words text-base font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className={`mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-400 ${
        mono ? 'font-mono' : ''
      }`}>
        {detail}
      </p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
        {error ? (
          <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="h-7 w-7 animate-spin text-cyan-500 motion-reduce:animate-none"
          />
        )}
        <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
          {error ? 'Operations model unavailable' : 'Loading operations model'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing Worker, Task Queue, Event History, and recovery states.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
          >
            Retry
          </button>
        ) : null}
      </div>
    </LearningLab>
  );
}
