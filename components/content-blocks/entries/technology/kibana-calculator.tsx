'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Filter,
  Gauge,
  Layers3,
  LoaderCircle,
  Search,
  ServerCog,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/technology/kibana/data/dashboard-evidence-model.json';

type QueryMatch = {
  levels?: string[];
  service?: string;
  minimumDurationMs?: number;
  minimumStatusCode?: number;
  errorTypes?: string[];
};

type QueryDefinition = {
  id: string;
  label: string;
  kql: string;
  description: string;
  match: QueryMatch;
};

type EvidenceEvent = {
  id: string;
  minutesAgo: number;
  service: string;
  environment: string;
  level: string;
  durationMs: number;
  statusCode: number;
  errorType: string | null;
  message: string;
};

type EvidenceModel = {
  title: string;
  description: string;
  defaults: {
    queryId: string;
    timeWindowMinutes: number;
    environment: string;
    service: string;
  };
  timeWindows: Array<{
    minutes: number;
    label: string;
  }>;
  environments: string[];
  services: string[];
  queries: QueryDefinition[];
  events: EvidenceEvent[];
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === 'string');
}

function isQueryMatch(value: unknown): value is QueryMatch {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as QueryMatch;
  return (
    (candidate.levels === undefined || isStringArray(candidate.levels))
    && (candidate.service === undefined || typeof candidate.service === 'string')
    && (
      candidate.minimumDurationMs === undefined
      || typeof candidate.minimumDurationMs === 'number'
    )
    && (
      candidate.minimumStatusCode === undefined
      || typeof candidate.minimumStatusCode === 'number'
    )
    && (candidate.errorTypes === undefined || isStringArray(candidate.errorTypes))
  );
}

function isEvidenceModel(value: unknown): value is EvidenceModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceModel>;

  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaults?.queryId === 'string'
      && typeof candidate.defaults.timeWindowMinutes === 'number'
      && typeof candidate.defaults.environment === 'string'
      && typeof candidate.defaults.service === 'string'
      && Array.isArray(candidate.timeWindows)
      && candidate.timeWindows.length >= 3
      && candidate.timeWindows.every(
        (window) => (
          typeof window.minutes === 'number'
          && typeof window.label === 'string'
        ),
      )
      && isStringArray(candidate.environments)
      && isStringArray(candidate.services)
      && Array.isArray(candidate.queries)
      && candidate.queries.length >= 3
      && candidate.queries.every(
        (query) => (
          typeof query.id === 'string'
          && typeof query.label === 'string'
          && typeof query.kql === 'string'
          && typeof query.description === 'string'
          && isQueryMatch(query.match)
        ),
      )
      && Array.isArray(candidate.events)
      && candidate.events.length >= 8
      && candidate.events.every(
        (event) => (
          typeof event.id === 'string'
          && typeof event.minutesAgo === 'number'
          && typeof event.service === 'string'
          && typeof event.environment === 'string'
          && typeof event.level === 'string'
          && typeof event.durationMs === 'number'
          && typeof event.statusCode === 'number'
          && (event.errorType === null || typeof event.errorType === 'string')
          && typeof event.message === 'string'
        ),
      ),
  );
}

function matchesQuery(event: EvidenceEvent, query: QueryDefinition) {
  const { match } = query;
  if (match.levels && !match.levels.includes(event.level)) return false;
  if (match.service && event.service !== match.service) return false;
  if (
    match.minimumDurationMs !== undefined
    && event.durationMs < match.minimumDurationMs
  ) {
    return false;
  }
  if (
    match.minimumStatusCode !== undefined
    && event.statusCode < match.minimumStatusCode
  ) {
    return false;
  }
  if (
    match.errorTypes
    && (!event.errorType || !match.errorTypes.includes(event.errorType))
  ) {
    return false;
  }
  return true;
}

function durationLabel(durationMs: number) {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(2)}s`;
  return `${durationMs}ms`;
}

export default function KibanaEvidenceLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<EvidenceModel | null>(null);
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
        if (!isEvidenceModel(payload)) {
          throw new Error('The dashboard evidence model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the dashboard evidence model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Dashboard evidence lab"
          title="Scope the evidence before charting it"
          description="Loading the lesson-owned event set and query definitions."
          icon={Search}
          accent="cyan"
        />
        <div className="flex min-h-48 items-center justify-center p-6">
          {error ? (
            <div className="max-w-lg text-center">
              <TriangleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400"
              />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                The evidence model could not be loaded.
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 min-h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
              Loading dashboard evidence
            </div>
          )}
        </div>
      </LearningLab>
    );
  }

  return <EvidenceWorkbench model={model} />;
}

function EvidenceWorkbench({ model }: { model: EvidenceModel }) {
  const defaultQuery = model.queries.find(
    (query) => query.id === model.defaults.queryId,
  ) ?? model.queries[0];
  const [queryId, setQueryId] = useState(defaultQuery.id);
  const [timeWindowMinutes, setTimeWindowMinutes] = useState(
    model.defaults.timeWindowMinutes,
  );
  const [environment, setEnvironment] = useState(model.defaults.environment);
  const [service, setService] = useState(model.defaults.service);

  const query = model.queries.find((candidate) => candidate.id === queryId)
    ?? defaultQuery;

  const evidence = useMemo(() => {
    const candidates = model.events.filter((event) => (
      event.minutesAgo <= timeWindowMinutes
      && (environment === 'all' || event.environment === environment)
      && (service === 'all' || event.service === service)
    ));
    const matches = candidates.filter((event) => matchesQuery(event, query));
    const serviceCounts = model.services
      .filter((serviceName) => serviceName !== 'all')
      .map((serviceName) => ({
        service: serviceName,
        count: matches.filter((event) => event.service === serviceName).length,
      }))
      .filter((item) => item.count > 0);
    const maximumDuration = matches.reduce(
      (maximum, event) => Math.max(maximum, event.durationMs),
      0,
    );

    return {
      candidates,
      matches,
      serviceCounts,
      maximumDuration,
    };
  }, [
    environment,
    model.events,
    model.services,
    query,
    service,
    timeWindowMinutes,
  ]);

  const largestServiceCount = Math.max(
    1,
    ...evidence.serviceCounts.map((item) => item.count),
  );

  function reset() {
    setQueryId(defaultQuery.id);
    setTimeWindowMinutes(model.defaults.timeWindowMinutes);
    setEnvironment(model.defaults.environment);
    setService(model.defaults.service);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Dashboard evidence lab"
        title={model.title}
        description={model.description}
        icon={Search}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Investigation question
              </legend>
              <div className="mt-3 grid gap-2">
                {model.queries.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === query.id}
                    label={candidate.label}
                    detail={candidate.description}
                    icon={Search}
                    accent="cyan"
                    onClick={() => setQueryId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Global time filter
              </legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {model.timeWindows.map((window) => {
                  const selected = window.minutes === timeWindowMinutes;
                  return (
                    <button
                      key={window.minutes}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTimeWindowMinutes(window.minutes)}
                      className={`min-h-10 rounded-md border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        selected
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-950 dark:border-cyan-500 dark:bg-cyan-950/50 dark:text-cyan-50'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      {window.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Structured filter pills
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Environment
                  </span>
                  <select
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {model.environments.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All environments' : item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Service
                  </span>
                  <select
                    value={service}
                    onChange={(event) => setService(event.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {model.services.map((item) => (
                      <option key={item} value={item}>
                        {item === 'all' ? 'All services' : item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              <Filter aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Effective evidence scope
            </div>
            <code className="mt-3 block break-words rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-cyan-200">
              {query.kql}
            </code>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <ScopePill icon={Clock3} label={`${timeWindowMinutes} minute window`} />
              <ScopePill
                icon={Filter}
                label={environment === 'all' ? 'Any environment' : `environment: ${environment}`}
              />
              <ScopePill
                icon={Filter}
                label={service === 'all' ? 'Any service' : `service.name: ${service}`}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Kibana combines this state and submits the request. Elasticsearch filters
              the documents and computes the panel aggregations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Matching documents"
              value={`${evidence.matches.length} / ${evidence.candidates.length}`}
              detail="KQL matches / documents inside the time and pill scope"
              icon={Database}
              tone="cyan"
            />
            <LabMetric
              label="Visible services"
              value={String(evidence.serviceCounts.length)}
              detail="Distinct services represented by the filtered evidence"
              icon={Layers3}
              tone="violet"
            />
            <LabMetric
              label="Maximum duration"
              value={
                evidence.matches.length > 0
                  ? durationLabel(evidence.maximumDuration)
                  : 'No value'
              }
              detail="Exact maximum in this fixed teaching dataset"
              icon={Gauge}
              tone={evidence.maximumDuration >= 1000 ? 'amber' : 'emerald'}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <BarChart3
                  aria-hidden="true"
                  className="h-4 w-4 text-violet-600 dark:text-violet-400"
                />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Service evidence
                </h4>
              </div>
              {evidence.serviceCounts.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {evidence.serviceCounts.map((item) => (
                    <div key={item.service}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {item.service}
                        </span>
                        <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {item.count}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                        <div
                          className="h-full rounded bg-violet-500 dark:bg-violet-400"
                          style={{
                            width: `${(item.count / largestServiceCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyEvidence />
              )}
            </div>

            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <ServerCog
                  aria-hidden="true"
                  className="h-4 w-4 text-cyan-600 dark:text-cyan-400"
                />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Matching documents
                </h4>
              </div>
              {evidence.matches.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {evidence.matches.slice(0, 6).map((event) => (
                    <article
                      key={event.id}
                      className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                            {event.service}
                          </span>
                          <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold uppercase text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                            {event.environment}
                          </span>
                        </div>
                        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                          {event.minutesAgo}m ago · {durationLabel(event.durationMs)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-neutral-800 dark:text-neutral-200">
                        {event.message}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        HTTP {event.statusCode}
                        {event.errorType ? ` · ${event.errorType}` : ''}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyEvidence />
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              Every number above is derived from the visible, fixed event set. It is
              evidence about the selected scope, not a Kibana sizing or latency claim.
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ScopePill({
  icon: Icon,
  label,
}: {
  icon: typeof Clock3;
  label: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
      {label}
    </span>
  );
}

function EmptyEvidence() {
  return (
    <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-5 text-center dark:border-neutral-700">
      <Search
        aria-hidden="true"
        className="mx-auto h-5 w-5 text-neutral-400"
      />
      <p className="mt-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        No documents match this scope
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        Widen the time range, remove a pill, or choose a different investigation.
      </p>
    </div>
  );
}
