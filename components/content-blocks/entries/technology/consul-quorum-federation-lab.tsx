'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  CircleX,
  Cloud,
  DatabaseBackup,
  Gauge,
  GitBranch,
  Network,
  RadioTower,
  Server,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
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
  primaryServers: number;
  secondaryServers: number;
  federation: string;
  boundary: string;
};

type ReadMode = {
  id: string;
  label: string;
  detail: string;
  requiresQuorum: boolean;
  availabilityNote: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  failedPrimary: number;
  failedSecondary: number;
  wanAvailable: boolean;
  overloaded: boolean;
  actionWithQuorum: string;
  actionWithoutQuorum: string;
  unsafeAction: string;
  evidence: string[];
};

type QuorumModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    topologyId: string;
    incidentId: string;
    readModeId: string;
  };
  topologies: Topology[];
  readModes: ReadMode[];
  incidents: Incident[];
};

type OutcomeStatus =
  | 'healthy'
  | 'quorum-lost'
  | 'overloaded'
  | 'federation-partitioned';

const BLOCK_ID = 'technology/consul-quorum-federation-lab';

function isQuorumModel(value: unknown): value is QuorumModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QuorumModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && candidate.title
      && candidate.description
      && candidate.defaults?.topologyId
      && candidate.defaults.incidentId
      && candidate.defaults.readModeId
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length > 0
      && Array.isArray(candidate.readModes)
      && candidate.readModes.length > 0
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0,
  );
}

export default function ConsulQuorumFederationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QuorumModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No quorum model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isQuorumModel(payload)) {
          throw new Error('The quorum model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the quorum lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <QuorumWorkbench data={data} />;
}

function QuorumWorkbench({ data }: { data: QuorumModel }) {
  const [topologyId, setTopologyId] = useState(data.defaults.topologyId);
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const [readModeId, setReadModeId] = useState(data.defaults.readModeId);

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const readMode = data.readModes.find((item) => item.id === readModeId) ?? data.readModes[0];

  const outcome = useMemo(() => {
    const failedPrimary = Math.min(incident.failedPrimary, topology.primaryServers);
    const alivePrimary = topology.primaryServers - failedPrimary;
    const primaryQuorum = Math.floor(topology.primaryServers / 2) + 1;
    const primaryHasQuorum = alivePrimary >= primaryQuorum;
    const writeAvailable = primaryHasQuorum && !incident.overloaded;
    const readAvailable =
      alivePrimary > 0
      && (!readMode.requiresQuorum || primaryHasQuorum)
      && !(incident.overloaded && readMode.id !== 'stale');
    const remoteAvailable =
      topology.secondaryServers === 0
      ? null
      : incident.wanAvailable && topology.secondaryServers - incident.failedSecondary > 0;

    const status: OutcomeStatus = !primaryHasQuorum
      ? 'quorum-lost'
      : incident.overloaded
        ? 'overloaded'
        : !incident.wanAvailable && topology.secondaryServers > 0
          ? 'federation-partitioned'
          : 'healthy';

    return {
      alivePrimary,
      primaryQuorum,
      primaryHasQuorum,
      writeAvailable,
      readAvailable,
      remoteAvailable,
      status,
      action: primaryHasQuorum ? incident.actionWithQuorum : incident.actionWithoutQuorum,
    };
  }, [incident, readMode.id, readMode.requiresQuorum, topology]);

  const statusPresentation = {
    healthy: {
      label: 'Control plane available',
      tone: 'emerald' as const,
      icon: CheckCircle2,
      detail: 'The primary datacenter retains quorum and the selected interface can serve its contract.',
    },
    'quorum-lost': {
      label: 'Consensus unavailable',
      tone: 'rose' as const,
      icon: CircleX,
      detail: 'Gossip may still show members, but Raft cannot elect a leader or commit catalog changes.',
    },
    overloaded: {
      label: 'Quorum alive, service degraded',
      tone: 'amber' as const,
      icon: Gauge,
      detail: 'Alive peers are not proof of useful availability when disk, CPU, or request pressure delays the leader path.',
    },
    'federation-partitioned': {
      label: 'Local quorum, remote path down',
      tone: 'amber' as const,
      icon: WifiOff,
      detail: 'Each datacenter can keep local consensus, while cross-datacenter discovery and replication are interrupted.',
    },
  }[outcome.status];

  function reset() {
    setTopologyId(data.defaults.topologyId);
    setIncidentId(data.defaults.incidentId);
    setReadModeId(data.defaults.readModeId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Quorum and federation lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Server topology
                </legend>
                <div className="mt-3 space-y-2">
                  {data.topologies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === topology.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.secondaryServers > 0 ? Cloud : Server}
                      accent="violet"
                      onClick={() => setTopologyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Infrastructure event
                </legend>
                <div className="mt-3 space-y-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'leader-overload' ? Gauge : TriangleAlert}
                      accent="amber"
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Read contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.readModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === readMode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={DatabaseBackup}
                      accent="blue"
                      onClick={() => setReadModeId(item.id)}
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
                label="Primary voters"
                value={`${outcome.alivePrimary} / ${topology.primaryServers}`}
                detail={`Quorum requires ${outcome.primaryQuorum}`}
                icon={Server}
                tone={outcome.primaryHasQuorum ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Catalog writes"
                value={outcome.writeAvailable ? 'Available' : 'Blocked'}
                detail="All writes require the leader and quorum"
                icon={Activity}
                tone={outcome.writeAvailable ? 'emerald' : 'rose'}
              />
              <LabMetric
                label={`${readMode.label}s`}
                value={outcome.readAvailable ? 'Available' : 'Blocked'}
                detail={readMode.requiresQuorum ? 'Leader path required' : 'Follower may answer'}
                icon={DatabaseBackup}
                tone={outcome.readAvailable ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Federation path"
                value={
                  outcome.remoteAvailable === null
                    ? 'Not configured'
                    : outcome.remoteAvailable
                      ? 'Reachable'
                      : 'Partitioned'
                }
                detail={topology.boundary}
                icon={RadioTower}
                tone={
                  outcome.remoteAvailable === null
                    ? 'neutral'
                    : outcome.remoteAvailable
                      ? 'violet'
                      : 'amber'
                }
              />
            </div>

            <ClusterMap
              topology={topology}
              failedPrimary={Math.min(incident.failedPrimary, topology.primaryServers)}
              failedSecondary={Math.min(incident.failedSecondary, topology.secondaryServers)}
              wanAvailable={incident.wanAvailable}
            />

            <section
              className={`rounded-md border p-5 ${
                statusPresentation.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : statusPresentation.tone === 'rose'
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <statusPresentation.icon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Observed boundary
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {statusPresentation.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {statusPresentation.detail}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 xl:grid-cols-2">
              <section className="rounded-md border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                  <h4 className="text-sm font-semibold">Evidence-backed response</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-blue-950 dark:text-blue-100">
                  {outcome.action}
                </p>
                <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 text-blue-950 marker:text-blue-600 dark:text-blue-100 dark:marker:text-blue-300">
                  {incident.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-md border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
                  <AlertOctagon aria-hidden="true" className="h-4 w-4" />
                  <h4 className="text-sm font-semibold">Do not infer this</h4>
                </div>
                <p className="mt-2 text-sm leading-6 text-rose-950 dark:text-rose-100">
                  {incident.unsafeAction}
                </p>
                <p className="mt-3 border-t border-rose-200 pt-3 text-xs leading-5 text-rose-800 dark:border-rose-900 dark:text-rose-200">
                  {readMode.availabilityNote}
                </p>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ClusterMap({
  topology,
  failedPrimary,
  failedSecondary,
  wanAvailable,
}: {
  topology: Topology;
  failedPrimary: number;
  failedSecondary: number;
  wanAvailable: boolean;
}) {
  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center gap-2">
        <Network aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Consensus boundary
          </p>
          <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
            {topology.boundary}
          </h4>
        </div>
      </div>

      <div className={`mt-4 grid gap-3 ${topology.secondaryServers > 0 ? 'md:grid-cols-[1fr_auto_1fr]' : ''}`}>
        <Datacenter
          label="Primary datacenter"
          serverCount={topology.primaryServers}
          failedCount={failedPrimary}
          tone="violet"
        />
        {topology.secondaryServers > 0 ? (
          <>
            <div className="flex min-h-16 items-center justify-center">
              <div
                className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${
                  wanAvailable
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100'
                    : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                }`}
              >
                {wanAvailable ? 'WAN path' : 'WAN partition'}
              </div>
            </div>
            <Datacenter
              label="Secondary datacenter"
              serverCount={topology.secondaryServers}
              failedCount={failedSecondary}
              tone="cyan"
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function Datacenter({
  label,
  serverCount,
  failedCount,
  tone,
}: {
  label: string;
  serverCount: number;
  failedCount: number;
  tone: 'violet' | 'cyan';
}) {
  const healthyClass =
    tone === 'violet'
      ? 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100'
      : 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100';

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: serverCount }, (_, index) => {
          const failed = index >= serverCount - failedCount;
          return (
            <div
              key={`${label}-${index}`}
              className={`flex min-w-20 flex-1 items-center gap-2 rounded-md border px-3 py-3 text-xs font-semibold ${
                failed
                  ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                  : healthyClass
              }`}
            >
              {failed ? (
                <CircleX aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <Server aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              Server {index + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading Consul quorum lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">The Consul quorum lab could not load.</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
