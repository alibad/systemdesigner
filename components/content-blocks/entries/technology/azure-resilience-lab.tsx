'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Database,
  DatabaseBackup,
  Globe2,
  LoaderCircle,
  MapPin,
  Network,
  Server,
  ShieldCheck,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Topology = {
  id: string;
  label: string;
  detail: string;
  regions: number;
  zonesPerRegion: number;
  activeRegions: number;
  normalCapacityPct: number;
  secondaryCapacityPct?: number;
  zoneRecoveryMinutes: number;
  regionRecoveryMinutes: number;
  costMultiplier: number;
};
type DataPolicy = {
  id: string;
  label: string;
  detail: string;
  zoneRpoMinutes: number;
  regionRpoMinutes: number;
  restoreMinutes: number;
  costMultiplier: number;
};
type Failure = {
  id: string;
  label: string;
  detail: string;
  scope: 'instance' | 'zone' | 'region' | 'data';
  durationMinutes: number;
};
type ResilienceData = {
  title: string;
  description: string;
  trafficRps: number;
  objectives: {
    minimumServingCapacityPct: number;
    rtoMinutes: number;
    rpoMinutes: number;
  };
  defaults: { topologyId: string; dataPolicyId: string; failureId: string };
  topologies: Topology[];
  dataPolicies: DataPolicy[];
  failures: Failure[];
};

const BLOCK_ID = 'technology/azure-resilience-lab';

const failureIcons: Record<Failure['scope'], LucideIcon> = {
  instance: Server,
  zone: CloudOff,
  region: Globe2,
  data: DatabaseBackup,
};

function isTopology(value: unknown): value is Topology {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Topology>;
  return Boolean(
    item.id
      && item.label
      && item.detail
      && typeof item.regions === 'number'
      && typeof item.zonesPerRegion === 'number'
      && typeof item.activeRegions === 'number'
      && typeof item.normalCapacityPct === 'number'
      && typeof item.zoneRecoveryMinutes === 'number'
      && typeof item.regionRecoveryMinutes === 'number'
      && typeof item.costMultiplier === 'number',
  );
}

function isDataPolicy(value: unknown): value is DataPolicy {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DataPolicy>;
  return Boolean(
    item.id
      && item.label
      && item.detail
      && typeof item.zoneRpoMinutes === 'number'
      && typeof item.regionRpoMinutes === 'number'
      && typeof item.restoreMinutes === 'number'
      && typeof item.costMultiplier === 'number',
  );
}

function isFailure(value: unknown): value is Failure {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Failure>;
  return Boolean(
    item.id
      && item.label
      && item.detail
      && ['instance', 'zone', 'region', 'data'].includes(item.scope ?? '')
      && typeof item.durationMinutes === 'number',
  );
}

function isResilienceData(value: unknown): value is ResilienceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResilienceData>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.trafficRps === 'number'
      && typeof candidate.objectives?.minimumServingCapacityPct === 'number'
      && typeof candidate.objectives.rtoMinutes === 'number'
      && typeof candidate.objectives.rpoMinutes === 'number'
      && candidate.defaults?.topologyId
      && candidate.defaults.dataPolicyId
      && candidate.defaults.failureId
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length >= 3
      && candidate.topologies.every(isTopology)
      && Array.isArray(candidate.dataPolicies)
      && candidate.dataPolicies.length >= 2
      && candidate.dataPolicies.every(isDataPolicy)
      && Array.isArray(candidate.failures)
      && candidate.failures.length >= 3
      && candidate.failures.every(isFailure),
  );
}

export default function AzureResilienceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ResilienceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No Azure resilience scenario model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the resilience model (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isResilienceData(payload)) {
          throw new Error('The resilience model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the resilience model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <ResilienceLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ResilienceWorkbench data={data} />;
}

function ResilienceWorkbench({ data }: { data: ResilienceData }) {
  const [topologyId, setTopologyId] = useState(data.defaults.topologyId);
  const [dataPolicyId, setDataPolicyId] = useState(data.defaults.dataPolicyId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const dataPolicy = data.dataPolicies.find((item) => item.id === dataPolicyId)
    ?? data.dataPolicies[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];

  const result = useMemo(() => {
    let survivingCapacityPct = topology.normalCapacityPct;
    let rtoMinutes = 2;
    let rpoMinutes = 0;
    let secondaryActive = false;
    let dataRecoverable = true;
    let explanation = 'A healthy peer absorbs the failed instance while the platform replaces it.';

    if (failure.scope === 'instance') {
      survivingCapacityPct = topology.normalCapacityPct * 0.8;
    } else if (failure.scope === 'zone') {
      survivingCapacityPct = topology.zonesPerRegion > 1
        ? topology.normalCapacityPct * (topology.zonesPerRegion - 1) / topology.zonesPerRegion
        : 0;
      rtoMinutes = topology.zoneRecoveryMinutes;
      rpoMinutes = dataPolicy.zoneRpoMinutes;
      explanation = topology.zonesPerRegion > 1
        ? 'Traffic leaves the failed zone. Surviving instances and zonally resilient dependencies must carry the full peak.'
        : 'Every instance shares the failed zone, so replica count does not preserve service.';
    } else if (failure.scope === 'region') {
      const hasRegionalDataCopy = dataPolicy.id !== 'local-backup';
      survivingCapacityPct = hasRegionalDataCopy ? topology.secondaryCapacityPct ?? 0 : 0;
      secondaryActive = survivingCapacityPct > 0;
      rtoMinutes = secondaryActive
        ? topology.regionRecoveryMinutes
        : Math.max(topology.regionRecoveryMinutes, dataPolicy.restoreMinutes);
      rpoMinutes = dataPolicy.regionRpoMinutes;
      explanation = secondaryActive
        ? 'Global routing can move traffic only after the secondary is healthy, authorized, sufficiently scaled, and using an accepted data position.'
        : hasRegionalDataCopy
          ? 'There is no ready regional serving target. Recovery waits for replacement capacity and a verified data restore.'
          : 'Secondary compute is not useful without a current cross-region data copy. Recovery waits for a verified restore before traffic can move.';
    } else {
      const isolatedHistory = dataPolicy.id === 'local-backup' || dataPolicy.id === 'geo-plus-vault';
      survivingCapacityPct = isolatedHistory ? 0 : topology.normalCapacityPct;
      dataRecoverable = isolatedHistory;
      rtoMinutes = isolatedHistory ? dataPolicy.restoreMinutes : Math.max(240, dataPolicy.restoreMinutes);
      rpoMinutes = isolatedHistory ? dataPolicy.regionRpoMinutes : 60;
      explanation = dataPolicy.id === 'geo-plus-vault'
        ? 'Replication copied the deletion, but the isolated retained backup provides a recovery point. The application remains unavailable until restore and validation complete.'
        : dataPolicy.id === 'local-backup'
          ? 'The retained regional backup provides historical state, but recovery is slower and does not create a ready regional failover path.'
        : 'A live replica copies valid deletes and corruption. Without isolated historical recovery, serving capacity remains online while the correct business state is lost.';
    }

    const capacityMet = survivingCapacityPct >= data.objectives.minimumServingCapacityPct;
    const rtoMet = rtoMinutes <= data.objectives.rtoMinutes;
    const rpoMet = rpoMinutes <= data.objectives.rpoMinutes;
    const objectiveMet = capacityMet && rtoMet && rpoMet && dataRecoverable;
    const costMultiplier = topology.costMultiplier * dataPolicy.costMultiplier;
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The design meets the modeled failure objective';

    if (!dataRecoverable || survivingCapacityPct === 0 || rtoMinutes > data.objectives.rtoMinutes * 3) {
      tone = 'rose';
      verdict = failure.scope === 'data' && !dataRecoverable
        ? 'The service is available, but the deleted state is not protected'
        : 'The failure becomes a workload outage';
    } else if (!objectiveMet) {
      tone = 'amber';
      verdict = 'The design survives, but misses at least one objective';
    }

    return {
      capacityMet,
      costMultiplier,
      dataRecoverable,
      explanation,
      objectiveMet,
      rpoMet,
      rpoMinutes,
      rtoMet,
      rtoMinutes,
      secondaryActive,
      survivingCapacityPct,
      tone,
      verdict,
    };
  }, [data.objectives, dataPolicy, failure.scope, topology]);

  function reset() {
    setTopologyId(data.defaults.topologyId);
    setDataPolicyId(data.defaults.dataPolicyId);
    setFailureId(data.defaults.failureId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Azure failure-domain lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Deployment topology"
                items={data.topologies}
                selectedId={topology.id}
                icon={Network}
                accent="blue"
                onSelect={setTopologyId}
              />
              <ChoiceGroup
                label="2. Data protection"
                items={data.dataPolicies}
                selectedId={dataPolicy.id}
                icon={DatabaseBackup}
                accent="violet"
                onSelect={setDataPolicyId}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  3. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.failures.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === failure.id}
                      label={item.label}
                      detail={item.detail}
                      icon={failureIcons[item.scope]}
                      accent="rose"
                      onClick={() => setFailureId(item.id)}
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
                label="Serving capacity"
                value={`${Math.max(0, result.survivingCapacityPct).toFixed(0)}%`}
                detail={`Target at least ${data.objectives.minimumServingCapacityPct}% of ${data.trafficRps.toLocaleString()} rps`}
                icon={Activity}
                tone={result.capacityMet ? 'emerald' : result.survivingCapacityPct > 0 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Recovery time"
                value={`${result.rtoMinutes} min`}
                detail={`RTO target ${data.objectives.rtoMinutes} minutes`}
                icon={Timer}
                tone={result.rtoMet ? 'emerald' : result.rtoMinutes <= data.objectives.rtoMinutes * 3 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Recovery point"
                value={`${result.rpoMinutes} min`}
                detail={`RPO target ${data.objectives.rpoMinutes} minutes`}
                icon={Database}
                tone={result.rpoMet && result.dataRecoverable ? 'emerald' : result.dataRecoverable ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Relative steady cost"
                value={`${result.costMultiplier.toFixed(2)}x`}
                detail="Topology and data protection multiplier"
                icon={Globe2}
                tone={result.costMultiplier < 1.5 ? 'cyan' : result.costMultiplier < 2 ? 'amber' : 'violet'}
              />
            </div>

            <ArchitectureMap
              topology={topology}
              dataPolicy={dataPolicy}
              failure={failure}
              secondaryActive={result.secondaryActive}
            />

            <section className={`rounded-md border p-5 ${toneClasses[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : result.tone === 'amber' ? (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.explanation}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <Objective
                label="Keep serving"
                met={result.capacityMet}
                detail={`${Math.max(0, result.survivingCapacityPct).toFixed(0)}% capacity remains`}
              />
              <Objective
                label="Recover on time"
                met={result.rtoMet}
                detail={`${result.rtoMinutes} minutes versus ${data.objectives.rtoMinutes}`}
              />
              <Objective
                label="Protect state"
                met={result.rpoMet && result.dataRecoverable}
                detail={result.dataRecoverable ? `${result.rpoMinutes}-minute recovery point` : 'No isolated recovery copy'}
              />
            </section>
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
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: T[];
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet';
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
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ArchitectureMap({
  topology,
  dataPolicy,
  failure,
  secondaryActive,
}: {
  topology: Topology;
  dataPolicy: DataPolicy;
  failure: Failure;
  secondaryActive: boolean;
}) {
  const primaryFailed = failure.scope === 'region';
  const zoneFailed = failure.scope === 'zone';
  const dataDamaged = failure.scope === 'data';
  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure path</p>
        <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{topology.label} + {dataPolicy.label}</p>
      </div>
      <div className="p-4">
        <div className="flex flex-col items-center gap-3 md:flex-row">
          <MapNode icon={Globe2} eyebrow="Clients" label="Global demand" state="healthy" />
          <FlowArrow />
          <MapNode icon={Network} eyebrow="Entry" label="Global routing" state="healthy" />
          <FlowArrow />
          <div className="grid w-full min-w-0 flex-1 gap-3 sm:grid-cols-2">
            <MapNode
              icon={MapPin}
              eyebrow={`Primary · ${topology.zonesPerRegion} ${topology.zonesPerRegion === 1 ? 'zone' : 'zones'}`}
              label={primaryFailed ? 'Region unavailable' : zoneFailed ? 'One zone unavailable' : 'Serving traffic'}
              state={primaryFailed ? 'failed' : zoneFailed ? 'degraded' : 'healthy'}
            />
            <MapNode
              icon={Server}
              eyebrow={topology.regions > 1 ? 'Secondary region' : 'Regional recovery'}
              label={topology.regions > 1 ? secondaryActive ? 'Failover serving' : topology.activeRegions > 1 ? 'Serving traffic' : 'Warm capacity' : 'No ready target'}
              state={topology.regions > 1 ? secondaryActive || topology.activeRegions > 1 ? 'healthy' : 'standby' : 'standby'}
            />
          </div>
          <FlowArrow />
          <MapNode
            icon={DatabaseBackup}
            eyebrow="Data boundary"
            label={dataDamaged ? dataPolicy.id === 'geo-plus-vault' ? 'Restore from vault' : 'Deletion replicated' : dataPolicy.label}
            state={dataDamaged ? dataPolicy.id === 'geo-plus-vault' ? 'degraded' : 'failed' : 'healthy'}
          />
        </div>
      </div>
    </section>
  );
}

function FlowArrow() {
  return (
    <>
      <ArrowDown aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 shrink-0 text-neutral-400 md:block" />
    </>
  );
}

function MapNode({
  icon: Icon,
  eyebrow,
  label,
  state,
}: {
  icon: LucideIcon;
  eyebrow: string;
  label: string;
  state: 'healthy' | 'standby' | 'degraded' | 'failed';
}) {
  const states = {
    healthy: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
    standby: 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200',
    degraded: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
  };
  return (
    <div className={`w-full min-w-0 rounded-md border p-3 ${states[state]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{eyebrow}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-5">{label}</p>
      <p className="mt-1 text-xs capitalize opacity-75">{state}</p>
    </div>
  );
}

function Objective({ label, met, detail }: { label: string; met: boolean; detail: string }) {
  return (
    <div className={`rounded-md border p-4 ${met ? toneClasses.emerald : toneClasses.rose}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {met ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}
        {label}
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

const toneClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
};

function ResilienceLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Azure failure-domain lab"
        title="Loading the resilience model"
        description="The lesson is loading topologies, recovery policies, and failure scenarios."
        icon={ShieldCheck}
        accent="rose"
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
                className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-neutral-600 dark:text-neutral-300">
              <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
              <p className="mt-3 text-sm">Loading failure scenarios...</p>
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
