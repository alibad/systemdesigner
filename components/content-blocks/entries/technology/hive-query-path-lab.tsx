'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Code2,
  Database,
  Gauge,
  HardDrive,
  ListTree,
  LoaderCircle,
  Network,
  Play,
  Search,
  Server,
  ShieldAlert,
  TableProperties,
  TerminalSquare,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type StageKind = 'client' | 'compiler' | 'engine' | 'metastore' | 'optimizer' | 'server' | 'storage';
type IncidentMode = 'healthy' | 'blocked' | 'degraded';
type Stage = {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  kind: StageKind;
};
type QueryShape = {
  id: string;
  label: string;
  detail: string;
  statement: string;
  activeStages: string[];
  successOutcome: string;
};
type Incident = {
  id: string;
  label: string;
  detail: string;
  mode: IncidentMode;
  stageId: string | null;
  userOutcome: string;
  operatorAction: string;
};
type QueryPathData = {
  title: string;
  description: string;
  defaults: {
    queryId: string;
    incidentId: string;
  };
  stages: Stage[];
  queries: QueryShape[];
  incidents: Incident[];
};

const BLOCK_ID = 'technology/hive-query-path-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/hive/data/query-path-model.json';

const stageIcons: Record<StageKind, LucideIcon> = {
  client: TerminalSquare,
  compiler: Braces,
  engine: Play,
  metastore: Database,
  optimizer: ListTree,
  server: Server,
  storage: HardDrive,
};

function isQueryPathData(value: unknown): value is QueryPathData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryPathData>;
  const stageIds = new Set(candidate.stages?.map((stage) => stage.id));

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.queryId
      && candidate.defaults.incidentId
      && Array.isArray(candidate.stages)
      && candidate.stages.length >= 5
      && candidate.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.eyebrow === 'string'
        && typeof stage.detail === 'string'
        && ['client', 'compiler', 'engine', 'metastore', 'optimizer', 'server', 'storage'].includes(stage.kind)
      ))
      && Array.isArray(candidate.queries)
      && candidate.queries.length >= 3
      && candidate.queries.every((query) => (
        typeof query.id === 'string'
        && typeof query.label === 'string'
        && typeof query.detail === 'string'
        && typeof query.statement === 'string'
        && Array.isArray(query.activeStages)
        && query.activeStages.length >= 3
        && query.activeStages.every((stageId) => stageIds.has(stageId))
        && typeof query.successOutcome === 'string'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 3
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && ['healthy', 'blocked', 'degraded'].includes(incident.mode)
        && (incident.stageId === null || stageIds.has(incident.stageId))
        && typeof incident.userOutcome === 'string'
        && typeof incident.operatorAction === 'string'
      )),
  );
}

export default function HiveQueryPathLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<QueryPathData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isQueryPathData(payload)) throw new Error('The query-path model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the query path.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <QueryPathWorkbench data={data} />;
}

function QueryPathWorkbench({ data }: { data: QueryPathData }) {
  const [queryId, setQueryId] = useState(data.defaults.queryId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const query = data.queries.find((item) => item.id === queryId) ?? data.queries[0];
  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];

  const trace = useMemo(() => {
    const incidentIndex = incident.stageId ? query.activeStages.indexOf(incident.stageId) : -1;
    const incidentAffectsPath = incident.mode !== 'healthy' && incidentIndex >= 0;
    const blocked = incidentAffectsPath && incident.mode === 'blocked';
    const reachedStageIds = blocked
      ? query.activeStages.slice(0, incidentIndex + 1)
      : query.activeStages;
    const launchesPhysicalWork = query.activeStages.includes('execution-engine');
    const needsMetastore = query.activeStages.includes('metastore');

    let status: 'healthy' | 'blocked' | 'degraded' | 'bypassed' = 'healthy';
    let outcome = query.successOutcome;
    let action = 'Inspect the returned plan and runtime counters before changing table or engine settings.';

    if (incidentAffectsPath) {
      status = incident.mode;
      outcome = incident.userOutcome;
      action = incident.operatorAction;
    } else if (incident.mode !== 'healthy') {
      status = 'bypassed';
      outcome = `This ${query.label.toLowerCase()} path does not visit ${incident.stageId ? data.stages.find((stage) => stage.id === incident.stageId)?.label ?? 'the affected stage' : 'the affected stage'}, so the selected incident does not change its result.`;
      action = 'Keep the incident isolated, but diagnose the components that this statement actually visits.';
    }

    return {
      action,
      blocked,
      incidentAffectsPath,
      incidentIndex,
      launchesPhysicalWork,
      needsMetastore,
      outcome,
      reachedStageIds,
      status,
    } as const;
  }, [data.stages, incident, query]);

  function reset() {
    setQueryId(data.defaults.queryId);
    setIncidentId(data.defaults.incidentId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Query lifecycle lab"
          title={data.title}
          description={data.description}
          icon={Network}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Statement shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.queries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === query.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'metadata' ? TableProperties : item.id === 'write' ? Code2 : Search}
                      accent={item.id === 'metadata' ? 'blue' : item.id === 'write' ? 'emerald' : 'violet'}
                      onClick={() => setQueryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inject one condition
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.mode === 'healthy' ? CheckCircle2 : item.mode === 'degraded' ? CircleAlert : ShieldAlert}
                      accent={item.mode === 'healthy' ? 'emerald' : item.mode === 'degraded' ? 'amber' : 'rose'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 text-neutral-100">
              <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3 text-xs font-semibold uppercase text-neutral-400">
                <TerminalSquare aria-hidden="true" className="h-4 w-4" />
                Statement submitted to HiveServer2
              </div>
              <pre className="overflow-x-auto p-4 text-sm leading-6 text-cyan-200"><code>{query.statement}</code></pre>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Stages reached"
                value={`${trace.reachedStageIds.length}/${query.activeStages.length}`}
                detail={trace.blocked ? 'The path stops at the blocking stage' : 'All stages required by this statement'}
                icon={ListTree}
                tone={trace.blocked ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Metastore lookup"
                value={trace.needsMetastore ? 'Required' : 'Bypassed'}
                detail="Schema, locations, partitions, and statistics live in metadata"
                icon={Database}
                tone={trace.needsMetastore ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Distributed work"
                value={trace.launchesPhysicalWork ? 'Planned' : 'None'}
                detail={trace.launchesPhysicalWork ? 'The execution backend receives a physical plan' : 'The server can answer from metadata'}
                icon={Gauge}
                tone={trace.launchesPhysicalWork ? 'cyan' : 'emerald'}
              />
              <LabMetric
                label="Result state"
                value={statusLabels[trace.status]}
                detail={trace.incidentAffectsPath ? 'Selected condition intersects this path' : 'No selected condition blocks this path'}
                icon={trace.status === 'blocked' ? CircleX : trace.status === 'degraded' ? CircleAlert : CheckCircle2}
                tone={statusTones[trace.status]}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Synchronous trace</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Follow the statement until Hive can return or launch work
                  </h4>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">Simplified control and data path</span>
              </div>

              <ol className="mt-5 space-y-0">
                {data.stages.map((stage, index) => (
                  <TraceStage
                    key={stage.id}
                    stage={stage}
                    position={query.activeStages.indexOf(stage.id)}
                    isLast={index === data.stages.length - 1}
                    status={stageStatus(stage.id, query, incident, trace.incidentIndex, trace.incidentAffectsPath)}
                  />
                ))}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${resultStyles[trace.status]}`}>
              <div className="flex items-start gap-3">
                {trace.status === 'blocked'
                  ? <CircleX aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : trace.status === 'degraded'
                    ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">User-visible consequence</p>
                  <p className="mt-2 text-sm leading-6">{trace.outcome}</p>
                  <div className="mt-4 border-t border-current/15 pt-4">
                    <p className="text-xs font-semibold uppercase opacity-70">Operator response</p>
                    <p className="mt-2 text-sm leading-6">{trace.action}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

type TraceStatus = 'active' | 'blocked' | 'degraded' | 'skipped' | 'unreached';

function stageStatus(
  stageId: string,
  query: QueryShape,
  incident: Incident,
  incidentIndex: number,
  incidentAffectsPath: boolean,
): TraceStatus {
  const position = query.activeStages.indexOf(stageId);
  if (position < 0) return 'skipped';
  if (incidentAffectsPath && incident.mode === 'blocked' && position > incidentIndex) return 'unreached';
  if (incidentAffectsPath && incident.stageId === stageId) {
    return incident.mode === 'degraded' ? 'degraded' : 'blocked';
  }
  return 'active';
}

function TraceStage({
  stage,
  position,
  status,
  isLast,
}: {
  stage: Stage;
  position: number;
  status: TraceStatus;
  isLast: boolean;
}) {
  const Icon = stageIcons[stage.kind];
  const muted = status === 'skipped' || status === 'unreached';

  return (
    <li className={`relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-3 ${muted ? 'opacity-55' : ''}`}>
      {!isLast ? <span aria-hidden="true" className="absolute bottom-0 left-[0.94rem] top-8 w-px bg-neutral-300 dark:bg-neutral-700" /> : null}
      <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${traceDotStyles[status]}`}>
        {position >= 0 && status !== 'unreached' ? <span className="text-xs font-semibold">{position + 1}</span> : <Icon aria-hidden="true" className="h-4 w-4" />}
      </span>
      <div className={`min-w-0 rounded-md border p-3 ${traceCardStyles[status]}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold uppercase opacity-70">{stage.eyebrow}</span>
          </div>
          <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold uppercase">{traceStatusLabels[status]}</span>
        </div>
        <h5 className="mt-2 text-sm font-semibold">{stage.label}</h5>
        <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
      </div>
    </li>
  );
}

const statusLabels = {
  healthy: 'Completed',
  blocked: 'Blocked',
  degraded: 'Degraded plan',
  bypassed: 'Unaffected',
} as const;

const statusTones = {
  healthy: 'emerald',
  blocked: 'rose',
  degraded: 'amber',
  bypassed: 'blue',
} as const;

const resultStyles = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  blocked: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  degraded: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  bypassed: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100',
} as const;

const traceStatusLabels = {
  active: 'Visited',
  blocked: 'Blocked here',
  degraded: 'Weak evidence',
  skipped: 'Not needed',
  unreached: 'Not reached',
} as const;

const traceDotStyles = {
  active: 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
  blocked: 'border-rose-400 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  degraded: 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  skipped: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400',
  unreached: 'border-dashed border-neutral-300 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-500',
} as const;

const traceCardStyles = {
  active: 'border-blue-200 bg-white text-neutral-950 dark:border-blue-950 dark:bg-neutral-950 dark:text-white',
  blocked: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  degraded: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  skipped: 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300',
  unreached: 'border-dashed border-neutral-300 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400',
} as const;

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-950 p-6 text-neutral-200 dark:border-neutral-800">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-amber-300" />
          <p className="mt-3 text-sm">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-700 px-3 py-2 text-sm font-semibold hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading the query lifecycle...
        </div>
      )}
    </div>
  );
}
