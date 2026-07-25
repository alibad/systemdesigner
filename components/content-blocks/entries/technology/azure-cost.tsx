'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Coins,
  Database,
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
  logKiBPerRequest: number;
  publicEgressPct: number;
};
type Commitment = {
  id: string;
  label: string;
  detail: string;
  computeMultiplier: number;
};
type WorkloadEnvelopeData = {
  title: string;
  description: string;
  disclaimer: string;
  assumptions: {
    hoursPerMonth: number;
    instanceSustainableRps: number;
    instanceVcpu: number;
    instanceMemoryGiB: number;
    targetUtilizationPct: number;
    instanceHourlyUsd: number;
    storageGiBMonthUsd: number;
    egressGiBUsd: number;
    logIngestGiBUsd: number;
    databaseBaseMonthlyUsd: number;
    platformBaseMonthlyUsd: number;
  };
  defaults: {
    profileId: string;
    peakRps: number;
    zones: number;
    dataGiB: number;
    commitmentId: string;
  };
  bounds: { peakRps: Bound; zones: Bound; dataGiB: Bound };
  profiles: WorkloadProfile[];
  commitments: Commitment[];
};
type Finding = {
  label: string;
  detail: string;
  severity: 'healthy' | 'warning' | 'critical';
};

const BLOCK_ID = 'technology/azure-cost';
const KIB_PER_GIB = 1024 ** 2;

const profileIcons: Record<string, LucideIcon> = {
  'internal-api': CloudCog,
  'commerce-api': Activity,
  'media-catalog': Globe2,
};

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isProfile(value: unknown): value is WorkloadProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.averageToPeakRatio === 'number'
      && typeof candidate.responseKiB === 'number'
      && typeof candidate.logKiBPerRequest === 'number'
      && typeof candidate.publicEgressPct === 'number',
  );
}

function isCommitment(value: unknown): value is Commitment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Commitment>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.computeMultiplier === 'number',
  );
}

function isWorkloadEnvelopeData(value: unknown): value is WorkloadEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkloadEnvelopeData>;
  const assumptions = candidate.assumptions;
  const defaults = candidate.defaults;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.disclaimer
      && assumptions
      && Object.values(assumptions).every((item) => typeof item === 'number')
      && defaults?.profileId
      && typeof defaults.peakRps === 'number'
      && typeof defaults.zones === 'number'
      && typeof defaults.dataGiB === 'number'
      && defaults.commitmentId
      && isBound(candidate.bounds?.peakRps)
      && isBound(candidate.bounds?.zones)
      && isBound(candidate.bounds?.dataGiB)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isProfile)
      && Array.isArray(candidate.commitments)
      && candidate.commitments.length >= 2
      && candidate.commitments.every(isCommitment),
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

export default function AzureCost({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<WorkloadEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No workload planning model was supplied.');
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
    return (
      <LabLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <WorkloadEnvelope data={data} />;
}

function WorkloadEnvelope({ data }: { data: WorkloadEnvelopeData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [peakRps, setPeakRps] = useState(data.defaults.peakRps);
  const [zones, setZones] = useState(data.defaults.zones);
  const [dataGiB, setDataGiB] = useState(data.defaults.dataGiB);
  const [commitmentId, setCommitmentId] = useState(data.defaults.commitmentId);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const commitment = data.commitments.find((item) => item.id === commitmentId)
    ?? data.commitments[0];

  const result = useMemo(() => {
    const assumptions = data.assumptions;
    const targetUtilization = assumptions.targetUtilizationPct / 100;
    const requiredInstances = Math.ceil(
      peakRps / (assumptions.instanceSustainableRps * targetUtilization),
    );
    const redundancyFloor = zones * 2;
    const instances = Math.max(requiredInstances, redundancyFloor);
    const lostInstances = Math.ceil(instances / zones);
    const survivingInstances = zones > 1 ? instances - lostInstances : 0;
    const survivingCapacityPct = survivingInstances
      * assumptions.instanceSustainableRps
      / peakRps
      * 100;
    const peakUtilizationPct = peakRps
      / (instances * assumptions.instanceSustainableRps)
      * 100;
    const averageRps = peakRps * profile.averageToPeakRatio;
    const monthlyRequests = averageRps * assumptions.hoursPerMonth * 3600;
    const publicEgressGiB = monthlyRequests
      * profile.responseKiB
      * (profile.publicEgressPct / 100)
      / KIB_PER_GIB;
    const logIngestGiB = monthlyRequests * profile.logKiBPerRequest / KIB_PER_GIB;
    const computeUsd = instances
      * assumptions.instanceHourlyUsd
      * assumptions.hoursPerMonth
      * commitment.computeMultiplier;
    const storageUsd = dataGiB * assumptions.storageGiBMonthUsd;
    const egressUsd = publicEgressGiB * assumptions.egressGiBUsd;
    const observabilityUsd = logIngestGiB * assumptions.logIngestGiBUsd;
    const managedServicesUsd = assumptions.databaseBaseMonthlyUsd
      + assumptions.platformBaseMonthlyUsd;
    const totalUsd = computeUsd + storageUsd + egressUsd + observabilityUsd + managedServicesUsd;
    const costPerMillionRequests = totalUsd / (monthlyRequests / 1_000_000);
    const findings: Finding[] = [];

    if (zones === 1) {
      findings.push({
        severity: 'critical',
        label: 'Replica count is still one zone failure unit',
        detail: 'All modeled instances disappear together during a zone outage. Select multiple zones before treating replicas as high availability.',
      });
    } else if (survivingCapacityPct < 100) {
      findings.push({
        severity: 'critical',
        label: 'A zone outage exceeds surviving capacity',
        detail: `The remaining instances can carry ${formatCompact(survivingCapacityPct)}% of peak traffic. Add failure headroom or define load shedding.`,
      });
    } else if (survivingCapacityPct < 120) {
      findings.push({
        severity: 'warning',
        label: 'Zone failover headroom is thin',
        detail: `${formatCompact(survivingCapacityPct)}% surviving capacity leaves little room for retry bursts, rollout overlap, or autoscaler delay.`,
      });
    }

    if (observabilityUsd / totalUsd > 0.35) {
      findings.push({
        severity: 'warning',
        label: 'Telemetry volume dominates this planning envelope',
        detail: 'Sample routine success events, keep security and error evidence, and route high-volume diagnostic data to an intentional retention tier.',
      });
    }

    if (egressUsd / totalUsd > 0.35) {
      findings.push({
        severity: 'warning',
        label: 'Public response bytes dominate the estimate',
        detail: 'Measure cacheability, compression, response shape, and content-delivery paths before optimizing compute reservations.',
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'healthy',
        label: 'The modeled peak fits with independent zone headroom',
        detail: 'Validate per-instance throughput, downstream quotas, autoscale delay, and current regional prices before treating the envelope as a commitment.',
      });
    }

    return {
      computeUsd,
      costPerMillionRequests,
      egressUsd,
      findings,
      instances,
      logIngestGiB,
      managedServicesUsd,
      monthlyRequests,
      observabilityUsd,
      peakUtilizationPct,
      publicEgressGiB,
      storageUsd,
      survivingCapacityPct,
      totalMemoryGiB: instances * assumptions.instanceMemoryGiB,
      totalUsd,
      totalVcpu: instances * assumptions.instanceVcpu,
    };
  }, [commitment, data, dataGiB, peakRps, profile, zones]);

  const costParts = [
    { label: 'Compute', value: result.computeUsd, color: 'bg-blue-500' },
    { label: 'Data', value: result.storageUsd, color: 'bg-emerald-500' },
    { label: 'Egress', value: result.egressUsd, color: 'bg-amber-500' },
    { label: 'Telemetry', value: result.observabilityUsd, color: 'bg-violet-500' },
    { label: 'Managed baseline', value: result.managedServicesUsd, color: 'bg-neutral-500' },
  ];

  function reset() {
    setProfileId(data.defaults.profileId);
    setPeakRps(data.defaults.peakRps);
    setZones(data.defaults.zones);
    setDataGiB(data.defaults.dataGiB);
    setCommitmentId(data.defaults.commitmentId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Azure workload envelope"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Workload shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={profileIcons[item.id] ?? Activity}
                      accent={item.id === 'commerce-api' ? 'blue' : item.id === 'media-catalog' ? 'amber' : 'cyan'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

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
                  label="Availability zones"
                  value={zones}
                  output={`${zones} ${zones === 1 ? 'zone' : 'zones'}`}
                  {...data.bounds.zones}
                  lowLabel="One failure unit"
                  highLabel="Zone spread"
                  accent="emerald"
                  onChange={setZones}
                />
                <LabRange
                  label="Stored application data"
                  value={dataGiB}
                  output={`${dataGiB.toLocaleString()} GiB`}
                  {...data.bounds.dataGiB}
                  lowLabel="Small dataset"
                  highLabel="Storage-heavy"
                  accent="violet"
                  onChange={setDataGiB}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Compute commitment
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.commitments.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === commitment.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Coins}
                      accent="violet"
                      onClick={() => setCommitmentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Instances"
                value={String(result.instances)}
                detail={`${result.totalVcpu} vCPU · ${result.totalMemoryGiB} GiB memory`}
                icon={Server}
                tone="blue"
              />
              <LabMetric
                label="Peak utilization"
                value={`${result.peakUtilizationPct.toFixed(0)}%`}
                detail={`Target ceiling ${data.assumptions.targetUtilizationPct}%`}
                icon={Activity}
                tone={result.peakUtilizationPct <= data.assumptions.targetUtilizationPct ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="After one zone fails"
                value={`${Math.max(0, result.survivingCapacityPct).toFixed(0)}%`}
                detail="Surviving capacity versus peak demand"
                icon={ShieldCheck}
                tone={result.survivingCapacityPct >= 120 ? 'emerald' : result.survivingCapacityPct >= 100 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Planning envelope"
                value={`${formatUsd(result.totalUsd)}/mo`}
                detail={`${formatUsd(result.costPerMillionRequests)} per million requests`}
                icon={Coins}
                tone="violet"
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <PathNode icon={Globe2} eyebrow="Demand" label={`${formatCompact(peakRps)} rps peak`} tone="blue" />
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0" />
                <PathNode icon={CloudCog} eyebrow="Azure entry" label="Global route + admission" tone="violet" />
                <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 text-neutral-400 sm:rotate-0" />
                <PathNode icon={Server} eyebrow="Regional compute" label={`${result.instances} instances / ${zones} zones`} tone="emerald" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat icon={Database} label="Stored data" value={`${dataGiB.toLocaleString()} GiB`} />
                <MiniStat icon={Globe2} label="Public egress" value={`${formatCompact(result.publicEgressGiB)} GiB/mo`} />
                <MiniStat icon={HardDrive} label="Log ingestion" value={`${formatCompact(result.logIngestGiB)} GiB/mo`} />
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Illustrative cost composition</p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">See which assumption deserves measurement before negotiating discounts.</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{formatUsd(result.totalUsd)}</span>
              </div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" aria-label="Cost composition">
                <div className="flex h-full w-full">
                  {costParts.map((part) => (
                    <span
                      key={part.label}
                      className={part.color}
                      style={{ width: `${Math.max(1, part.value / result.totalUsd * 100)}%` }}
                      title={`${part.label}: ${formatUsd(part.value)}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {costParts.map((part) => (
                  <div key={part.label} className="flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${part.color}`} />{part.label}</span>
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{formatUsd(part.value)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              {result.findings.map((finding) => (
                <FindingCard key={finding.label} finding={finding} />
              ))}
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

function PathNode({
  icon: Icon,
  eyebrow,
  label,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  label: string;
  tone: 'blue' | 'violet' | 'emerald';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  };
  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 text-sm font-semibold leading-5">{label}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const classes = finding.severity === 'healthy'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : finding.severity === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';
  const Icon = finding.severity === 'healthy' ? CheckCircle2 : finding.severity === 'warning' ? CircleAlert : TriangleAlert;
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
    <LearningLab>
      <LearningLabHeader
        eyebrow="Azure workload envelope"
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
  );
}
