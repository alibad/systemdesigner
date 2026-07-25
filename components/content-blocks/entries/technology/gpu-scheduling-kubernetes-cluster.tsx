'use client';

import { useState } from 'react';
import { Boxes, Cpu, Gauge, MemoryStick, Server, Users } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type AllocationMode = 'whole' | 'mig' | 'time-slice';

const MODE_DEFAULTS: Record<AllocationMode, number> = {
  whole: 1,
  mig: 7,
  'time-slice': 4,
};

export default function GpuSchedulingKubernetesCluster() {
  const [mode, setMode] = useState<AllocationMode>('whole');
  const [nodeCount, setNodeCount] = useState(4);
  const [gpusPerNode, setGpusPerNode] = useState(8);
  const [unitsPerGpu, setUnitsPerGpu] = useState(1);
  const [replicas, setReplicas] = useState(24);
  const [unitsPerPod, setUnitsPerPod] = useState(1);
  const [memoryPerNodeGiB, setMemoryPerNodeGiB] = useState(512);
  const [memoryPerPodGiB, setMemoryPerPodGiB] = useState(64);

  const reset = () => {
    setMode('whole');
    setNodeCount(4);
    setGpusPerNode(8);
    setUnitsPerGpu(1);
    setReplicas(24);
    setUnitsPerPod(1);
    setMemoryPerNodeGiB(512);
    setMemoryPerPodGiB(64);
  };

  const selectMode = (nextMode: AllocationMode) => {
    setMode(nextMode);
    setUnitsPerGpu(MODE_DEFAULTS[nextMode]);
    setUnitsPerPod(1);
  };

  const physicalGpus = nodeCount * gpusPerNode;
  const unitsPerNode = gpusPerNode * unitsPerGpu;
  const advertisedUnits = physicalGpus * unitsPerGpu;
  const gpuSlotsPerNode = Math.floor(unitsPerNode / unitsPerPod);
  const memorySlotsPerNode = Math.floor(memoryPerNodeGiB / memoryPerPodGiB);
  const podSlotsPerNode = Math.min(gpuSlotsPerNode, memorySlotsPerNode);
  const schedulablePods = podSlotsPerNode * nodeCount;
  const scheduledPods = Math.min(replicas, schedulablePods);
  const pendingPods = replicas - scheduledPods;
  const usedUnits = scheduledPods * unitsPerPod;
  const unusedUnits = advertisedUnits - usedUnits;
  const usedMemoryGiB = scheduledPods * memoryPerPodGiB;
  const totalMemoryGiB = nodeCount * memoryPerNodeGiB;
  const nodeLimit =
    replicas <= schedulablePods
      ? 'Demand satisfied'
      : gpuSlotsPerNode < memorySlotsPerNode
        ? 'GPU units'
        : memorySlotsPerNode < gpuSlotsPerNode
          ? 'Host memory'
          : 'GPU and memory';
  const visibleNodes = Math.min(nodeCount, 6);

  return (
    <div data-content-block="technology/gpu-scheduling-kubernetes-cluster">
      <LearningLab>
        <LearningLabHeader
          eyebrow="GPU placement envelope"
          title="Fit one declared Pod shape onto identical nodes"
          description="The scheduler can place only Pods whose integer accelerator resource and host-memory request both fit one node. Change the advertised resource model and see pending work and stranded units directly."
          icon={Boxes}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Allocation model
                </p>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={mode === 'whole'}
                    label="Whole GPU"
                    detail="One advertised integer resource per physical device."
                    icon={Cpu}
                    accent="blue"
                    onClick={() => selectMode('whole')}
                  />
                  <LabChoice
                    selected={mode === 'mig'}
                    label="MIG profile resources"
                    detail="Model identical hardware-isolated profile instances per GPU."
                    icon={Boxes}
                    accent="emerald"
                    onClick={() => selectMode('mig')}
                  />
                  <LabChoice
                    selected={mode === 'time-slice'}
                    label="Time-sliced replicas"
                    detail="Advertise shared access tokens without memory or fault isolation."
                    icon={Users}
                    accent="amber"
                    onClick={() => selectMode('time-slice')}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <LabRange
                  label="Identical GPU nodes"
                  value={nodeCount}
                  output={`${nodeCount}`}
                  min={1}
                  max={16}
                  step={1}
                  lowLabel="1 node"
                  highLabel="16 nodes"
                  accent="violet"
                  onChange={setNodeCount}
                />
                <LabRange
                  label="Physical GPUs per node"
                  value={gpusPerNode}
                  output={`${gpusPerNode}`}
                  min={1}
                  max={8}
                  step={1}
                  lowLabel="1 GPU"
                  highLabel="8 GPUs"
                  accent="blue"
                  onChange={setGpusPerNode}
                />
                {mode !== 'whole' ? (
                  <LabRange
                    label={mode === 'mig' ? 'Profiles per GPU' : 'Shared replicas per GPU'}
                    value={unitsPerGpu}
                    output={`${unitsPerGpu}`}
                    min={2}
                    max={8}
                    step={1}
                    lowLabel="2 units"
                    highLabel="8 units"
                    accent={mode === 'mig' ? 'emerald' : 'amber'}
                    onChange={setUnitsPerGpu}
                  />
                ) : null}
                <LabRange
                  label="Requested workload replicas"
                  value={replicas}
                  output={`${replicas} Pods`}
                  min={1}
                  max={128}
                  step={1}
                  lowLabel="1 Pod"
                  highLabel="128 Pods"
                  accent="cyan"
                  onChange={setReplicas}
                />
                <LabRange
                  label="Accelerator units per Pod"
                  value={unitsPerPod}
                  output={`${unitsPerPod}`}
                  min={1}
                  max={64}
                  step={1}
                  lowLabel="1 unit"
                  highLabel="64 units"
                  accent="blue"
                  onChange={setUnitsPerPod}
                />
                <LabRange
                  label="Host memory per node"
                  value={memoryPerNodeGiB}
                  output={`${memoryPerNodeGiB} GiB`}
                  min={64}
                  max={1024}
                  step={64}
                  lowLabel="64 GiB"
                  highLabel="1 TiB"
                  accent="violet"
                  onChange={setMemoryPerNodeGiB}
                />
                <LabRange
                  label="Host memory per Pod"
                  value={memoryPerPodGiB}
                  output={`${memoryPerPodGiB} GiB`}
                  min={8}
                  max={512}
                  step={8}
                  lowLabel="8 GiB"
                  highLabel="512 GiB"
                  accent="emerald"
                  onChange={setMemoryPerPodGiB}
                />
              </div>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Physical GPUs"
              value={physicalGpus.toLocaleString()}
              detail={`${nodeCount} nodes x ${gpusPerNode} devices; not a throughput estimate.`}
              icon={Cpu}
              tone="blue"
            />
            <LabMetric
              label="Advertised units"
              value={advertisedUnits.toLocaleString()}
              detail={`${unitsPerGpu} schedulable unit${unitsPerGpu === 1 ? '' : 's'} per physical GPU.`}
              icon={Gauge}
              tone={mode === 'time-slice' ? 'amber' : 'violet'}
            />
            <LabMetric
              label="Scheduled / pending"
              value={`${scheduledPods} / ${pendingPods}`}
              detail={`${podSlotsPerNode} complete Pod slots fit each identical node.`}
              icon={Server}
              tone={pendingPods > 0 ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Binding constraint"
              value={nodeLimit}
              detail={`${gpuSlotsPerNode} GPU-fit vs ${memorySlotsPerNode} memory-fit Pods per node.`}
              icon={MemoryStick}
              tone={pendingPods > 0 ? 'rose' : 'neutral'}
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Packed placement across identical nodes
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Each tile shows scheduled Pods against the per-node fit. Real clusters also filter by labels, taints, affinity, topology, health, and other resources.
                </p>
              </div>
              <p className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
                {unusedUnits} accelerator units and {totalMemoryGiB - usedMemoryGiB} GiB host memory unassigned
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: visibleNodes }, (_, index) => {
                const assigned = Math.min(
                  podSlotsPerNode,
                  Math.max(0, scheduledPods - index * podSlotsPerNode)
                );
                const fill = podSlotsPerNode > 0 ? (assigned / podSlotsPerNode) * 100 : 0;
                return (
                  <div
                    key={index}
                    className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950"
                    aria-label={`Node ${index + 1}: ${assigned} of ${podSlotsPerNode} Pod slots assigned`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                      <span>Node {index + 1}</span>
                      <span className="tabular-nums">{assigned}/{podSlotsPerNode}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-[width] duration-300 dark:bg-violet-400"
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {nodeCount > visibleNodes ? (
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Plus {nodeCount - visibleNodes} additional identical nodes included in the arithmetic.
              </p>
            ) : null}
          </div>

          <div
            className={`mt-5 border-l-4 px-4 py-3 text-sm leading-6 ${
              pendingPods > 0
                ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100'
                : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100'
            }`}
          >
            {pendingPods > 0
              ? `${pendingPods} Pods remain pending in this simplified fit because ${nodeLimit.toLowerCase()} reaches its per-node limit first. Adding aggregate capacity does not help when one Pod cannot fit any single eligible node.`
              : mode === 'time-slice'
                ? 'All Pods receive advertised shared-access tokens, but the count does not reserve proportional compute, device memory, or fault isolation. Measure contention with the actual workload.'
                : 'The declared Pod shape fits. This proves resource feasibility for identical eligible nodes, not runtime health, throughput, topology quality, or successful driver initialization.'}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
