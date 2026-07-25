'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleAlert,
  Database,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
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
type DashboardProfile = {
  id: string;
  label: string;
  detail: string;
  panelCount: number;
  queriesPerPanel: number;
  variableQueriesPerRefresh: number;
  returnedSeriesPerPanelQuery: number;
};
type QueryPressureData = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    activeViewers: number;
    refreshIntervalSeconds: number;
    rangeHours: number;
    queryStepSeconds: number;
    testedQueryBudgetPerSecond: number;
  };
  bounds: {
    activeViewers: Bound;
    refreshIntervalSeconds: Bound;
    rangeHours: Bound;
    queryStepSeconds: Bound;
    testedQueryBudgetPerSecond: Bound;
  };
  warningUtilizationPercent: number;
  profiles: DashboardProfile[];
};

const BLOCK_ID = 'technology/grafana-deployment';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isQueryPressureData(value: unknown): value is QueryPressureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryPressureData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.profileId
      && typeof candidate.defaults.activeViewers === 'number'
      && typeof candidate.defaults.refreshIntervalSeconds === 'number'
      && typeof candidate.defaults.rangeHours === 'number'
      && typeof candidate.defaults.queryStepSeconds === 'number'
      && typeof candidate.defaults.testedQueryBudgetPerSecond === 'number'
      && isBound(candidate.bounds?.activeViewers)
      && isBound(candidate.bounds?.refreshIntervalSeconds)
      && isBound(candidate.bounds?.rangeHours)
      && isBound(candidate.bounds?.queryStepSeconds)
      && isBound(candidate.bounds?.testedQueryBudgetPerSecond)
      && typeof candidate.warningUtilizationPercent === 'number'
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

function formatCompact(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);
}

export default function GrafanaDeployment({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QueryPressureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No dashboard query model was supplied.');
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
        if (!isQueryPressureData(payload)) {
          throw new Error('The dashboard query model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the query model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <QueryPressureLab data={data} />;
}

function QueryPressureLab({ data }: { data: QueryPressureData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [activeViewers, setActiveViewers] = useState<number>(data.defaults.activeViewers);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState<number>(
    data.defaults.refreshIntervalSeconds,
  );
  const [rangeHours, setRangeHours] = useState<number>(data.defaults.rangeHours);
  const [queryStepSeconds, setQueryStepSeconds] = useState<number>(
    data.defaults.queryStepSeconds,
  );
  const [testedQueryBudgetPerSecond, setTestedQueryBudgetPerSecond] = useState<number>(
    data.defaults.testedQueryBudgetPerSecond,
  );

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const model = useMemo(() => {
    const panelQueriesPerRefresh = profile.panelCount * profile.queriesPerPanel;
    const queriesPerRefresh = panelQueriesPerRefresh + profile.variableQueriesPerRefresh;
    const refreshesPerSecond = activeViewers / refreshIntervalSeconds;
    const steadyQueriesPerSecond = queriesPerRefresh * refreshesPerSecond;
    const synchronizedBurstQueries = queriesPerRefresh * activeViewers;
    const pointsPerSeries = Math.floor(rangeHours * 3600 / queryStepSeconds) + 1;
    const panelPointsPerRefresh = panelQueriesPerRefresh
      * profile.returnedSeriesPerPanelQuery
      * pointsPerSeries;
    const returnedPointsPerSecond = panelPointsPerRefresh * refreshesPerSecond;
    const utilizationPercent = steadyQueriesPerSecond / testedQueryBudgetPerSecond * 100;
    const status = utilizationPercent >= 100
      ? 'over'
      : utilizationPercent >= data.warningUtilizationPercent
        ? 'tight'
        : 'healthy';

    return {
      panelPointsPerRefresh,
      panelQueriesPerRefresh,
      pointsPerSeries,
      queriesPerRefresh,
      returnedPointsPerSecond,
      status,
      steadyQueriesPerSecond,
      synchronizedBurstQueries,
      utilizationPercent,
    };
  }, [
    activeViewers,
    data.warningUtilizationPercent,
    profile,
    queryStepSeconds,
    rangeHours,
    refreshIntervalSeconds,
    testedQueryBudgetPerSecond,
  ]);

  function reset() {
    setProfileId(data.defaults.profileId);
    setActiveViewers(data.defaults.activeViewers);
    setRefreshIntervalSeconds(data.defaults.refreshIntervalSeconds);
    setRangeHours(data.defaults.rangeHours);
    setQueryStepSeconds(data.defaults.queryStepSeconds);
    setTestedQueryBudgetPerSecond(data.defaults.testedQueryBudgetPerSecond);
  }

  const verdict = model.status === 'over'
    ? {
        title: 'Steady dashboard demand exceeds the tested query budget',
        detail: 'Reduce refresh frequency, split expensive drill-downs from overview traffic, narrow queries, or establish more measured backend capacity.',
        icon: CircleAlert,
        panel: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
        iconClass: 'text-rose-700 dark:text-rose-300',
      }
    : model.status === 'tight'
      ? {
          title: 'The steady rate has little measured headroom',
          detail: 'The average still fits, but aligned refreshes, query variance, and incident-time viewers can cross the boundary. Test the synchronized burst as well.',
          icon: Gauge,
          panel: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
          iconClass: 'text-amber-700 dark:text-amber-300',
        }
      : {
          title: 'The steady rate fits inside the measured query budget',
          detail: 'Keep validating long ranges and synchronized refresh bursts; this result says nothing about source latency or CPU without measurements.',
          icon: ShieldCheck,
          panel: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
          iconClass: 'text-emerald-700 dark:text-emerald-300',
        };
  const VerdictIcon = verdict.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Dashboard query pressure lab"
          title={data.title}
          description={data.description}
          icon={BarChart3}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Dashboard shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={LayoutDashboard}
                      accent="blue"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Active viewers"
                value={activeViewers}
                output={activeViewers.toLocaleString()}
                {...data.bounds.activeViewers}
                accent="violet"
                lowLabel="one operator"
                highLabel="shared event"
                onChange={setActiveViewers}
              />
              <LabRange
                label="Auto-refresh interval"
                value={refreshIntervalSeconds}
                output={`${refreshIntervalSeconds}s`}
                {...data.bounds.refreshIntervalSeconds}
                accent="cyan"
                lowLabel="frequent"
                highLabel="infrequent"
                onChange={setRefreshIntervalSeconds}
              />
              <LabRange
                label="Dashboard time range"
                value={rangeHours}
                output={`${rangeHours}h`}
                {...data.bounds.rangeHours}
                accent="amber"
                lowLabel="recent"
                highLabel="long history"
                onChange={setRangeHours}
              />
              <LabRange
                label="Query step"
                value={queryStepSeconds}
                output={`${queryStepSeconds}s`}
                {...data.bounds.queryStepSeconds}
                accent="emerald"
                lowLabel="fine resolution"
                highLabel="coarse resolution"
                onChange={setQueryStepSeconds}
              />
              <LabRange
                label="Measured source budget"
                value={testedQueryBudgetPerSecond}
                output={`${testedQueryBudgetPerSecond} q/s`}
                {...data.bounds.testedQueryBudgetPerSecond}
                accent="rose"
                lowLabel="small envelope"
                highLabel="load tested"
                onChange={setTestedQueryBudgetPerSecond}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <section className={`rounded-md border p-5 ${verdict.panel}`}>
              <div className="flex items-start gap-3">
                <VerdictIcon
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 ${verdict.iconClass}`}
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Source pressure verdict
                  </p>
                  <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                    {verdict.title}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {verdict.detail}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Steady query rate"
                value={`${model.steadyQueriesPerSecond.toFixed(1)}/s`}
                detail={`${model.utilizationPercent.toFixed(0)}% of measured budget`}
                icon={Activity}
                tone={model.status === 'over' ? 'rose' : model.status === 'tight' ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="One aligned refresh"
                value={formatCompact(model.synchronizedBurstQueries, 0)}
                detail="queries if every viewer refreshes together"
                icon={Users}
                tone="violet"
              />
              <LabMetric
                label="Points per refresh"
                value={formatCompact(model.panelPointsPerRefresh)}
                detail="modeled panel response points, excluding variables"
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Returned points"
                value={`${formatCompact(model.returnedPointsPerSecond)}/s`}
                detail="average points delivered to active viewers"
                icon={Gauge}
                tone="cyan"
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Visible arithmetic
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  Query count and response size stay separate
                </h4>
              </div>
              <dl className="divide-y divide-neutral-100 text-sm dark:divide-neutral-900">
                <Equation
                  label="Panel queries per refresh"
                  formula={`${profile.panelCount} panels x ${profile.queriesPerPanel} queries`}
                  value={model.panelQueriesPerRefresh.toLocaleString()}
                />
                <Equation
                  label="All queries per refresh"
                  formula={`${model.panelQueriesPerRefresh} panel + ${profile.variableQueriesPerRefresh} variable`}
                  value={model.queriesPerRefresh.toLocaleString()}
                />
                <Equation
                  label="Points per returned series"
                  formula={`floor(${rangeHours}h / ${queryStepSeconds}s) + 1`}
                  value={model.pointsPerSeries.toLocaleString()}
                />
              </dl>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  Steady rate vs measured budget
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {model.steadyQueriesPerSecond.toFixed(1)} / {testedQueryBudgetPerSecond} q/s
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
                    model.status === 'over'
                      ? 'bg-rose-500'
                      : model.status === 'tight'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(model.utilizationPercent, 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Warning begins at {data.warningUtilizationPercent}% by this lab&apos;s
                operating policy. Replace both the warning and capacity values with
                evidence from your data source and query mix.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Equation({ label, formula, value }: { label: string; formula: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-4">
      <dt className="font-medium text-neutral-900 dark:text-neutral-100">{label}</dt>
      <dd className="text-xs text-neutral-500 dark:text-neutral-400">{formula}</dd>
      <dd className="font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</dd>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-[280px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading dashboard query pressure lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Dashboard query lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
