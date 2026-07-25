'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Gauge,
  LockKeyhole,
  Network,
  RefreshCw,
  ServerCog,
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

interface WorkloadProfile {
  id: string;
  label: string;
  detail: string;
  dataClass: string;
  gpuPerTenant: number;
  minimumIsolationScore: number;
  minimumControlCoveragePct: number;
  maximumInterferenceRiskPct: number;
}

interface IsolationPattern {
  id: string;
  label: string;
  detail: string;
  boundary: string;
  isolationScore: number;
  controlCoveragePct: number;
  maximumTenants: number;
  packingEfficiencyPct: number;
  interferenceFactor: number;
  affectedTenantFraction: number;
  baseMonthlyCostUsd: number;
  gpuHourlyCostUsd: number;
}

interface TenancyIsolationData {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    isolationId: string;
    tenantCount: number;
    burstOverlapPct: number;
  };
  ranges: {
    tenantCount: { min: number; max: number; step: number };
    burstOverlapPct: { min: number; max: number; step: number };
  };
  workloads: WorkloadProfile[];
  isolationPatterns: IsolationPattern[];
}

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/unified-ai-platform-architecture/data/tenancy-isolation-model.json';
const BLOCK_ID =
  'ml-systems/unified-ai-platform-architecture-tenancy-isolation-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTenancyIsolationData(value: unknown): value is TenancyIsolationData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<TenancyIsolationData>;
  if (
    typeof data.title !== 'string'
    || typeof data.description !== 'string'
    || !data.defaults
    || !data.ranges
    || !Array.isArray(data.workloads)
    || data.workloads.length === 0
    || !Array.isArray(data.isolationPatterns)
    || data.isolationPatterns.length === 0
  ) {
    return false;
  }

  const defaults = data.defaults;
  const tenantRange = data.ranges.tenantCount;
  const burstRange = data.ranges.burstOverlapPct;
  if (
    typeof defaults.workloadId !== 'string'
    || typeof defaults.isolationId !== 'string'
    || !isFiniteNumber(defaults.tenantCount)
    || !isFiniteNumber(defaults.burstOverlapPct)
    || !tenantRange
    || !burstRange
    || !isFiniteNumber(tenantRange.min)
    || !isFiniteNumber(tenantRange.max)
    || !isFiniteNumber(tenantRange.step)
    || !isFiniteNumber(burstRange.min)
    || !isFiniteNumber(burstRange.max)
    || !isFiniteNumber(burstRange.step)
  ) {
    return false;
  }

  const workloadsValid = data.workloads.every((workload) => (
    typeof workload.id === 'string'
    && typeof workload.label === 'string'
    && typeof workload.detail === 'string'
    && typeof workload.dataClass === 'string'
    && isFiniteNumber(workload.gpuPerTenant)
    && isFiniteNumber(workload.minimumIsolationScore)
    && isFiniteNumber(workload.minimumControlCoveragePct)
    && isFiniteNumber(workload.maximumInterferenceRiskPct)
  ));
  const patternsValid = data.isolationPatterns.every((pattern) => (
    typeof pattern.id === 'string'
    && typeof pattern.label === 'string'
    && typeof pattern.detail === 'string'
    && typeof pattern.boundary === 'string'
    && isFiniteNumber(pattern.isolationScore)
    && isFiniteNumber(pattern.controlCoveragePct)
    && isFiniteNumber(pattern.maximumTenants)
    && isFiniteNumber(pattern.packingEfficiencyPct)
    && isFiniteNumber(pattern.interferenceFactor)
    && isFiniteNumber(pattern.affectedTenantFraction)
    && isFiniteNumber(pattern.baseMonthlyCostUsd)
    && isFiniteNumber(pattern.gpuHourlyCostUsd)
  ));

  return (
    workloadsValid
    && patternsValid
    && data.workloads.some((workload) => workload.id === defaults.workloadId)
    && data.isolationPatterns.some((pattern) => pattern.id === defaults.isolationId)
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

export default function UnifiedAIPlatformArchitectureTenancyIsolationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TenancyIsolationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workloadId, setWorkloadId] = useState('');
  const [isolationId, setIsolationId] = useState('');
  const [tenantCount, setTenantCount] = useState(1);
  const [burstOverlapPct, setBurstOverlapPct] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isTenancyIsolationData(payload)) {
          throw new Error('The tenancy model has an invalid data contract.');
        }
        setData(payload);
        setWorkloadId(payload.defaults.workloadId);
        setIsolationId(payload.defaults.isolationId);
        setTenantCount(payload.defaults.tenantCount);
        setBurstOverlapPct(payload.defaults.burstOverlapPct);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the tenancy model.',
        );
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const workload = data?.workloads.find((item) => item.id === workloadId)
    ?? data?.workloads[0];
  const isolation = data?.isolationPatterns.find((item) => item.id === isolationId)
    ?? data?.isolationPatterns[0];

  const model = useMemo(() => {
    if (!workload || !isolation) return null;

    const concurrentGpuDemand = tenantCount
      * workload.gpuPerTenant
      * burstOverlapPct
      / 100;
    const allocatedGpus = Math.max(
      1,
      Math.ceil(concurrentGpuDemand / (isolation.packingEfficiencyPct / 100)),
    );
    const utilizationPct = clamp(concurrentGpuDemand / allocatedGpus * 100);
    const interferenceRiskPct = clamp(
      burstOverlapPct
      * isolation.interferenceFactor
      * (0.65 + tenantCount / 160),
    );
    const affectedTenants = Math.max(
      1,
      Math.ceil(tenantCount * isolation.affectedTenantFraction),
    );
    const monthlyCostUsd = isolation.baseMonthlyCostUsd
      + allocatedGpus * isolation.gpuHourlyCostUsd * 730;

    const blockers: string[] = [];
    if (isolation.isolationScore < workload.minimumIsolationScore) {
      blockers.push(
        `isolation score ${isolation.isolationScore} is below the required ${workload.minimumIsolationScore}`,
      );
    }
    if (isolation.controlCoveragePct < workload.minimumControlCoveragePct) {
      blockers.push(
        `control coverage ${isolation.controlCoveragePct}% is below ${workload.minimumControlCoveragePct}%`,
      );
    }
    if (tenantCount > isolation.maximumTenants) {
      blockers.push(
        `${tenantCount} tenants exceed the tested density of ${isolation.maximumTenants}`,
      );
    }
    if (interferenceRiskPct > workload.maximumInterferenceRiskPct) {
      blockers.push(
        `interference risk ${interferenceRiskPct.toFixed(0)}% exceeds ${workload.maximumInterferenceRiskPct}%`,
      );
    }

    return {
      affectedTenants,
      allocatedGpus,
      blockers,
      concurrentGpuDemand,
      eligible: blockers.length === 0,
      interferenceRiskPct,
      monthlyCostUsd,
      utilizationPct,
    };
  }, [burstOverlapPct, isolation, tenantCount, workload]);

  function reset() {
    if (!data) return;
    setWorkloadId(data.defaults.workloadId);
    setIsolationId(data.defaults.isolationId);
    setTenantCount(data.defaults.tenantCount);
    setBurstOverlapPct(data.defaults.burstOverlapPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Tenancy boundary lab"
          title={data?.title ?? 'Choose the boundary before sharing the cluster'}
          description={
            data?.description
            ?? 'Loading workload trust, fairness, and accelerator assumptions...'
          }
          icon={Building2}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !workload || !isolation || !model ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Workload consequence
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.workloads.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === workload.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'regulated-decision'
                            ? ShieldCheck
                            : item.id === 'external-generative'
                              ? Network
                              : Boxes
                        }
                        accent={
                          item.id === 'regulated-decision'
                            ? 'rose'
                            : item.id === 'external-generative'
                              ? 'amber'
                              : 'blue'
                        }
                        onClick={() => setWorkloadId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Isolation boundary
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.isolationPatterns.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === isolation.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'dedicated-cluster'
                            ? LockKeyhole
                            : item.id === 'virtual-control-plane'
                              ? ServerCog
                              : Users
                        }
                        accent={
                          item.id === 'dedicated-cluster'
                            ? 'emerald'
                            : item.id === 'virtual-control-plane'
                              ? 'violet'
                              : 'cyan'
                        }
                        onClick={() => setIsolationId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Tenant count"
                  value={tenantCount}
                  output={`${tenantCount} tenants`}
                  min={data.ranges.tenantCount.min}
                  max={data.ranges.tenantCount.max}
                  step={data.ranges.tenantCount.step}
                  lowLabel="Small platform"
                  highLabel="Dense fleet"
                  accent="violet"
                  onChange={setTenantCount}
                />

                <LabRange
                  label="Concurrent burst overlap"
                  value={burstOverlapPct}
                  output={`${burstOverlapPct}%`}
                  min={data.ranges.burstOverlapPct.min}
                  max={data.ranges.burstOverlapPct.max}
                  step={data.ranges.burstOverlapPct.step}
                  lowLabel="Staggered jobs"
                  highLabel="Shared peak"
                  accent="amber"
                  onChange={setBurstOverlapPct}
                />
              </div>
            )}
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Decision"
                  value={model.eligible ? 'Boundary fits' : 'Boundary fails'}
                  detail={
                    model.eligible
                      ? `${isolation.boundary} satisfies the declared workload contract.`
                      : `${model.blockers.length} explicit blocker${model.blockers.length === 1 ? '' : 's'}.`
                  }
                  icon={model.eligible ? CheckCircle2 : CircleAlert}
                  tone={model.eligible ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Accelerator pool"
                  value={`${model.allocatedGpus} GPUs`}
                  detail={`${model.concurrentGpuDemand.toFixed(1)} concurrent GPU demand`}
                  icon={Cpu}
                  tone="blue"
                />
                <LabMetric
                  label="Pool utilization"
                  value={`${model.utilizationPct.toFixed(0)}%`}
                  detail="Illustrative peak packing after isolation overhead"
                  icon={Gauge}
                  tone={model.utilizationPct >= 55 ? 'cyan' : 'amber'}
                />
                <LabMetric
                  label="Monthly platform cost"
                  value={formatMoney(model.monthlyCostUsd)}
                  detail="Illustrative control-plane and accelerator run cost"
                  icon={Building2}
                  tone="violet"
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Failure radius
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                      {model.affectedTenants} of {tenantCount} tenants share the likely incident boundary
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      The estimate combines the selected control-plane boundary with the
                      number of tenants packed into it. It is not a substitute for a
                      failure-injection test.
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    <Network aria-hidden="true" className="h-4 w-4" />
                    {model.interferenceRiskPct.toFixed(0)}% interference risk
                  </span>
                </div>
                <div
                  className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12"
                  aria-label={`${model.affectedTenants} of ${tenantCount} tenants in the estimated failure radius`}
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const representedTenant = Math.ceil((index + 1) * tenantCount / 12);
                    const affected = representedTenant <= model.affectedTenants;
                    return (
                      <span
                        key={`tenant-segment-${index + 1}`}
                        className={`h-8 rounded-sm border ${
                          affected
                            ? 'border-rose-300 bg-rose-100 dark:border-rose-800 dark:bg-rose-950/70'
                            : 'border-emerald-300 bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60'
                        }`}
                        title={affected ? 'Inside estimated incident radius' : 'Outside estimated incident radius'}
                      />
                    );
                  })}
                </div>
              </section>

              <div className="grid gap-3 md:grid-cols-3">
                <ControlStatus
                  icon={LockKeyhole}
                  label="Identity and control plane"
                  value={`${isolation.isolationScore}/100`}
                  detail={`Required: ${workload.minimumIsolationScore}/100`}
                  pass={isolation.isolationScore >= workload.minimumIsolationScore}
                />
                <ControlStatus
                  icon={ShieldCheck}
                  label="Required controls"
                  value={`${isolation.controlCoveragePct}%`}
                  detail={`Required: ${workload.minimumControlCoveragePct}%`}
                  pass={
                    isolation.controlCoveragePct
                    >= workload.minimumControlCoveragePct
                  }
                />
                <ControlStatus
                  icon={Users}
                  label="Tested tenant density"
                  value={`${tenantCount}/${isolation.maximumTenants}`}
                  detail={`${workload.dataClass} data classification`}
                  pass={tenantCount <= isolation.maximumTenants}
                />
              </div>

              <section
                className={`rounded-md border p-4 ${
                  model.eligible
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {model.eligible ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-semibold">
                      {model.eligible
                        ? 'Admit this tenancy pattern with measured quotas'
                        : 'Strengthen the boundary before onboarding'}
                    </h4>
                    {model.eligible ? (
                      <p className="mt-1 text-sm leading-6">
                        Keep workload identity, default-deny network policy, resource
                        requests and limits, data authorization, and upgrade testing in
                        the tenant contract. Re-evaluate after the fleet or trust model changes.
                      </p>
                    ) : (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                        {model.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    )}
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

function ControlStatus({
  icon: Icon,
  label,
  value,
  detail,
  pass,
}: {
  icon: typeof LockKeyhole;
  label: string;
  value: string;
  detail: string;
  pass: boolean;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        <span
          className={`text-xs font-semibold ${
            pass
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {pass ? 'Meets contract' : 'Below contract'}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (!error) {
    return (
      <div
        className="h-[34rem] animate-pulse bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900"
        aria-label="Loading tenancy isolation lab"
        role="status"
      />
    );
  }

  return (
    <div className="p-5 md:p-6">
      <div
        className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Tenancy model unavailable</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-neutral-950 dark:text-rose-100"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
