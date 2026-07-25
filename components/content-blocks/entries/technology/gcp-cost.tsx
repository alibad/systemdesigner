'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Coins,
  Gauge,
  Globe2,
  HardDrive,
  LoaderCircle,
  Server,
  ShieldCheck,
  TriangleAlert,
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

type Bound = { min: number; max: number; step: number };
type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  averageToPeakRatio: number;
  responseKiB: number;
  cacheablePct: number;
  logKiBPerOriginRequest: number;
  storedDataGiB: number;
};
type ComputeModel = {
  id: string;
  label: string;
  detail: string;
  sustainableRpsPerUnit: number;
  minimumUnits: number;
  unitHourlyUsd: number;
  platformBaseMonthlyUsd: number;
};
type WorkloadEnvelopeData = {
  title: string;
  description: string;
  disclaimer: string;
  assumptions: {
    hoursPerMonth: number;
    targetUtilizationPct: number;
    originEgressGiBUsd: number;
    edgeEgressGiBUsd: number;
    logIngestGiBUsd: number;
    storageGiBMonthUsd: number;
    databaseBaseMonthlyUsd: number;
  };
  defaults: {
    profileId: string;
    computeId: string;
    peakRps: number;
    cacheHitPct: number;
    reservePct: number;
  };
  bounds: {
    peakRps: Bound;
    cacheHitPct: Bound;
    reservePct: Bound;
  };
  profiles: WorkloadProfile[];
  computeModels: ComputeModel[];
};
type Finding = {
  label: string;
  detail: string;
  severity: 'healthy' | 'warning' | 'critical';
};

const BLOCK_ID = 'technology/gcp-cost';
const KIB_PER_GIB = 1024 ** 2;

const profileIcons: Record<string, LucideIcon> = {
  'internal-api': CloudCog,
  'commerce-api': Activity,
  'media-catalog': Globe2,
};

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bound>;
  return typeof item.min === 'number'
    && typeof item.max === 'number'
    && typeof item.step === 'number';
}

function isWorkloadProfile(value: unknown): value is WorkloadProfile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WorkloadProfile>;
  return Boolean(
    item.id
      && item.label
      && item.detail
      && typeof item.averageToPeakRatio === 'number'
      && typeof item.responseKiB === 'number'
      && typeof item.cacheablePct === 'number'
      && typeof item.logKiBPerOriginRequest === 'number'
      && typeof item.storedDataGiB === 'number',
  );
}

function isComputeModel(value: unknown): value is ComputeModel {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ComputeModel>;
  return Boolean(
    item.id
      && item.label
      && item.detail
      && typeof item.sustainableRpsPerUnit === 'number'
      && typeof item.minimumUnits === 'number'
      && typeof item.unitHourlyUsd === 'number'
      && typeof item.platformBaseMonthlyUsd === 'number',
  );
}

function isWorkloadEnvelopeData(value: unknown): value is WorkloadEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WorkloadEnvelopeData>;
  return Boolean(
    item.title
      && item.description
      && item.disclaimer
      && item.assumptions
      && Object.values(item.assumptions).every((entry) => typeof entry === 'number')
      && item.defaults?.profileId
      && item.defaults.computeId
      && typeof item.defaults.peakRps === 'number'
      && typeof item.defaults.cacheHitPct === 'number'
      && typeof item.defaults.reservePct === 'number'
      && isBound(item.bounds?.peakRps)
      && isBound(item.bounds?.cacheHitPct)
      && isBound(item.bounds?.reservePct)
      && Array.isArray(item.profiles)
      && item.profiles.length >= 3
      && item.profiles.every(isWorkloadProfile)
      && Array.isArray(item.computeModels)
      && item.computeModels.length >= 3
      && item.computeModels.every(isComputeModel),
  );
}

function formatCompact(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: digits,
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function GcpCost({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<WorkloadEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No GCP workload model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the workload model (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isWorkloadEnvelopeData(payload)) {
          throw new Error('The workload model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the workload model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LabLoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <WorkloadEnvelope data={data} />;
}

function WorkloadEnvelope({ data }: { data: WorkloadEnvelopeData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [computeId, setComputeId] = useState(data.defaults.computeId);
  const [peakRps, setPeakRps] = useState(data.defaults.peakRps);
  const [cacheHitPct, setCacheHitPct] = useState(data.defaults.cacheHitPct);
  const [reservePct, setReservePct] = useState(data.defaults.reservePct);
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const compute = data.computeModels.find((item) => item.id === computeId) ?? data.computeModels[0];

  const result = useMemo(() => {
    const assumptions = data.assumptions;
    const targetUtilization = assumptions.targetUtilizationPct / 100;
    const edgeHitShare = profile.cacheablePct / 100 * cacheHitPct / 100;
    const originShare = 1 - edgeHitShare;
    const originPeakRps = peakRps * originShare;
    const usableRpsPerUnit = compute.sustainableRpsPerUnit * targetUtilization;
    const baseUnits = Math.ceil(originPeakRps / usableRpsPerUnit);
    const activeUnits = Math.max(
      compute.minimumUnits,
      Math.ceil(baseUnits * (1 + reservePct / 100)),
    );
    const peakCapacityRps = activeUnits * usableRpsPerUnit;
    const afterUnitLossPct = Math.max(0, activeUnits - 1)
      * usableRpsPerUnit
      / originPeakRps
      * 100;
    const averageRps = peakRps * profile.averageToPeakRatio;
    const monthlyRequests = averageRps * assumptions.hoursPerMonth * 3600;
    const originRequests = monthlyRequests * originShare;
    const edgeRequests = monthlyRequests - originRequests;
    const originEgressGiB = originRequests * profile.responseKiB / KIB_PER_GIB;
    const edgeEgressGiB = edgeRequests * profile.responseKiB / KIB_PER_GIB;
    const logIngestGiB = originRequests * profile.logKiBPerOriginRequest / KIB_PER_GIB;
    const computeUsd = activeUnits * compute.unitHourlyUsd * assumptions.hoursPerMonth;
    const networkUsd = originEgressGiB * assumptions.originEgressGiBUsd
      + edgeEgressGiB * assumptions.edgeEgressGiBUsd;
    const telemetryUsd = logIngestGiB * assumptions.logIngestGiBUsd;
    const storageUsd = profile.storedDataGiB * assumptions.storageGiBMonthUsd;
    const managedBaselineUsd = assumptions.databaseBaseMonthlyUsd
      + compute.platformBaseMonthlyUsd;
    const totalUsd = computeUsd + networkUsd + telemetryUsd + storageUsd + managedBaselineUsd;
    const findings: Finding[] = [];

    if (afterUnitLossPct < 100) {
      findings.push({
        severity: 'critical',
        label: 'One lost capacity unit exceeds the reserve',
        detail: `The remaining modeled units can carry ${afterUnitLossPct.toFixed(0)}% of origin peak. Add reserve or define admission and load-shedding behavior.`,
      });
    } else if (afterUnitLossPct < 120) {
      findings.push({
        severity: 'warning',
        label: 'Failure headroom is thin',
        detail: `${afterUnitLossPct.toFixed(0)}% remaining capacity leaves little margin for retries, warm-up, or rollout overlap.`,
      });
    }

    if (edgeHitShare < 0.1 && profile.cacheablePct >= 35) {
      findings.push({
        severity: 'warning',
        label: 'Cacheable traffic is still reaching the origin',
        detail: 'Validate cache keys, authorization boundaries, freshness rules, invalidation, and response eligibility before adding compute.',
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'healthy',
        label: 'The modeled origin peak fits with useful unit reserve',
        detail: 'Now validate cold starts, zonal distribution, database connections, quotas, and measured prices before treating this as a production plan.',
      });
    }

    return {
      activeUnits,
      afterUnitLossPct,
      computeUsd,
      costPerMillionRequests: totalUsd / (monthlyRequests / 1_000_000),
      edgeHitShare,
      findings,
      logIngestGiB,
      managedBaselineUsd,
      monthlyRequests,
      networkUsd,
      originPeakRps,
      peakCapacityRps,
      storageUsd,
      telemetryUsd,
      totalUsd,
    };
  }, [cacheHitPct, compute, data.assumptions, peakRps, profile, reservePct]);

  const costParts = [
    { label: 'Compute', value: result.computeUsd, color: 'bg-blue-500' },
    { label: 'Network', value: result.networkUsd, color: 'bg-amber-500' },
    { label: 'Telemetry', value: result.telemetryUsd, color: 'bg-violet-500' },
    { label: 'Storage', value: result.storageUsd, color: 'bg-emerald-500' },
    { label: 'Managed baseline', value: result.managedBaselineUsd, color: 'bg-neutral-500' },
  ];

  function reset() {
    setProfileId(data.defaults.profileId);
    setComputeId(data.defaults.computeId);
    setPeakRps(data.defaults.peakRps);
    setCacheHitPct(data.defaults.cacheHitPct);
    setReservePct(data.defaults.reservePct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="GCP workload envelope"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Workload shape"
                items={data.profiles}
                selectedId={profile.id}
                iconFor={(id) => profileIcons[id] ?? Activity}
                onSelect={setProfileId}
              />
              <ChoiceGroup
                label="2. Compute model"
                items={data.computeModels}
                selectedId={compute.id}
                iconFor={() => Server}
                onSelect={setComputeId}
              />
              <div className="space-y-6">
                <LabRange
                  label="Peak requests"
                  value={peakRps}
                  output={`${formatCompact(peakRps)} rps`}
                  {...data.bounds.peakRps}
                  lowLabel="Team service"
                  highLabel="Public workload"
                  accent="blue"
                  onChange={setPeakRps}
                />
                <LabRange
                  label="CDN cache hit rate"
                  value={cacheHitPct}
                  output={`${cacheHitPct}%`}
                  {...data.bounds.cacheHitPct}
                  lowLabel="Origin-heavy"
                  highLabel="Edge-heavy"
                  accent="cyan"
                  onChange={setCacheHitPct}
                />
                <LabRange
                  label="Capacity reserve"
                  value={reservePct}
                  output={`${reservePct}%`}
                  {...data.bounds.reservePct}
                  lowLabel="No modeled reserve"
                  highLabel="Failure and rollout"
                  accent="emerald"
                  onChange={setReservePct}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Origin peak"
                value={`${formatCompact(result.originPeakRps)} rps`}
                detail={`${(result.edgeHitShare * 100).toFixed(0)}% of all requests served at the edge`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Capacity units"
                value={String(result.activeUnits)}
                detail={`${formatCompact(result.peakCapacityRps)} rps usable capacity`}
                icon={Server}
                tone="violet"
              />
              <LabMetric
                label="After one unit fails"
                value={`${result.afterUnitLossPct.toFixed(0)}%`}
                detail="Remaining capacity versus origin peak"
                icon={ShieldCheck}
                tone={result.afterUnitLossPct >= 120 ? 'emerald' : result.afterUnitLossPct >= 100 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Planning envelope"
                value={`${formatUsd(result.totalUsd)}/mo`}
                detail={`${formatUsd(result.costPerMillionRequests)} per million requests`}
                icon={Coins}
                tone="amber"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                <PathNode icon={Globe2} eyebrow="Client demand" label={`${formatCompact(peakRps)} rps peak`} tone="blue" />
                <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" />
                <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 sm:hidden" />
                <PathNode icon={CloudCog} eyebrow="Cloud CDN" label={`${(result.edgeHitShare * 100).toFixed(0)}% served at edge`} tone="cyan" />
                <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 sm:block" />
                <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 sm:hidden" />
                <PathNode icon={Server} eyebrow="Regional origin" label={`${formatCompact(result.originPeakRps)} rps`} tone="emerald" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat icon={Activity} label="Monthly requests" value={formatCompact(result.monthlyRequests)} />
                <MiniStat icon={HardDrive} label="Log ingestion" value={`${formatCompact(result.logIngestGiB)} GiB/mo`} />
                <MiniStat icon={ShieldCheck} label="Requested reserve" value={`${reservePct}%`} />
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Illustrative cost composition</p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">Measure the largest driver before optimizing a smaller line item.</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{formatUsd(result.totalUsd)}</span>
              </div>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" aria-label="Cost composition">
                {costParts.map((part) => (
                  <span
                    key={part.label}
                    className={part.color}
                    style={{ width: `${Math.max(1, part.value / result.totalUsd * 100)}%` }}
                    title={`${part.label}: ${formatUsd(part.value)}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {costParts.map((part) => (
                  <div key={part.label} className="flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-sm ${part.color}`} />
                      {part.label}
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{formatUsd(part.value)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              {result.findings.map((finding) => <FindingCard key={finding.label} finding={finding} />)}
            </section>

            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {data.disclaimer}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends { id: string; label: string; detail: string }>({
  label,
  items,
  selectedId,
  iconFor,
  onSelect,
}: {
  label: string;
  items: T[];
  selectedId: string;
  iconFor: (id: string) => LucideIcon;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={iconFor(item.id)}
            accent="blue"
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function PathNode({
  icon: Icon,
  eyebrow,
  label,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  label: string;
  tone: 'blue' | 'cyan' | 'emerald';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  };
  return (
    <div className={`min-w-0 rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 break-words text-sm font-semibold leading-5">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const classes = finding.severity === 'healthy'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : finding.severity === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';
  const Icon = finding.severity === 'healthy'
    ? CheckCircle2
    : finding.severity === 'warning'
      ? CircleAlert
      : TriangleAlert;
  return (
    <div className={`rounded-md border p-4 ${classes}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{finding.label}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{finding.detail}</p>
        </div>
      </div>
    </div>
  );
}

function LabLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="GCP workload envelope"
          title="Loading the workload model"
          description="The lesson is loading workload profiles and transparent planning assumptions."
          icon={Gauge}
          accent="blue"
        />
        <LearningLabBody>
          <div className="flex min-h-44 items-center justify-center p-6 text-center">
            {error ? (
              <div>
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
                <p className="mt-3 text-sm">Loading planning assumptions...</p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
