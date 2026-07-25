'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  MapPin,
  MemoryStick,
  Server,
  UsersRound,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type ContainerProfile = {
  id: string;
  label: string;
  detail: string;
  memoryGiB: number;
  vcores: number;
};

type ResourceModel = {
  title: string;
  description: string;
  defaults: {
    nodes: number;
    memoryGiBPerNode: number;
    vcoresPerNode: number;
    reservedMemoryPct: number;
    queueSharePct: number;
    taskCount: number;
    taskMinutes: number;
    localityPct: number;
    profileId: string;
  };
  bounds: {
    nodes: Bound;
    memoryGiBPerNode: Bound;
    vcoresPerNode: Bound;
    queueSharePct: Bound;
    taskCount: Bound;
    localityPct: Bound;
  };
  reservedVcoresPerNode: number;
  remoteReadPenaltyPct: number;
  profiles: ContainerProfile[];
};

const BLOCK_ID = 'technology/yarn-cluster';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isResourceModel(value: unknown): value is ResourceModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ResourceModel>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults
      && Object.values(defaults).every(
        (item) => typeof item === 'string' || isNumber(item),
      )
      && bounds
      && Object.values(bounds).every(isBound)
      && isNumber(candidate.reservedVcoresPerNode)
      && isNumber(candidate.remoteReadPenaltyPct)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2
      && candidate.profiles.every(
        (profile) => profile.id
          && profile.label
          && profile.detail
          && isNumber(profile.memoryGiB)
          && isNumber(profile.vcores),
      ),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function YarnClusterLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<ResourceModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No YARN resource model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isResourceModel(payload)) throw new Error('The YARN resource model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the resource lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ResourceRequestWorkbench model={model} />;
}

function ResourceRequestWorkbench({ model }: { model: ResourceModel }) {
  const [nodes, setNodes] = useState(model.defaults.nodes);
  const [memoryGiBPerNode, setMemoryGiBPerNode] = useState(
    model.defaults.memoryGiBPerNode,
  );
  const [vcoresPerNode, setVcoresPerNode] = useState(model.defaults.vcoresPerNode);
  const [queueSharePct, setQueueSharePct] = useState(model.defaults.queueSharePct);
  const [taskCount, setTaskCount] = useState(model.defaults.taskCount);
  const [localityPct, setLocalityPct] = useState(model.defaults.localityPct);
  const [profileId, setProfileId] = useState(model.defaults.profileId);

  const profile = model.profiles.find((item) => item.id === profileId) ?? model.profiles[0];
  const result = useMemo(() => {
    const usableMemoryGiBPerNode = memoryGiBPerNode
      * (1 - model.defaults.reservedMemoryPct / 100);
    const usableVcoresPerNode = Math.max(
      0,
      vcoresPerNode - model.reservedVcoresPerNode,
    );
    const slotsByMemory = Math.floor(usableMemoryGiBPerNode / profile.memoryGiB);
    const slotsByVcores = Math.floor(usableVcoresPerNode / profile.vcores);
    const slotsPerNode = Math.min(slotsByMemory, slotsByVcores);
    const clusterSlots = slotsPerNode * nodes;
    const queueSlots = clusterSlots > 0
      ? Math.max(1, Math.floor(clusterSlots * queueSharePct / 100))
      : 0;
    const runnableNow = Math.min(taskCount, queueSlots);
    const waitingTasks = Math.max(0, taskCount - runnableNow);
    const waves = queueSlots > 0 ? Math.ceil(taskCount / queueSlots) : 0;
    const remoteFraction = (100 - localityPct) / 100;
    const adjustedTaskMinutes = model.defaults.taskMinutes
      * (1 + remoteFraction * model.remoteReadPenaltyPct / 100);
    const elapsedMinutes = waves * adjustedTaskMinutes;
    const memoryUtilization = usableMemoryGiBPerNode > 0
      ? slotsPerNode * profile.memoryGiB / usableMemoryGiBPerNode * 100
      : 0;
    const vcoreUtilization = usableVcoresPerNode > 0
      ? slotsPerNode * profile.vcores / usableVcoresPerNode * 100
      : 0;
    const bottleneck = slotsByMemory < slotsByVcores
      ? 'memory'
      : slotsByVcores < slotsByMemory
        ? 'vcores'
        : 'balanced';

    return {
      adjustedTaskMinutes,
      bottleneck,
      clusterSlots,
      elapsedMinutes,
      memoryUtilization,
      queueSlots,
      runnableNow,
      slotsByMemory,
      slotsByVcores,
      slotsPerNode,
      usableMemoryGiBPerNode,
      usableVcoresPerNode,
      vcoreUtilization,
      waitingTasks,
      waves,
    };
  }, [
    localityPct,
    memoryGiBPerNode,
    model,
    nodes,
    profile,
    queueSharePct,
    taskCount,
    vcoresPerNode,
  ]);

  const healthy = result.slotsPerNode > 0
    && result.waves <= 4
    && localityPct >= 70;

  function reset() {
    setNodes(model.defaults.nodes);
    setMemoryGiBPerNode(model.defaults.memoryGiBPerNode);
    setVcoresPerNode(model.defaults.vcoresPerNode);
    setQueueSharePct(model.defaults.queueSharePct);
    setTaskCount(model.defaults.taskCount);
    setLocalityPct(model.defaults.localityPct);
    setProfileId(model.defaults.profileId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Resource request and queue lab"
          title={model.title}
          description={model.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <div className="space-y-6">
                <LabRange
                  label="Worker nodes"
                  value={nodes}
                  output={`${nodes}`}
                  {...model.bounds.nodes}
                  lowLabel="Small pool"
                  highLabel="Larger pool"
                  accent="blue"
                  onChange={setNodes}
                />
                <LabRange
                  label="Memory per node"
                  value={memoryGiBPerNode}
                  output={`${memoryGiBPerNode} GiB`}
                  {...model.bounds.memoryGiBPerNode}
                  lowLabel="Memory-light"
                  highLabel="Memory-dense"
                  accent="violet"
                  onChange={setMemoryGiBPerNode}
                />
                <LabRange
                  label="vcores per node"
                  value={vcoresPerNode}
                  output={`${vcoresPerNode}`}
                  {...model.bounds.vcoresPerNode}
                  lowLabel="CPU-light"
                  highLabel="CPU-dense"
                  accent="amber"
                  onChange={setVcoresPerNode}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Container request
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={profile.id === item.id}
                      label={item.label}
                      detail={`${item.memoryGiB} GiB + ${item.vcores} vcore${item.vcores === 1 ? '' : 's'}. ${item.detail}`}
                      icon={Boxes}
                      accent="cyan"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Queue share"
                  value={queueSharePct}
                  output={`${queueSharePct}%`}
                  {...model.bounds.queueSharePct}
                  lowLabel="Constrained queue"
                  highLabel="Large guarantee"
                  accent="emerald"
                  onChange={setQueueSharePct}
                />
                <LabRange
                  label="Pending tasks"
                  value={taskCount}
                  output={compactNumber(taskCount)}
                  {...model.bounds.taskCount}
                  lowLabel="Short job"
                  highLabel="Large stage"
                  accent="rose"
                  onChange={setTaskCount}
                />
                <LabRange
                  label="Node-local tasks"
                  value={localityPct}
                  output={`${localityPct}%`}
                  {...model.bounds.localityPct}
                  lowLabel="Remote reads"
                  highLabel="Data-local"
                  accent="blue"
                  onChange={setLocalityPct}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${healthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {healthy
                  ? <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Modeled scheduling envelope
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.slotsPerNode === 0
                      ? 'This request cannot fit on any worker'
                      : healthy
                        ? 'The queue can clear this stage in a few waves'
                        : 'The request creates queue or locality pressure'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.slotsPerNode === 0
                      ? `A ${profile.memoryGiB} GiB / ${profile.vcores}-vcore container is larger than the usable resource envelope on each node. YARN cannot combine fragments from several nodes into one container.`
                      : `${result.queueSlots} containers fit inside this queue's modeled share. ${compactNumber(result.waitingTasks)} tasks wait after the first allocation, and ${100 - localityPct}% of tasks pay the remote-read planning penalty.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Cluster containers"
                value={compactNumber(result.clusterSlots)}
                detail={`${result.slotsPerNode} per node before queue policy`}
                icon={Server}
                tone="blue"
              />
              <LabMetric
                label="Runnable now"
                value={compactNumber(result.runnableNow)}
                detail={`${compactNumber(result.waitingTasks)} tasks remain pending`}
                icon={UsersRound}
                tone={result.waitingTasks > 0 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Execution waves"
                value={result.waves === 0 ? 'Blocked' : `${result.waves}`}
                detail={`${result.adjustedTaskMinutes.toFixed(1)} min per modeled wave`}
                icon={Activity}
                tone={result.waves > 4 || result.waves === 0 ? 'rose' : 'cyan'}
              />
              <LabMetric
                label="Elapsed estimate"
                value={result.waves === 0 ? 'N/A' : `${result.elapsedMinutes.toFixed(0)} min`}
                detail="Excludes startup, shuffle, skew, and retries"
                icon={Clock3}
                tone={healthy ? 'emerald' : 'violet'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Per-node fit
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.bottleneck === 'balanced'
                      ? 'Memory and vcores bind together'
                      : `${result.bottleneck === 'memory' ? 'Memory' : 'vcores'} limits container count`}
                  </h4>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {result.slotsPerNode} slots
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ResourceBar
                  icon={MemoryStick}
                  label="Memory packed"
                  value={result.memoryUtilization}
                  detail={`${result.slotsByMemory} possible by ${result.usableMemoryGiBPerNode.toFixed(1)} GiB usable memory`}
                  tone="bg-violet-500"
                />
                <ResourceBar
                  icon={Cpu}
                  label="vcores packed"
                  value={result.vcoreUtilization}
                  detail={`${result.slotsByVcores} possible by ${result.usableVcoresPerNode} schedulable vcores`}
                  tone="bg-amber-500"
                />
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-blue-500" />
                  Locality is a preference, not a guarantee
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Waiting briefly for node-local or rack-local placement can avoid network reads.
                  Waiting too long leaves resources idle, so the scheduler relaxes locality.
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Cpu aria-hidden="true" className="h-4 w-4 text-amber-500" />
                  A vcore is a scheduling unit
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Hard CPU isolation depends on NodeManager enforcement such as cgroups.
                  Validate configured vcores against measured CPU use instead of treating them as physical cores.
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ResourceBar({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof MemoryStick;
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </span>
        <span className="tabular-nums">{boundedValue.toFixed(0)}%</span>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(boundedValue)}
      >
        <div className={`h-full ${tone}`} style={{ width: `${boundedValue}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                {error ? 'Resource lab unavailable' : 'Loading resource model'}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                {error ?? 'Calculating the container and queue envelope...'}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:hover:bg-neutral-950"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
