'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  DoorOpen,
  Gauge,
  Globe2,
  LockKeyhole,
  Network,
  RadioTower,
  Server,
  ShieldAlert,
  TriangleAlert,
  Unplug,
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

type TopologyId = 'centralized' | 'local' | 'hybrid';
type FailurePolicy = 'fail-open' | 'fail-closed';

type Topology = {
  id: TopologyId;
  label: string;
  detail: string;
  healthyGuarantee: string;
  partitionBehavior: string;
  baseDecisionLatencyMs: number;
};

type DistributedModel = {
  globalLimitPerMinute: number;
  legitimateRequestsPerMinute: number;
  partitionTimeoutMs: number;
  defaults: {
    topologyId: TopologyId;
    regionCount: number;
    abuseRequestsPerMinute: number;
    partitioned: boolean;
    failurePolicy: FailurePolicy;
  };
  bounds: {
    regionCount: { min: number; max: number; step: number };
    abuseRequestsPerMinute: { min: number; max: number; step: number };
  };
  topologies: Topology[];
};

const topologyIcons = {
  centralized: Database,
  local: Server,
  hybrid: Network,
} as const;

function proportionalShare(totalAllowed: number, partDemand: number, totalDemand: number) {
  if (totalDemand <= 0) {
    return 0;
  }
  return totalAllowed * (partDemand / totalDemand);
}

function modelEnforcement({
  data,
  topologyId,
  regionCount,
  abuseRequestsPerMinute,
  partitioned,
  failurePolicy,
}: {
  data: DistributedModel;
  topologyId: TopologyId;
  regionCount: number;
  abuseRequestsPerMinute: number;
  partitioned: boolean;
  failurePolicy: FailurePolicy;
}) {
  const limit = data.globalLimitPerMinute;
  const legitimate = data.legitimateRequestsPerMinute;
  const totalDemand = legitimate + abuseRequestsPerMinute;
  const legitimatePerRegion = legitimate / regionCount;
  const isolatedDemand = legitimatePerRegion + abuseRequestsPerMinute;
  const connectedLegitimate = legitimate - legitimatePerRegion;
  let allowed = 0;
  let abuseAllowed = 0;
  let legitimateAllowed = 0;

  if (topologyId === 'local') {
    const isolatedRegionAllowed = Math.min(isolatedDemand, limit);
    const otherRegionsAllowed = (regionCount - 1) * Math.min(legitimatePerRegion, limit);
    allowed = isolatedRegionAllowed + otherRegionsAllowed;
    abuseAllowed = proportionalShare(isolatedRegionAllowed, abuseRequestsPerMinute, isolatedDemand);
    legitimateAllowed = otherRegionsAllowed + proportionalShare(isolatedRegionAllowed, legitimatePerRegion, isolatedDemand);
  } else if (!partitioned) {
    allowed = Math.min(totalDemand, limit);
    abuseAllowed = proportionalShare(allowed, abuseRequestsPerMinute, totalDemand);
    legitimateAllowed = proportionalShare(allowed, legitimate, totalDemand);
  } else if (topologyId === 'centralized') {
    const connectedAllowed = Math.min(connectedLegitimate, limit);
    const isolatedAllowed = failurePolicy === 'fail-open' ? isolatedDemand : 0;
    allowed = connectedAllowed + isolatedAllowed;
    abuseAllowed = failurePolicy === 'fail-open' ? abuseRequestsPerMinute : 0;
    legitimateAllowed = connectedAllowed + (failurePolicy === 'fail-open' ? legitimatePerRegion : 0);
  } else {
    const regionalLease = limit / regionCount;
    const connectedBudget = limit - regionalLease;
    const connectedAllowed = Math.min(connectedLegitimate, connectedBudget);
    const isolatedAllowed = failurePolicy === 'fail-open' ? isolatedDemand : Math.min(isolatedDemand, regionalLease);
    allowed = connectedAllowed + isolatedAllowed;
    abuseAllowed = proportionalShare(isolatedAllowed, abuseRequestsPerMinute, isolatedDemand);
    legitimateAllowed = connectedAllowed + proportionalShare(isolatedAllowed, legitimatePerRegion, isolatedDemand);
  }

  const rejected = Math.max(0, totalDemand - allowed);
  const globalOvershoot = Math.max(0, allowed - limit);
  const legitimateBlocked = Math.max(0, legitimate - legitimateAllowed);
  const riskLevel = globalOvershoot >= limit * 0.5
    ? 'Critical overshoot'
    : globalOvershoot > 0
      ? 'Elevated overshoot'
      : abuseAllowed >= limit * 0.25
        ? 'Bounded but contested'
        : 'Low overshoot risk';

  return {
    totalDemand,
    legitimatePerRegion,
    isolatedDemand,
    connectedLegitimate,
    allowed,
    rejected,
    abuseAllowed,
    legitimateBlocked,
    globalOvershoot,
    regionalLease: limit / regionCount,
    riskLevel,
  };
}

export default function RateLimitingDistributedConsistencyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DistributedModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topologyId, setTopologyId] = useState<TopologyId>('hybrid');
  const [regionCount, setRegionCount] = useState(3);
  const [abuseRequestsPerMinute, setAbuseRequestsPerMinute] = useState(600);
  const [partitioned, setPartitioned] = useState(true);
  const [failurePolicy, setFailurePolicy] = useState<FailurePolicy>('fail-closed');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The distributed limiter model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<DistributedModel>;
      })
      .then((model) => {
        setData(model);
        setTopologyId(model.defaults.topologyId);
        setRegionCount(model.defaults.regionCount);
        setAbuseRequestsPerMinute(model.defaults.abuseRequestsPerMinute);
        setPartitioned(model.defaults.partitioned);
        setFailurePolicy(model.defaults.failurePolicy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the distributed limiter model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/rate-limiting-distributed-consistency-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Distributed limiter model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/rate-limiting-distributed-consistency-lab">
        <div className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading distributed limiter model" />
      </div>
    );
  }

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const result = modelEnforcement({
    data,
    topologyId,
    regionCount,
    abuseRequestsPerMinute,
    partitioned,
    failurePolicy,
  });
  const isOvershooting = result.globalOvershoot > 0;
  const blocksLegitimateTraffic = result.legitimateBlocked >= 1;
  const riskTone = isOvershooting
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
    : blocksLegitimateTraffic
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';
  const policyChangesRequestPath = partitioned && topologyId !== 'local';
  const admittedWidth = result.totalDemand > 0 ? (result.allowed / result.totalDemand) * 100 : 0;
  const rounded = (value: number) => Math.round(value).toLocaleString();

  return (
    <div data-content-block="reference/rate-limiting-distributed-consistency-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Distributed consistency and failure lab"
          title="Partition a regional limiter and choose who pays"
          description="Compare one authoritative counter, independent regional counters, and leased budgets. Then disconnect a region and decide whether uncertain requests are admitted or refused."
          icon={Globe2}
          accent="violet"
          onReset={() => {
            setTopologyId(data.defaults.topologyId);
            setRegionCount(data.defaults.regionCount);
            setAbuseRequestsPerMinute(data.defaults.abuseRequestsPerMinute);
            setPartitioned(data.defaults.partitioned);
            setFailurePolicy(data.defaults.failurePolicy);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Counter topology</legend>
                <div className="mt-3 space-y-2">
                  {data.topologies.map((option) => {
                    const Icon = topologyIcons[option.id];
                    return (
                      <LabChoice
                        key={option.id}
                        selected={topology.id === option.id}
                        label={option.label}
                        detail={option.detail}
                        icon={Icon}
                        accent={option.id === 'centralized' ? 'blue' : option.id === 'local' ? 'amber' : 'violet'}
                        onClick={() => setTopologyId(option.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <LabRange
                label="Active regions"
                value={regionCount}
                output={`${regionCount}`}
                min={data.bounds.regionCount.min}
                max={data.bounds.regionCount.max}
                step={data.bounds.regionCount.step}
                accent="blue"
                lowLabel="two regions"
                highLabel="four regions"
                onChange={setRegionCount}
              />
              <LabRange
                label="Abuse concentrated in region 1"
                value={abuseRequestsPerMinute}
                output={`${abuseRequestsPerMinute} req/min`}
                min={data.bounds.abuseRequestsPerMinute.min}
                max={data.bounds.abuseRequestsPerMinute.max}
                step={data.bounds.abuseRequestsPerMinute.step}
                accent="rose"
                lowLabel="no attack"
                highLabel="heavy abuse"
                onChange={setAbuseRequestsPerMinute}
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <input type="checkbox" checked={partitioned} onChange={(event) => setPartitioned(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600" />
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    <Unplug aria-hidden="true" className="h-4 w-4 shrink-0" />
                    Partition region 1
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Remove its path to shared counter coordination while requests continue to arrive.</span>
                </span>
              </label>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Storage failure policy</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={failurePolicy === 'fail-closed'} label="Fail closed" detail="Refuse work that cannot spend a known shared or leased budget." icon={LockKeyhole} accent="emerald" onClick={() => setFailurePolicy('fail-closed')} />
                  <LabChoice selected={failurePolicy === 'fail-open'} label="Fail open" detail="Preserve availability by admitting work after the counter decision is unavailable." icon={DoorOpen} accent="rose" onClick={() => setFailurePolicy('fail-open')} />
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Allowed" value={`${rounded(result.allowed)} / min`} detail={`${((result.allowed / result.totalDemand) * 100).toFixed(1)}% of all offered traffic`} icon={Gauge} tone="emerald" />
              <LabMetric label="Rejected" value={`${rounded(result.rejected)} / min`} detail="Includes abuse and any legitimate requests the model cannot distinguish" icon={ShieldAlert} tone={result.rejected > 0 ? 'amber' : 'neutral'} />
              <LabMetric label="Global overshoot" value={`${rounded(result.globalOvershoot)} / min`} detail={`Against one ${data.globalLimitPerMinute} req/min identity budget`} icon={TriangleAlert} tone={isOvershooting ? 'rose' : 'emerald'} />
              <LabMetric label="Abuse admitted" value={`${rounded(result.abuseAllowed)} / min`} detail={result.riskLevel} icon={Users} tone={result.abuseAllowed >= data.globalLimitPerMinute * 0.5 ? 'rose' : result.abuseAllowed > 0 ? 'amber' : 'emerald'} />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">One identity across {regionCount} regions</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The model starts with {data.legitimateRequestsPerMinute} legitimate req/min, then concentrates abuse in region 1.</p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                    {partitioned ? <Unplug aria-hidden="true" className="h-3.5 w-3.5" /> : <RadioTower aria-hidden="true" className="h-3.5 w-3.5" />}
                    {partitioned ? `${data.partitionTimeoutMs} ms fallback trigger` : `${topology.baseDecisionLatencyMs} ms modeled check`}
                  </span>
                </div>
              </header>

              <div className="p-4">
                <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50">
                  <div className="flex items-start gap-3">
                    <Network aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{topology.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">{partitioned ? topology.partitionBehavior : topology.healthyGuarantee}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: regionCount }, (_, index) => {
                    const isIsolated = partitioned && index === 0;
                    const regionalDemand = result.legitimatePerRegion + (index === 0 ? abuseRequestsPerMinute : 0);
                    const budgetLabel = topologyId === 'local'
                      ? `${data.globalLimitPerMinute} local`
                      : topologyId === 'hybrid'
                        ? `${Math.round(result.regionalLease)} lease`
                        : `${data.globalLimitPerMinute} shared`;
                    return (
                      <div key={index} className={`min-w-0 rounded-md border p-4 ${isIsolated ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                            {isIsolated ? <Unplug aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" /> : <RadioTower aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />}
                            Region {index + 1}
                          </span>
                          <span className={`text-[11px] font-semibold uppercase ${isIsolated ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{isIsolated ? 'Partitioned' : 'Connected'}</span>
                        </div>
                        <dl className="mt-3 space-y-2 text-xs">
                          <div className="flex justify-between gap-3">
                            <dt className="text-neutral-500 dark:text-neutral-400">Offered</dt>
                            <dd className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{rounded(regionalDemand)} / min</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-neutral-500 dark:text-neutral-400">Budget model</dt>
                            <dd className="text-right font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{budgetLabel}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    <span>Admission outcome</span>
                    <span className="tabular-nums">{rounded(result.allowed)} allowed + {rounded(result.rejected)} rejected = {rounded(result.totalDemand)} offered</span>
                  </div>
                  <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-rose-400 dark:bg-rose-700" aria-label={`${admittedWidth.toFixed(1)} percent of offered traffic is allowed`}>
                    <div className="bg-emerald-500 transition-[width] duration-300" style={{ width: `${admittedWidth}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${riskTone}`}>
              <div className="flex items-start gap-3">
                {isOvershooting ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : blocksLegitimateTraffic ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Failure consequence</p>
                  <h4 className="mt-2 text-lg font-semibold">
                    {isOvershooting ? 'Availability wins, but the global promise is broken' : blocksLegitimateTraffic ? 'The budget stays bounded by rejecting uncertain work' : 'The topology preserves the modeled global bound'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {isOvershooting
                      ? `${rounded(result.globalOvershoot)} requests per minute exceed the global budget. The limiter admits about ${rounded(result.abuseAllowed)} abusive requests because enforcement is duplicated or bypassed.`
                      : blocksLegitimateTraffic
                        ? `About ${rounded(result.legitimateBlocked)} legitimate requests per minute are blocked in this aggregate model. The limiter cannot identify intent, so a bounded failure policy can protect the service while reducing availability.`
                        : 'No modeled request exceeds the global allowance and no legitimate request is blocked. Add abuse or inject a partition to test the design under uncertainty.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {policyChangesRequestPath
                ? `${failurePolicy === 'fail-open' ? 'Fail open' : 'Fail closed'} activates after the modeled coordination timeout. It is a product and security decision, not a Redis client default.`
                : topologyId === 'local'
                  ? 'The failure-policy selector does not change local admission because shared storage is not on this request path. The trade-off is duplicated global allowance.'
                  : 'With coordination healthy, both failure policies use the same authoritative budget; the distinction appears only when that decision becomes unavailable.'}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
