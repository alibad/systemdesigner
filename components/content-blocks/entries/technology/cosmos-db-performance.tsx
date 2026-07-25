'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Database,
  Gauge,
  Globe2,
  LoaderCircle,
  Network,
  ShieldCheck,
  TriangleAlert,
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

type Bound = { min: number; max: number; step: number };
type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  requestsPerSecond: number;
  provisionedRuPerSecond: number;
  hotKeySharePct: number;
  readPct: number;
  writePct: number;
  queryPct: number;
  storageGiB: number;
  regions: number;
};
type Consistency = {
  id: string;
  label: string;
  readMultiplier: number;
  detail: string;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    pointReadRu: number;
    pointWriteRu: number;
    queryRu: number;
    physicalPartitionRuLimit: number;
    warningPressurePct: number;
  };
  bounds: {
    requestsPerSecond: Bound;
    provisionedRuPerSecond: Bound;
    hotKeySharePct: Bound;
    regions: Bound;
  };
  consistencies: Consistency[];
  profiles: WorkloadProfile[];
};

const BLOCK_ID = 'technology/cosmos-db-performance';
const DATA_FILE = '/api/content/technology/cosmos-db/data/capacity-envelope.json';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.assumptions
      && candidate.bounds
      && Array.isArray(candidate.consistencies)
      && candidate.consistencies.length > 0
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
  );
}

function formatRu(value: number) {
  return `${Math.round(value).toLocaleString()} RU/s`;
}

export default function CosmosDBPerformance() {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [profileId, setProfileId] = useState('customer-orders');
  const [requestsPerSecond, setRequestsPerSecond] = useState(1200);
  const [provisionedRuPerSecond, setProvisionedRuPerSecond] = useState(12000);
  const [hotKeySharePct, setHotKeySharePct] = useState(18);
  const [regions, setRegions] = useState(2);
  const [consistencyId, setConsistencyId] = useState('session');

  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_FILE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity model is invalid');
        setData(payload);
        const initial = payload.profiles[0];
        setProfileId(initial.id);
        setRequestsPerSecond(initial.requestsPerSecond);
        setProvisionedRuPerSecond(initial.provisionedRuPerSecond);
        setHotKeySharePct(initial.hotKeySharePct);
        setRegions(initial.regions);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const selectedProfile = data?.profiles.find((profile) => profile.id === profileId) ?? data?.profiles[0];
  const consistency = data?.consistencies.find((item) => item.id === consistencyId) ?? data?.consistencies[0];

  const model = useMemo(() => {
    if (!data || !selectedProfile || !consistency) return null;
    const readShare = selectedProfile.readPct / 100;
    const writeShare = selectedProfile.writePct / 100;
    const queryShare = selectedProfile.queryPct / 100;
    const weightedRequestRu =
      readShare * data.assumptions.pointReadRu * consistency.readMultiplier
      + writeShare * data.assumptions.pointWriteRu
      + queryShare * data.assumptions.queryRu * consistency.readMultiplier;
    const requiredRuPerSecond = requestsPerSecond * weightedRequestRu;
    const physicalPartitions = Math.max(
      1,
      Math.ceil(provisionedRuPerSecond / data.assumptions.physicalPartitionRuLimit)
    );
    const partitionBudget = provisionedRuPerSecond / physicalPartitions;
    const hottestPartitionRu = requiredRuPerSecond * (hotKeySharePct / 100);
    const aggregatePressurePct = (requiredRuPerSecond / provisionedRuPerSecond) * 100;
    const hotPartitionPressurePct = (hottestPartitionRu / partitionBudget) * 100;
    const bottleneckPressurePct = Math.max(aggregatePressurePct, hotPartitionPressurePct);
    const estimatedThrottledPct = Math.max(0, Math.min(100, 100 - 10000 / Math.max(100, bottleneckPressurePct)));
    const healthy = bottleneckPressurePct < data.assumptions.warningPressurePct;

    return {
      weightedRequestRu,
      requiredRuPerSecond,
      physicalPartitions,
      partitionBudget,
      hottestPartitionRu,
      aggregatePressurePct,
      hotPartitionPressurePct,
      bottleneckPressurePct,
      estimatedThrottledPct,
      healthy,
      globalProvisionedRu: provisionedRuPerSecond * regions,
    };
  }, [consistency, data, hotKeySharePct, provisionedRuPerSecond, regions, requestsPerSecond, selectedProfile]);

  const applyProfile = (profile: WorkloadProfile) => {
    setProfileId(profile.id);
    setRequestsPerSecond(profile.requestsPerSecond);
    setProvisionedRuPerSecond(profile.provisionedRuPerSecond);
    setHotKeySharePct(profile.hotKeySharePct);
    setRegions(profile.regions);
  };

  const reset = () => {
    if (data?.profiles[0]) applyProfile(data.profiles[0]);
    setConsistencyId('session');
  };

  if (loadError) {
    return (
      <div className="not-prose my-7 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <TriangleAlert aria-hidden="true" className="h-5 w-5" />
        The Cosmos DB capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !selectedProfile || !consistency || !model) {
    return (
      <div className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-950 text-neutral-300 dark:border-neutral-800">
        <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
        Loading the request envelope...
      </div>
    );
  }

  const verdictTone = model.healthy ? 'emerald' : model.bottleneckPressurePct < 110 ? 'amber' : 'rose';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="RU and partition pressure lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload shape</p>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={Database}
                      accent="violet"
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </div>
              <LabRange
                label="Request rate"
                value={requestsPerSecond}
                output={`${requestsPerSecond.toLocaleString()}/s`}
                {...data.bounds.requestsPerSecond}
                accent="blue"
                lowLabel="quiet"
                highLabel="peak"
                onChange={setRequestsPerSecond}
              />
              <LabRange
                label="Provisioned per region"
                value={provisionedRuPerSecond}
                output={formatRu(provisionedRuPerSecond)}
                {...data.bounds.provisionedRuPerSecond}
                accent="cyan"
                lowLabel="lean"
                highLabel="headroom"
                onChange={setProvisionedRuPerSecond}
              />
              <LabRange
                label="Traffic on hottest key range"
                value={hotKeySharePct}
                output={`${hotKeySharePct}%`}
                {...data.bounds.hotKeySharePct}
                accent="rose"
                lowLabel="even"
                highLabel="hot key"
                onChange={setHotKeySharePct}
              />
              <LabRange
                label="Regions"
                value={regions}
                output={String(regions)}
                {...data.bounds.regions}
                accent="emerald"
                lowLabel="single region"
                highLabel="global"
                onChange={setRegions}
              />
              <label className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Read consistency</span>
                <select
                  value={consistencyId}
                  onChange={(event) => setConsistencyId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.consistencies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{consistency.detail}</span>
              </label>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.healthy
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Planning verdict</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.healthy ? 'Aggregate and hot-partition budgets have headroom' : 'The workload is expected to throttle'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.healthy
                    ? `The busiest modeled partition reaches ${Math.round(model.hotPartitionPressurePct)}% of its share. Keep measuring request charge and normalized RU consumption by partition key range.`
                    : `The tighter budget reaches ${Math.round(model.bottleneckPressurePct)}%. Adding account-level RU/s alone will not repair a low-cardinality or heavily skewed partition key.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Required per region" value={formatRu(model.requiredRuPerSecond)} detail={`${model.weightedRequestRu.toFixed(1)} RU per modeled request`} icon={Zap} tone="cyan" />
            <LabMetric label="Hot partition" value={`${Math.round(model.hotPartitionPressurePct)}%`} detail={`${formatRu(model.hottestPartitionRu)} against its modeled share`} icon={Activity} tone={verdictTone} />
            <LabMetric label="Physical partitions" value={String(model.physicalPartitions)} detail={`${formatRu(model.partitionBudget)} per modeled partition`} icon={Network} tone="violet" />
            <LabMetric label="Global provisioned" value={formatRu(model.globalProvisionedRu)} detail={`${regions} region${regions === 1 ? '' : 's'} each receive the configured RU/s`} icon={Globe2} tone="blue" />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Bottleneck pressure</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{Math.round(model.bottleneckPressurePct)}%</p>
              </div>
              <p className="text-right text-sm text-neutral-600 dark:text-neutral-300">
                {model.estimatedThrottledPct > 0 ? `About ${model.estimatedThrottledPct.toFixed(1)}% modeled excess` : 'No modeled excess'}
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${model.healthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, model.bottleneckPressurePct)}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500">Aggregate budget</p>
                <p className="mt-1 font-semibold text-neutral-950 dark:text-white">{Math.round(model.aggregatePressurePct)}% of regional RU/s</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500">Partition budget</p>
                <p className="mt-1 font-semibold text-neutral-950 dark:text-white">{Math.round(model.hotPartitionPressurePct)}% on the hottest range</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
