'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  Network,
  Radio,
  Server,
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

type TopologyId = 'mesh' | 'sfu' | 'mcu';
type Bound = { min: number; max: number; step: number };
type Topology = {
  id: TopologyId;
  label: string;
  detail: string;
  bestFor: string;
};
type CapacityData = {
  title: string;
  description: string;
  defaults: {
    topologyId: TopologyId;
    participants: number;
    concurrentRooms: number;
    videoMbps: number;
    simulcastLayers: number;
    turnSharePct: number;
  };
  bounds: {
    participants: Bound;
    concurrentRooms: Bound;
    videoMbps: Bound;
    simulcastLayers: Bound;
    turnSharePct: Bound;
  };
  assumptions: {
    protocolOverheadPct: number;
    turnOverheadPct: number;
    visibleRemoteStreams: number;
    mediaNodeEgressGbps: number;
    turnNodeThroughputGbps: number;
    mcuCompositesPerNode: number;
  };
  topologies: Topology[];
};
type Finding = {
  severity: 'healthy' | 'warning' | 'critical' | 'info';
  title: string;
  detail: string;
};

const BLOCK_ID = 'technology/webrtc-performance';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isTopology(value: unknown): value is Topology {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Topology>;
  return Boolean(
    candidate.id
      && ['mesh', 'sfu', 'mcu'].includes(candidate.id)
      && candidate.label
      && candidate.detail
      && candidate.bestFor,
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;
  const assumptions = candidate.assumptions;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.topologyId
      && isNumber(defaults.participants)
      && isNumber(defaults.concurrentRooms)
      && isNumber(defaults.videoMbps)
      && isNumber(defaults.simulcastLayers)
      && isNumber(defaults.turnSharePct)
      && isBound(bounds?.participants)
      && isBound(bounds?.concurrentRooms)
      && isBound(bounds?.videoMbps)
      && isBound(bounds?.simulcastLayers)
      && isBound(bounds?.turnSharePct)
      && isNumber(assumptions?.protocolOverheadPct)
      && isNumber(assumptions?.turnOverheadPct)
      && isNumber(assumptions?.visibleRemoteStreams)
      && isNumber(assumptions?.mediaNodeEgressGbps)
      && isNumber(assumptions?.turnNodeThroughputGbps)
      && isNumber(assumptions?.mcuCompositesPerNode)
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length === 3
      && candidate.topologies.every(isTopology),
  );
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export default function WebRTCPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No conference capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('The conference capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityData }) {
  const [topologyId, setTopologyId] = useState<TopologyId>(data.defaults.topologyId);
  const [participants, setParticipants] = useState(data.defaults.participants);
  const [concurrentRooms, setConcurrentRooms] = useState(data.defaults.concurrentRooms);
  const [videoMbps, setVideoMbps] = useState(data.defaults.videoMbps);
  const [simulcastLayers, setSimulcastLayers] = useState(data.defaults.simulcastLayers);
  const [turnSharePct, setTurnSharePct] = useState(data.defaults.turnSharePct);

  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const result = useMemo(() => {
    const overhead = 1 + data.assumptions.protocolOverheadPct / 100;
    const layerFactor = simulcastLayers === 1 ? 1 : simulcastLayers === 2 ? 1.22 : 1.46;
    const visibleStreams = Math.min(participants - 1, data.assumptions.visibleRemoteStreams);
    const clientUploadMbps = topologyId === 'mesh'
      ? videoMbps * (participants - 1) * overhead
      : topologyId === 'sfu'
        ? videoMbps * layerFactor * overhead
        : videoMbps * overhead;
    const clientDownloadMbps = topologyId === 'mesh'
      ? videoMbps * (participants - 1) * overhead
      : topologyId === 'sfu'
        ? videoMbps * visibleStreams * overhead
        : videoMbps * overhead;
    const serverEgressMbpsPerRoom = topologyId === 'mesh'
      ? 0
      : topologyId === 'sfu'
        ? participants * visibleStreams * videoMbps * overhead
        : participants * videoMbps * overhead;
    const serverEgressGbps = serverEgressMbpsPerRoom * concurrentRooms / 1000;
    const endpointMediaMbps = participants
      * concurrentRooms
      * (clientUploadMbps + clientDownloadMbps);
    const turnGbps = endpointMediaMbps
      * (turnSharePct / 100)
      * (1 + data.assumptions.turnOverheadPct / 100)
      / 1000;
    const peerConnections = topologyId === 'mesh'
      ? concurrentRooms * participants * (participants - 1) / 2
      : concurrentRooms * participants;
    const mediaNodes = topologyId === 'mesh'
      ? 0
      : topologyId === 'mcu'
        ? Math.ceil(concurrentRooms / data.assumptions.mcuCompositesPerNode)
        : Math.ceil(serverEgressGbps / data.assumptions.mediaNodeEgressGbps);
    const turnNodes = turnGbps === 0
      ? 0
      : Math.ceil(turnGbps / data.assumptions.turnNodeThroughputGbps);
    const findings: Finding[] = [];

    if (topologyId === 'mesh' && participants > 6) {
      findings.push({
        severity: 'critical',
        title: 'The room has outgrown a peer mesh',
        detail: `${participants} participants create ${participants * (participants - 1) / 2} peer pairs per room and ${formatNumber(clientUploadMbps)} Mbps of upload per participant.`,
      });
    } else if (topologyId === 'mesh' && participants > 4) {
      findings.push({
        severity: 'warning',
        title: 'Client upload is now the scaling boundary',
        detail: 'A mesh still avoids media servers, but every new participant adds another encoded upload and another receive path for every peer.',
      });
    }

    if (clientUploadMbps > 8) {
      findings.push({
        severity: 'critical',
        title: 'Peak client upload is not a mobile-safe envelope',
        detail: 'Reduce participant fan-out or bitrate. Averages do not protect users on constrained uplinks.',
      });
    } else if (clientUploadMbps > 4) {
      findings.push({
        severity: 'warning',
        title: 'Constrained uplinks need an explicit fallback',
        detail: 'Start lower, adapt quickly, and preserve audio when the video sender cannot hold this rate.',
      });
    }

    if (topologyId === 'sfu' && simulcastLayers === 1 && participants > 4) {
      findings.push({
        severity: 'warning',
        title: 'One published layer limits receiver adaptation',
        detail: 'The SFU can forward one encoding, but it cannot choose a lower spatial layer for thumbnails or constrained receivers without another adaptation mechanism.',
      });
    }

    if (turnSharePct >= 40) {
      findings.push({
        severity: 'warning',
        title: 'Relay demand is a first-class capacity plan',
        detail: `${formatNumber(turnGbps)} Gbps crosses TURN for this concurrency model. Place relay capacity near users and test loss of one relay node or region.`,
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'healthy',
        title: 'The chosen topology fits this planning envelope',
        detail: 'Keep the same arithmetic in load tests and replace each assumption with measured codec, layout, device, and regional traffic data.',
      });
    }

    const hasCritical = findings.some((finding) => finding.severity === 'critical');
    const hasWarning = findings.some((finding) => finding.severity === 'warning');

    return {
      clientDownloadMbps,
      clientUploadMbps,
      findings,
      mediaNodes,
      peerConnections,
      serverEgressGbps,
      status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy',
      turnGbps,
      turnNodes,
      visibleStreams,
    } as const;
  }, [concurrentRooms, data, participants, simulcastLayers, topologyId, turnSharePct, videoMbps]);

  function reset() {
    setTopologyId(data.defaults.topologyId);
    setParticipants(data.defaults.participants);
    setConcurrentRooms(data.defaults.concurrentRooms);
    setVideoMbps(data.defaults.videoMbps);
    setSimulcastLayers(data.defaults.simulcastLayers);
    setTurnSharePct(data.defaults.turnSharePct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Conference capacity lab"
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
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Media topology
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.topologies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === topologyId}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'mesh' ? Network : item.id === 'sfu' ? Radio : Server}
                      accent={item.id === 'mesh' ? 'violet' : item.id === 'sfu' ? 'blue' : 'amber'}
                      onClick={() => setTopologyId(item.id)}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Best fit: {topology.bestFor}.
                </p>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Participants per room"
                  value={participants}
                  output={`${participants} people`}
                  {...data.bounds.participants}
                  lowLabel="One peer pair"
                  highLabel="Large room"
                  accent="violet"
                  onChange={setParticipants}
                />
                <LabRange
                  label="Concurrent rooms"
                  value={concurrentRooms}
                  output={`${concurrentRooms} rooms`}
                  {...data.bounds.concurrentRooms}
                  lowLabel="Pilot"
                  highLabel="Fleet load"
                  accent="blue"
                  onChange={setConcurrentRooms}
                />
                <LabRange
                  label="Target video bitrate"
                  value={videoMbps}
                  output={`${videoMbps.toFixed(1)} Mbps`}
                  {...data.bounds.videoMbps}
                  lowLabel="Constrained"
                  highLabel="High detail"
                  accent="emerald"
                  onChange={setVideoMbps}
                />
                {topologyId === 'sfu' ? (
                  <LabRange
                    label="Published simulcast layers"
                    value={simulcastLayers}
                    output={`${simulcastLayers} ${simulcastLayers === 1 ? 'layer' : 'layers'}`}
                    {...data.bounds.simulcastLayers}
                    lowLabel="One encoding"
                    highLabel="More adaptation"
                    accent="cyan"
                    onChange={setSimulcastLayers}
                  />
                ) : null}
                <LabRange
                  label="Sessions using TURN"
                  value={turnSharePct}
                  output={`${turnSharePct}%`}
                  {...data.bounds.turnSharePct}
                  lowLabel="Mostly direct"
                  highLabel="Relay-heavy"
                  accent="amber"
                  onChange={setTurnSharePct}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Peak client upload"
                value={`${formatNumber(result.clientUploadMbps)} Mbps`}
                detail={`${formatNumber(result.clientDownloadMbps)} Mbps receive at the modeled layout`}
                icon={Users}
                tone={result.clientUploadMbps > 8 ? 'rose' : result.clientUploadMbps > 4 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Media-server egress"
                value={`${formatNumber(result.serverEgressGbps)} Gbps`}
                detail={topologyId === 'mesh' ? 'No media server in this topology' : `${result.mediaNodes} modeled media ${result.mediaNodes === 1 ? 'node' : 'nodes'}`}
                icon={Server}
                tone={topologyId === 'mesh' ? 'neutral' : 'violet'}
              />
              <LabMetric
                label="TURN-carried media"
                value={`${formatNumber(result.turnGbps)} Gbps`}
                detail={`${result.turnNodes} modeled relay ${result.turnNodes === 1 ? 'node' : 'nodes'} at peak`}
                icon={Radio}
                tone={turnSharePct >= 40 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Peer connections"
                value={formatNumber(result.peerConnections, 0)}
                detail="Across all concurrent rooms"
                icon={Network}
                tone={topologyId === 'mesh' && participants > 6 ? 'rose' : 'cyan'}
              />
            </div>

            <MediaPath
              topology={topology}
              clientUploadMbps={result.clientUploadMbps}
              clientDownloadMbps={result.clientDownloadMbps}
              serverEgressGbps={result.serverEgressGbps}
              visibleStreams={result.visibleStreams}
            />

            <div className="grid gap-3 md:grid-cols-2">
              {result.findings.map((finding) => (
                <FindingCard key={finding.title} finding={finding} />
              ))}
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Planning model: {data.assumptions.protocolOverheadPct}% protocol overhead,
              {` ${data.assumptions.mediaNodeEgressGbps} Gbps`} SFU egress per media node,
              and {data.assumptions.turnNodeThroughputGbps} Gbps per TURN node. These are
              explicit assumptions, not WebRTC platform limits.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function MediaPath({
  topology,
  clientUploadMbps,
  clientDownloadMbps,
  serverEgressGbps,
  visibleStreams,
}: {
  topology: Topology;
  clientUploadMbps: number;
  clientDownloadMbps: number;
  serverEgressGbps: number;
  visibleStreams: number;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Modeled media path</p>
          <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{topology.label}</p>
        </div>
        <Layers3 aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="mt-4 grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        <PathNode eyebrow="Publish" title="One participant" detail={`${formatNumber(clientUploadMbps)} Mbps upload`} tone="blue" />
        <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 md:rotate-0" />
        <PathNode
          eyebrow={topology.id === 'mesh' ? 'Fan out on client' : topology.id === 'sfu' ? 'Select layers' : 'Decode + compose'}
          title={topology.label}
          detail={topology.id === 'mesh' ? 'No central media hop' : `${formatNumber(serverEgressGbps)} Gbps fleet egress`}
          tone={topology.id === 'mesh' ? 'violet' : topology.id === 'sfu' ? 'cyan' : 'amber'}
        />
        <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 rotate-90 self-center text-neutral-400 md:rotate-0" />
        <PathNode
          eyebrow="Receive"
          title={topology.id === 'sfu' ? `Up to ${visibleStreams} visible streams` : 'Composed room view'}
          detail={`${formatNumber(clientDownloadMbps)} Mbps download`}
          tone="emerald"
        />
      </div>
    </div>
  );
}

const pathTones = {
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50',
  violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
} as const;

function PathNode({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  tone: keyof typeof pathTones;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${pathTones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase opacity-70">{eyebrow}</p>
      <p className="mt-1 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const styles = finding.severity === 'critical'
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
    : finding.severity === 'warning'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
      : finding.severity === 'healthy'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
        : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50';
  const Icon = finding.severity === 'healthy' ? CheckCircle2 : CircleAlert;

  return (
    <div className={`rounded-md border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{finding.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{finding.detail}</p>
        </div>
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Conference capacity lab"
          title="Loading the media planning model"
          description="The lab keeps every bandwidth and infrastructure assumption visible."
          icon={Gauge}
          accent="blue"
        />
        <LearningLabBody>
          {error ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
              <p className="text-sm font-semibold">The planning model could not load.</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold">
                Retry
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading conference assumptions...</p>
          )}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
