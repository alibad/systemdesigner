'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Cpu,
  Gauge,
  HardDrive,
  LockKeyhole,
  Network,
  Router,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scope = 'device' | 'site' | 'cloud';

type Workload = {
  id: string;
  label: string;
  detail: string;
  deadlineMs: number;
  rawMbps: number;
  modelMemoryMb: number;
  minimumTops: number;
  requiredOpset: number;
  baseComputeMs: number;
  requiresLocalFallback: boolean;
  rawDataScope: Scope;
};

type Placement = {
  id: string;
  label: string;
  detail: string;
  scope: Scope;
  pathMultiplier: number;
  fixedLatencyMs: number;
  computeMultiplier: number;
  rawEgressRatio: number;
  survivesSiteLoss: boolean;
  survivesCloudLoss: boolean;
};

type NodeProfile = {
  id: string;
  label: string;
  detail: string;
  scope: Scope;
  memoryMb: number;
  acceleratorTops: number;
  maxOpset: number;
  computeFactor: number;
};

type LinkProfile = {
  id: string;
  label: string;
  detail: string;
  usableMbps: number;
  roundTripMs: number;
  siteAvailable: boolean;
  cloudAvailable: boolean;
};

type PrivacyPolicy = {
  id: string;
  label: string;
  detail: string;
  allowedRawScopes: Scope[];
};

type PlacementModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    workloadId: string;
    placementId: string;
    nodeId: string;
    linkId: string;
    privacyId: string;
  };
  workloads: Workload[];
  placements: Placement[];
  nodes: NodeProfile[];
  links: LinkProfile[];
  privacyPolicies: PrivacyPolicy[];
};

const BLOCK_ID = 'fundamentals/edge-intelligence-orchestration-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/edge-intelligence-orchestration/data/placement-admission-model.json';

const scopeIcon = {
  device: Smartphone,
  site: Router,
  cloud: Cloud,
};

function isPlacementModel(value: unknown): value is PlacementModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<PlacementModel>;

  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && model.modelNote
      && model.defaults?.workloadId
      && model.defaults.placementId
      && model.defaults.nodeId
      && model.defaults.linkId
      && model.defaults.privacyId
      && Array.isArray(model.workloads)
      && model.workloads.length >= 3
      && model.workloads.every((item) => (
        typeof item.deadlineMs === 'number'
        && typeof item.rawMbps === 'number'
        && typeof item.modelMemoryMb === 'number'
        && typeof item.minimumTops === 'number'
      ))
      && Array.isArray(model.placements)
      && model.placements.length === 3
      && Array.isArray(model.nodes)
      && model.nodes.length >= 3
      && Array.isArray(model.links)
      && model.links.length >= 3
      && Array.isArray(model.privacyPolicies)
      && model.privacyPolicies.length >= 2,
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string; detail: string }>;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-950"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected?.detail}
      </span>
    </label>
  );
}

export default function EdgeIntelligenceOrchestrationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PlacementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workloadId, setWorkloadId] = useState('');
  const [placementId, setPlacementId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [linkId, setLinkId] = useState('');
  const [privacyId, setPrivacyId] = useState('');

  function reset(model: PlacementModel) {
    setWorkloadId(model.defaults.workloadId);
    setPlacementId(model.defaults.placementId);
    setNodeId(model.defaults.nodeId);
    setLinkId(model.defaults.linkId);
    setPrivacyId(model.defaults.privacyId);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPlacementModel(payload)) {
          throw new Error('The placement model is incomplete.');
        }
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load placement data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const workload =
      data.workloads.find((candidate) => candidate.id === workloadId)
      ?? data.workloads[0];
    const placement =
      data.placements.find((candidate) => candidate.id === placementId)
      ?? data.placements[0];
    const node =
      data.nodes.find((candidate) => candidate.id === nodeId)
      ?? data.nodes[0];
    const link =
      data.links.find((candidate) => candidate.id === linkId)
      ?? data.links[0];
    const privacy =
      data.privacyPolicies.find((candidate) => candidate.id === privacyId)
      ?? data.privacyPolicies[0];

    const pathLatencyMs =
      placement.fixedLatencyMs + link.roundTripMs * placement.pathMultiplier;
    const computeLatencyMs =
      workload.baseComputeMs * placement.computeMultiplier / node.computeFactor;
    const totalLatencyMs = pathLatencyMs + computeLatencyMs;
    const egressMbps = workload.rawMbps * placement.rawEgressRatio;
    const memoryHeadroomMb = node.memoryMb - workload.modelMemoryMb;
    const memoryHeadroomPercent = memoryHeadroomMb / node.memoryMb * 100;
    const tierReachable =
      placement.scope === 'device'
      || (placement.scope === 'site' && link.siteAvailable)
      || (placement.scope === 'cloud' && link.cloudAvailable);
    const nodeMatchesTier = node.scope === placement.scope;
    const memoryClears = memoryHeadroomPercent >= 20;
    const acceleratorClears = node.acceleratorTops >= workload.minimumTops;
    const runtimeClears = node.maxOpset >= workload.requiredOpset;
    const latencyClears = totalLatencyMs <= workload.deadlineMs;
    const bandwidthClears =
      placement.scope === 'device'
      || egressMbps <= link.usableMbps * 0.7;
    const privacyClears = privacy.allowedRawScopes.includes(placement.scope);
    const fallbackClears =
      !workload.requiresLocalFallback || placement.scope !== 'cloud';
    const admitted =
      tierReachable
      && nodeMatchesTier
      && memoryClears
      && acceleratorClears
      && runtimeClears
      && latencyClears
      && bandwidthClears
      && privacyClears
      && fallbackClears;

    const gates = [
      {
        label: 'Tier reachability',
        clears: tierReachable,
        detail: tierReachable
          ? `${placement.label} remains reachable in this network state.`
          : `${placement.label} is outside the surviving connectivity boundary.`,
      },
      {
        label: 'Hardware placement',
        clears: nodeMatchesTier && memoryClears && acceleratorClears && runtimeClears,
        detail: !nodeMatchesTier
          ? `${node.label} belongs to the ${node.scope} tier, not ${placement.scope}.`
          : !memoryClears
            ? `Only ${Math.max(0, memoryHeadroomMb).toFixed(0)} MB remains after loading the model.`
            : !acceleratorClears
              ? `${node.acceleratorTops} TOPS is below the ${workload.minimumTops} TOPS contract.`
              : !runtimeClears
                ? `Runtime opset ${node.maxOpset} cannot load required opset ${workload.requiredOpset}.`
                : 'Memory, accelerator, and runtime contracts clear.',
      },
      {
        label: 'Latency and bandwidth',
        clears: latencyClears && bandwidthClears,
        detail: !latencyClears
          ? `${totalLatencyMs.toFixed(0)} ms exceeds the ${workload.deadlineMs} ms deadline.`
          : !bandwidthClears
            ? `${egressMbps.toFixed(1)} Mbps exceeds the 70% link budget.`
            : 'The modeled path clears both service budgets.',
      },
      {
        label: 'Privacy boundary',
        clears: privacyClears,
        detail: privacyClears
          ? `Raw input is allowed inside the ${placement.scope} scope.`
          : `${privacy.label} forbids raw input at the ${placement.scope} tier.`,
      },
      {
        label: 'Failure fallback',
        clears: fallbackClears,
        detail: fallbackClears
          ? workload.requiresLocalFallback
            ? 'A device or site-local degraded path can remain in the control contract.'
            : 'This workload does not require an immediate local fallback.'
          : 'Cloud-only inference cannot own a safety action during a partition.',
      },
    ];

    return {
      workload,
      placement,
      node,
      link,
      privacy,
      pathLatencyMs,
      computeLatencyMs,
      totalLatencyMs,
      egressMbps,
      memoryHeadroomMb,
      memoryHeadroomPercent,
      admitted,
      gates,
    };
  }, [data, linkId, nodeId, placementId, privacyId, workloadId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Placement and admission lab"
          title={data?.title ?? 'Place inference where the contract can survive'}
          description={data?.description ?? 'Loading the edge placement model.'}
          icon={BrainCircuit}
          accent="cyan"
          onReset={data ? () => reset(data) : undefined}
        />

        <LearningLabBody
          controls={data ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload contract
                </p>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workload.id === workloadId}
                      label={workload.label}
                      detail={`${workload.deadlineMs} ms deadline - ${workload.detail}`}
                      icon={Activity}
                      accent="cyan"
                      onClick={() => setWorkloadId(workload.id)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution tier
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {data.placements.map((placement) => {
                    const Icon = scopeIcon[placement.scope];
                    const selected = placement.id === placementId;
                    return (
                      <button
                        key={placement.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPlacementId(placement.id)}
                        className={`flex min-h-20 flex-col items-center justify-center rounded-md border px-2 py-3 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                          selected
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:bg-cyan-950/50 dark:text-cyan-50'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                        }`}
                      >
                        <Icon aria-hidden="true" className="mb-2 h-5 w-5" />
                        {placement.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <SelectControl
                label="Hardware profile"
                value={nodeId}
                options={data.nodes}
                onChange={setNodeId}
              />
              <SelectControl
                label="Connectivity"
                value={linkId}
                options={data.links}
                onChange={setLinkId}
              />
              <SelectControl
                label="Privacy policy"
                value={privacyId}
                options={data.privacyPolicies}
                onChange={setPrivacyId}
              />
            </div>
          ) : undefined}
        >
          {error ? (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              <p className="font-semibold">Placement model unavailable</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 rounded-md border border-rose-400 px-3 py-2 font-semibold"
              >
                Retry
              </button>
            </div>
          ) : !view ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-neutral-500">
              Loading placement evidence...
            </div>
          ) : (
            <div className="space-y-6">
              <div
                className={`rounded-md border p-5 ${
                  view.admitted
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                }`}
              >
                <div className="flex items-start gap-3">
                  {view.admitted ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Admission decision
                    </p>
                    <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                      {view.admitted ? 'Placement admitted' : 'Placement rejected'}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {view.admitted
                        ? `${view.workload.label} can run on ${view.node.label} at the ${view.placement.label.toLowerCase()} tier under the selected constraints.`
                        : 'At least one hard contract fails. Change placement, hardware, connectivity, or policy instead of hiding the failure in a score.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="End-to-end latency"
                  value={`${view.totalLatencyMs.toFixed(0)} ms`}
                  detail={`${view.pathLatencyMs.toFixed(0)} ms path + ${view.computeLatencyMs.toFixed(0)} ms compute`}
                  icon={Gauge}
                  tone={view.totalLatencyMs <= view.workload.deadlineMs ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Raw-data egress"
                  value={`${view.egressMbps.toFixed(1)} Mbps`}
                  detail={`${view.link.usableMbps} Mbps usable link`}
                  icon={Network}
                  tone={view.placement.scope === 'device' || view.egressMbps <= view.link.usableMbps * 0.7 ? 'blue' : 'rose'}
                />
                <LabMetric
                  label="Memory headroom"
                  value={`${Math.max(0, view.memoryHeadroomMb).toFixed(0)} MB`}
                  detail={`${view.memoryHeadroomPercent.toFixed(0)}% of the selected node`}
                  icon={HardDrive}
                  tone={view.memoryHeadroomPercent >= 20 ? 'violet' : 'rose'}
                />
                <LabMetric
                  label="Runtime contract"
                  value={`Opset ${view.node.maxOpset}`}
                  detail={`Model requires opset ${view.workload.requiredOpset}`}
                  icon={Cpu}
                  tone={view.node.maxOpset >= view.workload.requiredOpset ? 'cyan' : 'rose'}
                />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Authority and data path
                    </p>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                      The selected tier owns inference. Safety authority never moves to an unavailable remote tier.
                    </p>
                  </div>
                  {view.link.cloudAvailable ? (
                    <Wifi aria-label="Cloud connected" className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <WifiOff aria-label="Cloud disconnected" className="h-5 w-5 shrink-0 text-amber-600" />
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {(['device', 'site', 'cloud'] as const).map((scope) => {
                    const Icon = scopeIcon[scope];
                    const selected = view.placement.scope === scope;
                    const available =
                      scope === 'device'
                      || (scope === 'site' && view.link.siteAvailable)
                      || (scope === 'cloud' && view.link.cloudAvailable);
                    return (
                      <div
                        key={scope}
                        className={`relative min-h-36 rounded-md border p-4 ${
                          selected
                            ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200 dark:bg-cyan-950/35 dark:ring-cyan-950'
                            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Icon aria-hidden="true" className={`h-5 w-5 ${selected ? 'text-cyan-600 dark:text-cyan-400' : 'text-neutral-500'}`} />
                          <span className={`text-xs font-semibold uppercase ${available ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {available ? 'Reachable' : 'Partitioned'}
                          </span>
                        </div>
                        <p className="mt-4 font-semibold capitalize text-neutral-950 dark:text-white">
                          {scope === 'site' ? 'Site edge' : scope}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          {scope === 'device'
                            ? 'Owns sensor capture, immediate safety fallback, and local observations.'
                            : scope === 'site'
                              ? 'Owns local admission, shared accelerator capacity, and site policy.'
                              : 'Owns fleet policy, artifact promotion, and cross-site analysis.'}
                        </p>
                        {selected ? (
                          <span className="absolute bottom-3 right-3 rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white">
                            Inference owner
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
                <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                  <h4 className="font-semibold text-neutral-950 dark:text-white">Hard admission gates</h4>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {view.gates.map((gate) => (
                    <div key={gate.label} className="flex gap-3 px-4 py-3">
                      {gate.clears ? (
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{gate.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                          {gate.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {data?.modelNote}
              </p>
            </div>
          )}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
