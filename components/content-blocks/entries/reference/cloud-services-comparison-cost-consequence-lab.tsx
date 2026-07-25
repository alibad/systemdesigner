'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Blocks,
  CheckCircle2,
  CircleDollarSign,
  CloudOff,
  Database,
  Gauge,
  Globe2,
  Network,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
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

type RedundancyId = 'zonal' | 'warm-region' | 'active-active';
type ManagedDepthId = 'infrastructure-led' | 'selectively-managed' | 'deeply-managed';

type Assumptions = {
  baselineRequestsMillions: number;
  computePerMillionRequests: number;
  statePerMillionRequests: number;
  baseStorageTb: number;
  storagePerTbMonth: number;
  internetEgressPerTb: number;
  replicationPerBaselineTraffic: number;
  observabilityAndSupportMonthly: number;
  operatorHoursPerMonth: number;
};

type RedundancyOption = {
  id: RedundancyId;
  label: string;
  detail: string;
  resourceMultiplier: number;
  dataCopies: number;
  replicationMultiplier: number;
  operationsMultiplier: number;
  exerciseHours: number;
  survivorCapacityPercent: number;
  recoveryTarget: string;
  lockInPoints: number;
  normalConsequence: string;
  failureConsequence: string;
};

type ManagedDepthOption = {
  id: ManagedDepthId;
  label: string;
  detail: string;
  costMultiplier: number;
  platformFeeMonthly: number;
  baseOperationsHours: number;
  lockInPoints: number;
  migrationWeeks: number;
  responsibility: string;
  exitAction: string;
};

type CostConsequenceModel = {
  assumptions: Assumptions;
  redundancyOptions: RedundancyOption[];
  managedDepthOptions: ManagedDepthOption[];
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const redundancyIcons = {
  zonal: Database,
  'warm-region': ArrowLeftRight,
  'active-active': ShieldCheck,
} as const;

const managedDepthIcons = {
  'infrastructure-led': ServerCog,
  'selectively-managed': Gauge,
  'deeply-managed': Blocks,
} as const;

function formatTraffic(requestsMillions: number) {
  if (requestsMillions >= 1000) {
    return `${(requestsMillions / 1000).toFixed(requestsMillions % 1000 === 0 ? 0 : 1)}B`;
  }
  return `${requestsMillions}M`;
}

export default function CloudServicesComparisonCostConsequenceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CostConsequenceModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trafficMillions, setTrafficMillions] = useState(250);
  const [redundancyId, setRedundancyId] = useState<RedundancyId>('warm-region');
  const [managedDepthId, setManagedDepthId] = useState<ManagedDepthId>('selectively-managed');
  const [egressTb, setEgressTb] = useState(8);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The consequence model data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<CostConsequenceModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the consequence model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/cloud-services-comparison-cost-consequence-lab">
        <div
          className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
          role="alert"
        >
          <p className="font-semibold">Cost consequence model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/cloud-services-comparison-cost-consequence-lab">
        <div
          className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
          aria-label="Loading cost consequence model"
        />
      </div>
    );
  }

  const redundancy = data.redundancyOptions.find((option) => option.id === redundancyId) ?? data.redundancyOptions[0];
  const managedDepth = data.managedDepthOptions.find((option) => option.id === managedDepthId) ?? data.managedDepthOptions[0];

  if (!redundancy || !managedDepth) {
    return (
      <div data-content-block="reference/cloud-services-comparison-cost-consequence-lab">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
          The consequence model has no redundancy or managed-service options.
        </div>
      </div>
    );
  }

  const { assumptions } = data;
  const trafficRatio = trafficMillions / assumptions.baselineRequestsMillions;
  const workloadCost =
    trafficMillions *
    (assumptions.computePerMillionRequests + assumptions.statePerMillionRequests) *
    redundancy.resourceMultiplier *
    managedDepth.costMultiplier;
  const storageCost = assumptions.baseStorageTb * assumptions.storagePerTbMonth * redundancy.dataCopies;
  const egressCost = egressTb * assumptions.internetEgressPerTb;
  const replicationCost =
    trafficRatio * assumptions.replicationPerBaselineTraffic * redundancy.replicationMultiplier;
  const platformCost = assumptions.observabilityAndSupportMonthly + managedDepth.platformFeeMonthly;
  const monthlyTotal = workloadCost + storageCost + egressCost + replicationCost + platformCost;
  const baselineCost =
    trafficMillions *
      (assumptions.computePerMillionRequests + assumptions.statePerMillionRequests) *
      1.15 *
      0.85 +
    assumptions.baseStorageTb * assumptions.storagePerTbMonth +
    egressCost +
    assumptions.observabilityAndSupportMonthly +
    100;
  const architecturePremium = ((monthlyTotal - baselineCost) / baselineCost) * 100;
  const scalePressure = Math.max(0.8, 1 + Math.log10(Math.max(0.25, trafficRatio)) / 3);
  const operationsHours = Math.round(
    (managedDepth.baseOperationsHours + redundancy.exerciseHours) *
      redundancy.operationsMultiplier *
      scalePressure,
  );
  const operationsFte = operationsHours / assumptions.operatorHoursPerMonth;
  const lockInScore = Math.min(100, managedDepth.lockInPoints + redundancy.lockInPoints);
  const migrationWeeks = managedDepth.migrationWeeks + Math.round(redundancy.lockInPoints / 3);
  const lockInLabel = lockInScore >= 70 ? 'High coupling' : lockInScore >= 40 ? 'Moderate coupling' : 'Lower coupling';
  const egressShare = (egressCost / monthlyTotal) * 100;
  const exitTransfer = egressCost;
  const survivesRegion = redundancy.survivorCapacityPercent >= 100;
  const categories = [
    { label: 'Serving and state requests', value: workloadCost, tone: 'bg-blue-500' },
    { label: 'Stored data copies', value: storageCost, tone: 'bg-violet-500' },
    { label: 'Internet egress', value: egressCost, tone: 'bg-amber-500' },
    { label: 'Cross-region replication', value: replicationCost, tone: 'bg-cyan-500' },
    { label: 'Platform, support, and observability', value: platformCost, tone: 'bg-emerald-500' },
  ];

  return (
    <div data-content-block="reference/cloud-services-comparison-cost-consequence-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cost, resilience, and lock-in consequence lab"
          title="Change the architecture and inspect what the spend buys"
          description="Adjust demand, redundancy, managed-service depth, and egress. The model updates monthly cost, regional-loss capacity, operator load, and migration friction from explicit planning assumptions."
          icon={CircleDollarSign}
          accent="emerald"
          onReset={() => {
            setTrafficMillions(250);
            setRedundancyId('warm-region');
            setManagedDepthId('selectively-managed');
            setEgressTb(8);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange
                label="Monthly requests"
                value={trafficMillions}
                output={formatTraffic(trafficMillions)}
                min={25}
                max={2000}
                step={25}
                accent="blue"
                lowLabel="25 million"
                highLabel="2 billion"
                onChange={setTrafficMillions}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Regional redundancy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.redundancyOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === redundancy.id}
                      label={option.label}
                      detail={option.detail}
                      icon={redundancyIcons[option.id]}
                      accent={option.id === 'active-active' ? 'emerald' : option.id === 'warm-region' ? 'cyan' : 'amber'}
                      onClick={() => setRedundancyId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Managed-service depth
                </legend>
                <div className="mt-3 space-y-2">
                  {data.managedDepthOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === managedDepth.id}
                      label={option.label}
                      detail={option.detail}
                      icon={managedDepthIcons[option.id]}
                      accent={option.id === 'deeply-managed' ? 'violet' : option.id === 'selectively-managed' ? 'blue' : 'amber'}
                      onClick={() => setManagedDepthId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Monthly internet egress"
                value={egressTb}
                output={`${egressTb} TB`}
                min={0}
                max={100}
                step={2}
                accent="amber"
                lowLabel="internal traffic"
                highLabel="egress-heavy"
                onChange={setEgressTb}
              />
            </div>
          }
        >
          <div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Modeled monthly total"
                value={money.format(monthlyTotal)}
                detail={`${architecturePremium >= 0 ? '+' : ''}${architecturePremium.toFixed(0)}% versus the infrastructure-led zonal baseline.`}
                icon={CircleDollarSign}
                tone="blue"
              />
              <LabMetric
                label="Regional-loss capacity"
                value={`${redundancy.survivorCapacityPercent}%`}
                detail={redundancy.recoveryTarget}
                icon={redundancy.survivorCapacityPercent === 0 ? CloudOff : ShieldCheck}
                tone={survivesRegion ? 'emerald' : redundancy.survivorCapacityPercent > 0 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Operator load"
                value={`${operationsHours} h/mo`}
                detail={`${operationsFte.toFixed(1)} operator FTE at 160 hours per month.`}
                icon={Users}
                tone="cyan"
              />
              <LabMetric
                label="Migration friction"
                value={`${lockInScore}/100`}
                detail={`${lockInLabel}; modeled ${migrationWeeks} engineer-weeks.`}
                icon={Blocks}
                tone={lockInScore >= 70 ? 'rose' : lockInScore >= 40 ? 'violet' : 'emerald'}
              />
            </div>

            <section className="mt-6 border-y border-neutral-200 py-4 dark:border-neutral-800">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">Modeled monthly cost path</h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Generic planning rates make causality visible; they are not current provider quotes.
                  </p>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{formatTraffic(trafficMillions)} requests</p>
              </div>
              <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {categories.map((category) => (
                  <li key={category.label} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_92px] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{category.label}</span>
                        <span className="text-xs font-semibold tabular-nums text-neutral-500 sm:hidden">{money.format(category.value)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-[width] duration-300 ${category.tone}`}
                          style={{ width: `${Math.max(category.value > 0 ? 3 : 0, (category.value / monthlyTotal) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="hidden text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">
                      {money.format(category.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6" aria-live="polite">
              <div className={`border-l-4 px-4 py-4 ${survivesRegion ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {survivesRegion ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">Regional failure consequence</p>
                    <h4 className="mt-1 text-lg font-semibold">
                      {survivesRegion ? 'The modeled survivor carries full demand' : 'The modeled recovery path needs a degraded mode'}
                    </h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">{redundancy.failureConsequence}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 grid gap-6 border-t border-neutral-200 pt-5 lg:grid-cols-3 dark:border-neutral-800">
              <section>
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Activity aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Normal-state resilience
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{redundancy.normalConsequence}</p>
              </section>
              <section>
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <ServerCog aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Operating ownership
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{managedDepth.responsibility}</p>
              </section>
              <section>
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Globe2 aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Egress and exit path
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  Egress is {egressShare.toFixed(0)}% of this model. Moving the same {egressTb} TB volume would add about {money.format(exitTransfer)} at the planning rate before migration labor.
                </p>
              </section>
            </div>

            <section className="mt-6 border-l-4 border-violet-500 bg-violet-50 px-4 py-4 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Network aria-hidden="true" className="h-4 w-4" />
                Exit work exposed by this choice
              </p>
              <p className="mt-2 text-sm leading-6 opacity-85">{managedDepth.exitAction}</p>
              <p className="mt-2 text-xs leading-5 opacity-75">
                Planning assumptions: {money.format(assumptions.internetEgressPerTb)}/TB internet egress, {money.format(assumptions.storagePerTbMonth)}/TB-month storage, and {assumptions.baseStorageTb} TB of primary data. Taxes, discounts, licenses, and incident impact are excluded.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
