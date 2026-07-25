'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CheckCircle2,
  CloudCog,
  Database,
  Gauge,
  Globe2,
  Layers3,
  RefreshCw,
  Route,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Check = {
  label: string;
  passed: boolean;
  detail: string;
};

type Fit = {
  status: 'fit' | 'review' | 'reject';
  summary: string;
  decision: string;
  checks: Check[];
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  stateLabel: string;
  changeGiBPerDay: number;
  wanRttMs: number;
  requirements: string[];
};

type PlacementLayer = {
  label: string;
  placement: string;
  portable: boolean;
  note: string;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  portableSurfacePercent: number;
  crossCloudMultiplier: number;
  operatingDomains: number;
  criticalPathWanRoundTrips: number;
  layers: PlacementLayer[];
  fits: Record<string, Fit>;
};

type PlacementModel = {
  title: string;
  description: string;
  assumptions: string;
  defaults: {
    workloadId: string;
    strategyId: string;
  };
  workloads: Workload[];
  strategies: Strategy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/hybrid-multi-cloud-orchestration/data/placement-portability-model.json';

function isPlacementModel(value: unknown): value is PlacementModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<PlacementModel>;
  return Boolean(
    model.title
      && model.description
      && model.assumptions
      && model.defaults?.workloadId
      && model.defaults.strategyId
      && Array.isArray(model.workloads)
      && model.workloads.length >= 2
      && model.workloads.every(
        (workload) =>
          typeof workload.id === 'string'
          && typeof workload.label === 'string'
          && typeof workload.detail === 'string'
          && typeof workload.stateLabel === 'string'
          && typeof workload.changeGiBPerDay === 'number'
          && typeof workload.wanRttMs === 'number'
          && Array.isArray(workload.requirements),
      )
      && Array.isArray(model.strategies)
      && model.strategies.length >= 3
      && model.strategies.every(
        (strategy) =>
          typeof strategy.id === 'string'
          && typeof strategy.label === 'string'
          && typeof strategy.detail === 'string'
          && typeof strategy.portableSurfacePercent === 'number'
          && typeof strategy.crossCloudMultiplier === 'number'
          && typeof strategy.operatingDomains === 'number'
          && typeof strategy.criticalPathWanRoundTrips === 'number'
          && Array.isArray(strategy.layers)
          && strategy.layers.length >= 3
          && strategy.fits
          && typeof strategy.fits === 'object',
      ),
  );
}

function statusStyles(status: Fit['status']) {
  if (status === 'fit') {
    return {
      icon: CheckCircle2,
      label: 'Defensible fit',
      panel:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    };
  }
  if (status === 'reject') {
    return {
      icon: XCircle,
      label: 'Reject this placement',
      panel:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    };
  }
  return {
    icon: TriangleAlert,
    label: 'Needs explicit review',
    panel:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  };
}

export default function HybridMultiCloudOrchestrationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PlacementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workloadId, setWorkloadId] = useState('');
  const [strategyId, setStrategyId] = useState('');

  function reset(nextModel: PlacementModel) {
    setWorkloadId(nextModel.defaults.workloadId);
    setStrategyId(nextModel.defaults.strategyId);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPlacementModel(payload)) {
          throw new Error('The placement model is incomplete.');
        }
        setModel(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setModel(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the placement model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!model) return null;
    const workload =
      model.workloads.find((candidate) => candidate.id === workloadId) ?? model.workloads[0];
    const strategy =
      model.strategies.find((candidate) => candidate.id === strategyId) ?? model.strategies[0];
    const fit = strategy.fits[workload.id];
    if (!fit) return null;

    return {
      workload,
      strategy,
      fit,
      crossCloudGiBPerDay: Math.round(
        workload.changeGiBPerDay * strategy.crossCloudMultiplier,
      ),
      wanFloorMs: workload.wanRttMs * strategy.criticalPathWanRoundTrips,
    };
  }, [model, strategyId, workloadId]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Placement and portability lab"
        title="Choose what moves, then expose what stays anchored"
        description="Select a workload and placement model. The lab recomputes the portable surface, cross-cloud data movement, wide-area latency floor, and hard-constraint result from visible assumptions."
        icon={CloudCog}
        accent="blue"
        onReset={model ? () => reset(model) : undefined}
      />

      {!model || !view ? (
        <div className="flex min-h-[360px] items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center">
              <TriangleAlert
                aria-hidden="true"
                className="mx-auto h-7 w-7 text-rose-500"
              />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                Placement data could not be loaded
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center" role="status">
              <Activity
                aria-hidden="true"
                className="mx-auto h-7 w-7 animate-pulse text-blue-500 motion-reduce:animate-none"
              />
              <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Loading placement model...
              </p>
            </div>
          )}
        </div>
      ) : (
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload contract
                </legend>
                <div className="mt-3 space-y-2">
                  {model.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workload.id === view.workload.id}
                      label={workload.label}
                      detail={workload.detail}
                      icon={workload.id === 'regulated-ledger' ? ShieldCheck : workload.id === 'global-media' ? Globe2 : Database}
                      accent="blue"
                      onClick={() => setWorkloadId(workload.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Placement model
                </legend>
                <div className="mt-3 space-y-2">
                  {model.strategies.map((strategy) => (
                    <LabChoice
                      key={strategy.id}
                      selected={strategy.id === view.strategy.id}
                      label={strategy.label}
                      detail={strategy.detail}
                      icon={strategy.id === 'uniform-everywhere' ? Boxes : strategy.id === 'anchored-state' ? Database : Layers3}
                      accent={strategy.id === 'uniform-everywhere' ? 'violet' : strategy.id === 'anchored-state' ? 'emerald' : 'amber'}
                      onClick={() => setStrategyId(strategy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Reusable surface"
                value={`${view.strategy.portableSurfacePercent}%`}
                detail="Share of eight modeled runtime and operations layers reused unchanged."
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Cross-cloud movement"
                value={`${view.crossCloudGiBPerDay.toLocaleString()} GiB/day`}
                detail={`${view.workload.changeGiBPerDay} GiB/day of changed state x ${view.strategy.crossCloudMultiplier}.`}
                icon={Route}
                tone={view.crossCloudGiBPerDay > 1_000 ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Modeled WAN floor"
                value={`+${view.wanFloorMs} ms`}
                detail={`${view.strategy.criticalPathWanRoundTrips} cross-cloud round trip(s) on the critical write path.`}
                icon={Gauge}
                tone={view.wanFloorMs === 0 ? 'emerald' : view.wanFloorMs > 100 ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Operating domains"
                value={String(view.strategy.operatingDomains)}
                detail="Provider or on-prem domains with distinct IAM, networking, quotas, and incidents."
                icon={CloudCog}
                tone="neutral"
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Placement trace
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {view.workload.label}: {view.strategy.label}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  State profile: {view.workload.stateLabel}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {view.strategy.layers.map((layer) => (
                  <div
                    key={layer.label}
                    className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {layer.label}
                      </p>
                      <span
                        className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          layer.portable
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {layer.portable ? 'reused' : 'adapted'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {layer.placement}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {layer.note}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Hard constraints
                </p>
                <ul className="mt-3 space-y-3">
                  {view.fit.checks.map((check) => (
                    <li key={check.label} className="flex items-start gap-3">
                      {check.passed ? (
                        <CheckCircle2
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                      ) : (
                        <XCircle
                          aria-hidden="true"
                          className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {check.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {check.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <DecisionPanel fit={view.fit} />
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.assumptions}
            </p>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function DecisionPanel({ fit }: { fit: Fit }) {
  const styles = statusStyles(fit.status);
  const Icon = styles.icon;

  return (
    <section className={`rounded-md border p-4 ${styles.panel}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">{styles.label}</p>
          <p className="mt-2 text-sm font-semibold leading-6">{fit.summary}</p>
          <p className="mt-3 text-sm leading-6 opacity-80">{fit.decision}</p>
        </div>
      </div>
    </section>
  );
}
