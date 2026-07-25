'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  CircleDollarSign,
  CloudOff,
  Database,
  Globe2,
  Network,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TopologyId = 'single-region' | 'warm-standby' | 'active-active';

type CostAssumptions = {
  primaryComputeMonthly: number;
  datasetTb: number;
  storagePerTbMonth: number;
  internetEgressPerTb: number;
  interRegionTransferPerTb: number;
};

type Topology = {
  id: TopologyId;
  label: string;
  detail: string;
  computeMultiplier: number;
  storageCopies: number;
  replicationTransfers: number;
  survivorCapacityPercent: number;
  normalResult: string;
  failureResult: string;
  recoveryTarget: string;
};

type CostModel = {
  assumptions: CostAssumptions;
  topologies: Topology[];
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const topologyIcons = {
  'single-region': Database,
  'warm-standby': ArrowLeftRight,
  'active-active': ShieldCheck,
} as const;

export default function CloudComparisonCostResilienceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CostModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topologyId, setTopologyId] = useState<TopologyId>('warm-standby');
  const [internetEgressTb, setInternetEgressTb] = useState(8);
  const [changedDataTb, setChangedDataTb] = useState(3);
  const [regionalFailure, setRegionalFailure] = useState(false);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The cost and resilience data file was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<CostModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the cost model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">Cost and resilience model unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[420px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading cost and resilience model" />
    );
  }

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const { assumptions } = data;
  const computeCost = assumptions.primaryComputeMonthly * topology.computeMultiplier;
  const storageCost = assumptions.datasetTb * assumptions.storagePerTbMonth * topology.storageCopies;
  const internetEgressCost = internetEgressTb * assumptions.internetEgressPerTb;
  const replicationCost = changedDataTb * assumptions.interRegionTransferPerTb * topology.replicationTransfers;
  const monthlyTotal = computeCost + storageCost + internetEgressCost + replicationCost;
  const networkCost = internetEgressCost + replicationCost;
  const categories = [
    { label: 'Compute and standby', value: computeCost, tone: 'bg-blue-500' },
    { label: 'Stored data copies', value: storageCost, tone: 'bg-violet-500' },
    { label: 'Internet egress', value: internetEgressCost, tone: 'bg-amber-500' },
    { label: 'Cross-region replication', value: replicationCost, tone: 'bg-cyan-500' },
  ];
  const survivesTarget = topology.survivorCapacityPercent >= 100;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Cost, egress, and resilience model"
        title="Price the paths, then remove a region"
        description="Choose a topology and vary transfer volumes. Injecting a regional failure reveals whether the extra spend buys usable serving capacity or only another copy of the system."
        icon={CircleDollarSign}
        accent="emerald"
        onReset={() => {
          setTopologyId('warm-standby');
          setInternetEgressTb(8);
          setChangedDataTb(3);
          setRegionalFailure(false);
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Regional topology</legend>
              <div className="mt-3 space-y-2">
                {data.topologies.map((option) => (
                  <LabChoice
                    key={option.id}
                    selected={option.id === topology.id}
                    label={option.label}
                    detail={option.detail}
                    icon={topologyIcons[option.id]}
                    accent={option.id === 'active-active' ? 'emerald' : option.id === 'warm-standby' ? 'cyan' : 'amber'}
                    onClick={() => setTopologyId(option.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Monthly internet egress"
              value={internetEgressTb}
              output={`${internetEgressTb} TB`}
              min={0}
              max={50}
              step={1}
              accent="amber"
              lowLabel="internal traffic"
              highLabel="egress-heavy"
              onChange={setInternetEgressTb}
            />

            <LabRange
              label="Changed data replicated monthly"
              value={changedDataTb}
              output={`${changedDataTb.toFixed(1)} TB`}
              min={0}
              max={20}
              step={0.5}
              accent="cyan"
              lowLabel="mostly read-only"
              highLabel="write-heavy"
              onChange={setChangedDataTb}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <input
                type="checkbox"
                checked={regionalFailure}
                onChange={(event) => setRegionalFailure(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-rose-600"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Inject a regional failure
                </span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Remove the primary region and inspect serving capacity and recovery work.</span>
              </span>
            </label>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Modeled monthly total" value={money.format(monthlyTotal)} detail="Planning model, not a provider quote." icon={CircleDollarSign} tone="blue" />
            <LabMetric label="Network transfer" value={money.format(networkCost)} detail={`${money.format(internetEgressCost)} internet + ${money.format(replicationCost)} replication`} icon={Network} tone="amber" />
            <LabMetric
              label={regionalFailure ? 'Capacity after loss' : 'Normal serving capacity'}
              value={regionalFailure ? `${topology.survivorCapacityPercent}%` : '100%'}
              detail={regionalFailure ? topology.recoveryTarget : `${topology.storageCopies} modeled data ${topology.storageCopies === 1 ? 'copy' : 'copies'}`}
              icon={regionalFailure ? CloudOff : Activity}
              tone={regionalFailure ? (survivesTarget ? 'emerald' : 'rose') : 'emerald'}
            />
          </div>

          <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Modeled monthly cost path</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Every category uses the explicit assumptions shown below. Replace them with current regional quotes before approval.</p>
            </header>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {categories.map((category) => (
                <li key={category.label} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_88px] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{category.label}</span>
                      <span className="text-xs font-semibold tabular-nums text-neutral-500 sm:hidden">{money.format(category.value)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div className={`h-full rounded-full transition-[width] duration-300 ${category.tone}`} style={{ width: `${Math.max(category.value > 0 ? 3 : 0, (category.value / monthlyTotal) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="hidden text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">{money.format(category.value)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`mt-5 rounded-md border p-5 ${regionalFailure ? (survivesTarget ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50') : 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50'}`}>
            <div className="flex items-start gap-3">
              {regionalFailure ? (survivesTarget ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />) : <Globe2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">{regionalFailure ? 'Regional failure consequence' : 'Normal-state consequence'}</p>
                <h4 className="mt-2 text-lg font-semibold">{regionalFailure ? (survivesTarget ? 'The model preserves target capacity' : 'The recovery path cannot carry full demand') : topology.label}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{regionalFailure ? topology.failureResult : topology.normalResult}</p>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Planning assumptions</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              Primary compute {money.format(assumptions.primaryComputeMonthly)}/month; {assumptions.datasetTb} TB dataset at {money.format(assumptions.storagePerTbMonth)}/TB-month; internet egress {money.format(assumptions.internetEgressPerTb)}/TB; cross-region transfer {money.format(assumptions.interRegionTransferPerTb)}/TB. Taxes, requests, support, observability, discounts, engineering time, and recovery labor are excluded.
            </p>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
