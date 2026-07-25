'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  Scale,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Profile = {
  id: string;
  label: string;
  detail: string;
  dashboardQueriesPerMinute: number;
  etlConcurrency: number;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  dashboardShare: number;
  extraEligibleSlots: number;
  consequence: string;
};

type WorkloadModel = {
  title: string;
  description: string;
  clusterSlots: number;
  dashboardSecondsPerQuery: number;
  bounds: {
    dashboardQueriesPerMinute: { min: number; max: number; step: number };
    etlConcurrency: { min: number; max: number; step: number };
  };
  defaults: {
    profileId: string;
    policyId: string;
  };
  profiles: Profile[];
  policies: Policy[];
};

const BLOCK_ID = 'technology/redshift-workload-lab';

function hasBounds(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['min', 'max', 'step'].every(
    (key) => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]),
  );
}

function isWorkloadModel(value: unknown): value is WorkloadModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.clusterSlots === 'number'
      && candidate.clusterSlots > 0
      && typeof candidate.dashboardSecondsPerQuery === 'number'
      && candidate.dashboardSecondsPerQuery > 0
      && candidate.defaults?.profileId
      && candidate.defaults.policyId
      && hasBounds(candidate.bounds?.dashboardQueriesPerMinute)
      && hasBounds(candidate.bounds?.etlConcurrency)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2
      && candidate.profiles.every(
        (profile) =>
          profile
          && typeof profile.id === 'string'
          && typeof profile.label === 'string'
          && typeof profile.detail === 'string'
          && typeof profile.dashboardQueriesPerMinute === 'number'
          && typeof profile.etlConcurrency === 'number',
      )
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 2
      && candidate.policies.every(
        (policy) =>
          policy
          && typeof policy.id === 'string'
          && typeof policy.label === 'string'
          && typeof policy.detail === 'string'
          && typeof policy.dashboardShare === 'number'
          && policy.dashboardShare > 0
          && policy.dashboardShare <= 1
          && typeof policy.extraEligibleSlots === 'number'
          && policy.extraEligibleSlots >= 0
          && typeof policy.consequence === 'string',
      ),
  );
}

export default function RedshiftWorkloadLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<WorkloadModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No Redshift workload model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isWorkloadModel(payload)) throw new Error('The workload model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <div
          className={`not-prose my-7 min-h-40 rounded-lg border p-5 ${
            error
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              : 'animate-pulse border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
          }`}
          role={error ? 'alert' : undefined}
        >
          {error ? (
            <>
              <p className="font-semibold">The workload lab could not be loaded.</p>
              <p className="mt-2 text-sm opacity-75">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold"
              >
                Retry
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return <WorkloadWorkbench model={model} />;
}

function WorkloadWorkbench({ model }: { model: WorkloadModel }) {
  const defaultProfile =
    model.profiles.find((profile) => profile.id === model.defaults.profileId) ?? model.profiles[0];
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [policyId, setPolicyId] = useState(model.defaults.policyId);
  const [dashboardQueriesPerMinute, setDashboardQueriesPerMinute] = useState(
    defaultProfile.dashboardQueriesPerMinute,
  );
  const [etlConcurrency, setEtlConcurrency] = useState(defaultProfile.etlConcurrency);

  const profile =
    model.profiles.find((candidate) => candidate.id === profileId) ?? model.profiles[0];
  const policy =
    model.policies.find((candidate) => candidate.id === policyId) ?? model.policies[0];

  const result = useMemo(() => {
    const dashboardDemand =
      dashboardQueriesPerMinute * (model.dashboardSecondsPerQuery / 60);
    const baseDashboardSlots =
      policy.id === 'pooled'
        ? Math.max(0, model.clusterSlots - etlConcurrency)
        : Math.max(1, Math.floor(model.clusterSlots * policy.dashboardShare));
    const baseEtlSlots =
      policy.id === 'pooled'
        ? Math.min(model.clusterSlots, etlConcurrency)
        : model.clusterSlots - baseDashboardSlots;
    const neededExtraSlots = Math.max(0, Math.ceil(dashboardDemand - baseDashboardSlots));
    const usedExtraSlots = Math.min(neededExtraSlots, policy.extraEligibleSlots);
    const effectiveDashboardSlots = baseDashboardSlots + usedExtraSlots;
    const dashboardDeficit = Math.max(0, dashboardDemand - effectiveDashboardSlots);
    const etlDeficit = Math.max(0, etlConcurrency - baseEtlSlots);
    const dashboardUtilization =
      effectiveDashboardSlots > 0 ? dashboardDemand / effectiveDashboardSlots : Infinity;
    const healthy = dashboardDeficit === 0 && (policy.id === 'pooled' || etlDeficit === 0);

    return {
      dashboardDemand,
      baseDashboardSlots,
      baseEtlSlots,
      usedExtraSlots,
      effectiveDashboardSlots,
      dashboardDeficit,
      etlDeficit,
      dashboardUtilization,
      healthy,
    };
  }, [dashboardQueriesPerMinute, etlConcurrency, model, policy]);

  function selectProfile(nextProfile: Profile) {
    setProfileId(nextProfile.id);
    setDashboardQueriesPerMinute(nextProfile.dashboardQueriesPerMinute);
    setEtlConcurrency(nextProfile.etlConcurrency);
  }

  function reset() {
    selectProfile(defaultProfile);
    setPolicyId(model.defaults.policyId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Workload-isolation lab"
          title={model.title}
          description={model.description}
          icon={Scale}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Traffic profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.profiles.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === profile.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={Activity}
                      accent="cyan"
                      onClick={() => selectProfile(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Dashboard arrivals"
                value={dashboardQueriesPerMinute}
                output={`${dashboardQueriesPerMinute} queries/min`}
                {...model.bounds.dashboardQueriesPerMinute}
                lowLabel="quiet"
                highLabel="burst"
                accent="cyan"
                onChange={setDashboardQueriesPerMinute}
              />
              <LabRange
                label="Concurrent ETL queries"
                value={etlConcurrency}
                output={`${etlConcurrency} active`}
                {...model.bounds.etlConcurrency}
                lowLabel="light batch"
                highLabel="heavy batch"
                accent="amber"
                onChange={setEtlConcurrency}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Queue policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.policies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === policy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.extraEligibleSlots > 0 ? Zap : Layers3}
                      accent={candidate.extraEligibleSlots > 0 ? 'violet' : 'amber'}
                      onClick={() => setPolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Dashboard demand"
                value={result.dashboardDemand.toFixed(1)}
                detail="Modeled concurrent query slots"
                icon={Gauge}
                tone="cyan"
              />
              <LabMetric
                label="Dashboard capacity"
                value={`${result.effectiveDashboardSlots}`}
                detail={`${result.baseDashboardSlots} base + ${result.usedExtraSlots} scaling`}
                icon={Layers3}
                tone={result.dashboardDeficit > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Dashboard pressure"
                value={
                  Number.isFinite(result.dashboardUtilization)
                    ? `${Math.round(result.dashboardUtilization * 100)}%`
                    : 'Blocked'
                }
                detail={result.dashboardDeficit > 0 ? `${result.dashboardDeficit.toFixed(1)} slots short` : 'No modeled slot deficit'}
                icon={Clock3}
                tone={result.dashboardDeficit > 0 ? 'rose' : result.dashboardUtilization > 0.8 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="ETL pressure"
                value={result.etlDeficit > 0 ? `${result.etlDeficit} queued` : 'Admitted'}
                detail={`${result.baseEtlSlots} base slots available to ETL`}
                icon={Activity}
                tone={result.etlDeficit > 0 ? 'amber' : 'blue'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Modeled slot allocation
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  This is a reasoning model. Automatic WLM actually adjusts concurrency and memory from observed query needs.
                </p>
              </div>
              <div className="space-y-5 p-4">
                <AllocationBar
                  label="Base cluster"
                  total={model.clusterSlots}
                  dashboard={result.baseDashboardSlots}
                  etl={result.baseEtlSlots}
                />
                {policy.extraEligibleSlots > 0 ? (
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                        Eligible scaling capacity
                      </span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {result.usedExtraSlots} / {policy.extraEligibleSlots} modeled slots used
                      </span>
                    </div>
                    <div className="mt-2 h-4 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-[width]"
                        style={{
                          width: `${policy.extraEligibleSlots === 0 ? 0 : (result.usedExtraSlots / policy.extraEligibleSlots) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <div
              className={`rounded-md border p-5 ${
                result.healthy
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.healthy ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {result.healthy
                      ? 'The selected policy admits this modeled workload'
                      : 'At least one workload queues under the selected policy'}
                  </p>
                  <p className="mt-2 text-sm leading-6">{policy.consequence}</p>
                  <p className="mt-2 text-sm leading-6">
                    Measure queue time, execution time, query priority, spill, and completed work by class.
                    A slot count alone cannot prove latency or throughput.
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

function AllocationBar({
  label,
  total,
  dashboard,
  etl,
}: {
  label: string;
  total: number;
  dashboard: number;
  etl: number;
}) {
  const dashboardPercent = Math.min(100, (dashboard / total) * 100);
  const etlPercent = Math.min(100 - dashboardPercent, (etl / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{total} slots</span>
      </div>
      <div className="mt-2 flex h-7 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
        <div
          className="flex items-center justify-center bg-cyan-500 px-2 text-[11px] font-semibold text-neutral-950"
          style={{ width: `${dashboardPercent}%` }}
        >
          {dashboard > 0 ? `${dashboard} BI` : ''}
        </div>
        <div
          className="flex items-center justify-center bg-amber-400 px-2 text-[11px] font-semibold text-neutral-950"
          style={{ width: `${etlPercent}%` }}
        >
          {etl > 0 ? `${etl} ETL` : ''}
        </div>
      </div>
    </div>
  );
}
