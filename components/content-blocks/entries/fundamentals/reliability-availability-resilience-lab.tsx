'use client';

import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowDown,
  BadgeCheck,
  Boxes,
  Building2,
  Check,
  CircleOff,
  CloudCog,
  Database,
  Globe2,
  Network,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  TimerReset,
  Unplug,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';

type FailureId = 'instance' | 'zone' | 'region' | 'dependency';
type TopologyId = 'single' | 'multi-zone' | 'multi-region';

interface FailureOption {
  label: string;
  boundary: string;
  summary: string;
  icon: LucideIcon;
}

const FAILURES: Record<FailureId, FailureOption> = {
  instance: {
    label: 'Instance crash',
    boundary: 'Process boundary',
    summary: 'One application instance stops serving traffic.',
    icon: ServerCrash,
  },
  zone: {
    label: 'Zone outage',
    boundary: 'Datacenter boundary',
    summary: 'Power or networking removes one availability zone.',
    icon: Building2,
  },
  region: {
    label: 'Region outage',
    boundary: 'Geographic boundary',
    summary: 'Every zone in the primary region becomes unavailable.',
    icon: Globe2,
  },
  dependency: {
    label: 'Dependency timeout',
    boundary: 'Shared dependency',
    summary: 'A provider accepts calls slowly or not at all.',
    icon: Unplug,
  },
};

const TOPOLOGIES: Record<
  TopologyId,
  { label: string; eyebrow: string; description: string; cost: number; icon: LucideIcon }
> = {
  single: {
    label: 'Single zone',
    eyebrow: 'No standby boundary',
    description: 'One active instance in one zone.',
    cost: 1,
    icon: Boxes,
  },
  'multi-zone': {
    label: 'Multi-zone',
    eyebrow: 'Local redundancy',
    description: 'Replicated capacity across two zones.',
    cost: 1.8,
    icon: Building2,
  },
  'multi-region': {
    label: 'Multi-region',
    eyebrow: 'Geographic redundancy',
    description: 'A tested standby in a second region.',
    cost: 3.2,
    icon: Globe2,
  },
};

function SwitchControl({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-[88px] w-full items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
        checked
          ? 'border-cyan-400 bg-cyan-50 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-50'
          : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className={`mt-1 block text-xs leading-5 ${checked ? 'text-cyan-800 dark:text-cyan-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
          {description}
        </span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-cyan-600 dark:bg-cyan-400' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function ReliabilityAvailabilityResilienceLab() {
  const [failure, setFailure] = useState<FailureId>('zone');
  const [topology, setTopology] = useState<TopologyId>('multi-zone');
  const [containment, setContainment] = useState(true);
  const [automaticRecovery, setAutomaticRecovery] = useState(true);

  const result = useMemo(() => {
    const topologyCoversFailure =
      (failure === 'instance' && topology !== 'single') ||
      (failure === 'zone' && topology !== 'single') ||
      (failure === 'region' && topology === 'multi-region');
    const dependencyContained = failure === 'dependency' && containment;
    const survives = topologyCoversFailure || dependencyContained;

    const coveredImpact: Record<Exclude<FailureId, 'dependency'>, number> = {
      instance: automaticRecovery ? 1 : 15,
      zone: automaticRecovery ? 5 : 35,
      region: automaticRecovery ? 10 : 55,
    };
    const repairTime: Record<FailureId, number> = {
      instance: 35,
      zone: 90,
      region: 240,
      dependency: 45,
    };
    const failoverTime: Record<Exclude<FailureId, 'dependency'>, number> = {
      instance: automaticRecovery ? 1 : 20,
      zone: automaticRecovery ? 4 : 45,
      region: automaticRecovery ? 9 : 120,
    };

    const affectedUsers = dependencyContained
      ? 25
      : topologyCoversFailure
        ? coveredImpact[failure]
        : 100;
    const stabilizeMinutes = dependencyContained
      ? 1
      : topologyCoversFailure
        ? failoverTime[failure]
        : repairTime[failure];
    const costFactor = TOPOLOGIES[topology].cost + (containment ? 0.15 : 0) + (automaticRecovery ? 0.2 : 0);

    let dataRisk = 'No data-specific risk';
    if (failure !== 'dependency') {
      if (topology === 'single') dataRisk = 'Single-copy recovery risk';
      else if (failure === 'region' && topology !== 'multi-region') dataRisk = 'Regional copies unavailable';
      else if (failure === 'region') dataRisk = 'Bounded by replication lag';
      else dataRisk = 'Replica remains available';
    }

    let explanation = 'This failure crosses the only active boundary, so repair is required before service returns.';
    if (topologyCoversFailure) {
      explanation = automaticRecovery
        ? 'A healthy copy exists outside the failed boundary, and automated routing moves traffic to it.'
        : 'A healthy copy exists, but manual promotion leaves users waiting during the handoff.';
    } else if (dependencyContained) {
      explanation = 'Redundant application instances still share the failed provider. Timeouts and a fallback preserve the unaffected paths.';
    } else if (failure === 'dependency') {
      explanation = 'More application copies repeat the same slow call. Without isolation, the shared dependency can exhaust every request pool.';
    } else if (automaticRecovery) {
      explanation = 'Automation cannot fail over without a healthy copy outside the failed boundary.';
    }

    return {
      topologyCoversFailure,
      dependencyContained,
      survives,
      affectedUsers,
      stabilizeMinutes,
      costFactor,
      dataRisk,
      explanation,
    };
  }, [automaticRecovery, containment, failure, topology]);

  const zoneBProvisioned = topology !== 'single';
  const regionBProvisioned = topology === 'multi-region';
  const primaryFailed = failure === 'region';
  const zoneAFailed = failure === 'zone' || primaryFailed;
  const dependencyFailed = failure === 'dependency';

  const reset = () => {
    setFailure('zone');
    setTopology('multi-zone');
    setContainment(true);
    setAutomaticRecovery(true);
  };

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg shadow-neutral-950/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/30">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-300">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Failure boundary lab
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white md:text-2xl">Place redundancy where failure can happen</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Inject a fault, choose a deployment boundary, and see whether traffic has somewhere healthy to go.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="border-b border-neutral-200 p-5 md:p-6 dark:border-neutral-800">
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a failure</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(FAILURES) as FailureId[]).map((id) => {
              const item = FAILURES[id];
              const Icon = item.icon;
              const selected = id === failure;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFailure(id)}
                  className={`min-h-[132px] rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                    selected
                      ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-50'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${selected ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200' : 'bg-white text-neutral-600 shadow-sm dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    {selected ? (
                      <span className="rounded-md border border-rose-300 bg-white/70 px-2 py-1 text-[10px] font-bold uppercase text-rose-800 dark:border-rose-700 dark:bg-black/20 dark:text-rose-200">
                        Injected
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-3 block text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400">{item.boundary}</span>
                  <span className="mt-1 block text-sm font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{FAILURES[failure].summary}</p>
        </fieldset>
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5 border-b border-neutral-200 p-5 md:p-6 xl:border-b-0 xl:border-r dark:border-neutral-800">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose the redundancy boundary</legend>
            <div className="mt-3 space-y-2">
              {(Object.keys(TOPOLOGIES) as TopologyId[]).map((id) => {
                const item = TOPOLOGIES[id];
                const Icon = item.icon;
                const selected = id === topology;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTopology(id)}
                    className={`flex min-h-[92px] w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${selected ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase text-neutral-500 dark:text-neutral-400">{item.eyebrow}</span>
                      <span className="mt-1 block text-sm font-bold">{item.label}</span>
                      <span className={`mt-1 block text-xs ${selected ? 'text-blue-800 dark:text-blue-200' : 'text-neutral-500 dark:text-neutral-400'}`}>{item.description}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-neutral-500 dark:text-neutral-400">{item.cost.toFixed(1)}x</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Add recovery controls</p>
            <div className="mt-3 space-y-2">
              <SwitchControl
                checked={containment}
                label="Failure containment"
                description="Timeout, circuit breaker, and degraded fallback"
                onChange={setContainment}
              />
              <SwitchControl
                checked={automaticRecovery}
                label="Automated failover"
                description="Health checks promote and route to a healthy copy"
                onChange={setAutomaticRecovery}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-neutral-50 p-5 md:p-6 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Survival map</p>
              <h4 className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">Can traffic cross the failed boundary?</h4>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
                result.survives
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
              }`}
            >
              {result.survives ? <BadgeCheck aria-hidden="true" className="h-4 w-4" /> : <AlertOctagon aria-hidden="true" className="h-4 w-4" />}
              {result.survives ? (result.dependencyContained ? 'Degraded path survives' : 'Failover path survives') : 'No healthy path'}
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,0.8fr)] lg:items-stretch">
            <div className={`rounded-lg border p-4 ${primaryFailed ? 'border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50' : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
                  <CloudCog aria-hidden="true" className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                  Primary region
                </span>
                <span className={`text-[10px] font-bold uppercase ${primaryFailed ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {primaryFailed ? 'Offline' : 'Active'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`rounded-md border p-3 ${zoneAFailed ? 'border-rose-300 bg-white text-rose-800 dark:border-rose-800 dark:bg-neutral-950 dark:text-rose-200' : 'border-blue-200 bg-white text-blue-900 dark:border-blue-900 dark:bg-neutral-950 dark:text-blue-100'}`}>
                  {zoneAFailed ? <X aria-hidden="true" className="h-4 w-4" /> : <Check aria-hidden="true" className="h-4 w-4" />}
                  <p className="mt-2 text-xs font-bold">Zone A</p>
                  <p className="mt-1 text-[11px]">{zoneAFailed ? 'Failed' : failure === 'instance' ? 'Instance lost' : 'Serving'}</p>
                </div>
                <div className={`rounded-md border p-3 ${zoneBProvisioned && !primaryFailed ? 'border-emerald-200 bg-white text-emerald-900 dark:border-emerald-900 dark:bg-neutral-950 dark:text-emerald-100' : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'}`}>
                  {zoneBProvisioned && !primaryFailed ? <Check aria-hidden="true" className="h-4 w-4" /> : <CircleOff aria-hidden="true" className="h-4 w-4" />}
                  <p className="mt-2 text-xs font-bold">Zone B</p>
                  <p className="mt-1 text-[11px]">{zoneBProvisioned ? (primaryFailed ? 'Offline' : 'Standby') : 'Not provisioned'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-neutral-400">
              <ArrowDown aria-hidden="true" className="h-5 w-5 lg:-rotate-90" />
            </div>

            <div className={`rounded-lg border p-4 ${regionBProvisioned ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
                  <Globe2 aria-hidden="true" className={`h-4 w-4 ${regionBProvisioned ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-500'}`} />
                  Secondary region
                </span>
              </div>
              <div className={`mt-3 flex min-h-[84px] items-center justify-center rounded-md border border-dashed p-3 text-center ${regionBProvisioned ? 'border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-200' : 'border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'}`}>
                <div>
                  {regionBProvisioned ? <Database aria-hidden="true" className="mx-auto h-5 w-5" /> : <CircleOff aria-hidden="true" className="mx-auto h-5 w-5" />}
                  <p className="mt-2 text-xs font-bold">{regionBProvisioned ? 'Replicated standby' : 'Not provisioned'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-neutral-400">
              <ArrowDown aria-hidden="true" className="h-5 w-5 lg:-rotate-90" />
            </div>

            <div className={`rounded-lg border p-4 ${dependencyFailed ? 'border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50' : 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40'}`}>
              <Network aria-hidden="true" className={`h-5 w-5 ${dependencyFailed ? 'text-rose-700 dark:text-rose-300' : 'text-violet-700 dark:text-violet-300'}`} />
              <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Shared provider</p>
              <p className={`mt-1 text-xs font-semibold ${dependencyFailed ? 'text-rose-700 dark:text-rose-300' : 'text-violet-700 dark:text-violet-300'}`}>
                {dependencyFailed ? (containment ? 'Failed · isolated' : 'Failed · spreading') : 'Healthy'}
              </p>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${result.survives ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50'}`}>
            <div className="flex items-start gap-3">
              {result.survives ? <Workflow aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <AlertOctagon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="font-bold text-neutral-950 dark:text-white">{result.survives ? 'Traffic retains a usable path' : 'The failure exceeds the design boundary'}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Users affected', value: `${result.affectedUsers}%`, icon: Users, tone: result.affectedUsers === 100 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300' },
              { label: 'Time to stabilize', value: `${result.stabilizeMinutes} min`, icon: TimerReset, tone: 'text-blue-700 dark:text-blue-300' },
              { label: 'Data posture', value: result.dataRisk, icon: Database, tone: 'text-violet-700 dark:text-violet-300' },
              { label: 'Illustrative cost', value: `${result.costFactor.toFixed(2)}x`, icon: CloudCog, tone: 'text-amber-700 dark:text-amber-300' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <metric.icon aria-hidden="true" className={`h-5 w-5 ${metric.tone}`} />
                <p className="mt-3 break-words text-sm font-bold leading-5 text-neutral-950 dark:text-white">{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Outcomes are an illustrative teaching model. Real impact depends on capacity headroom, replication lag, health-check thresholds, and tested recovery procedures.
          </p>
        </div>
      </div>
    </section>
  );
}
