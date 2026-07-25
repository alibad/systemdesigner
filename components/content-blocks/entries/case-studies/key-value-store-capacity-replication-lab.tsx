'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  HardDrive,
  Layers3,
  Network,
  Server,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const baselineWritesPerSecond = 1_000_000;
const steadyUtilizationLimit = 0.7;
const rebuildUtilizationLimit = 0.85;
const diskOptions = [4, 8, 16] as const;

function roundUpToZoneMultiple(value: number) {
  return Math.ceil(value / 3) * 3;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatReplicaWrites(value: number) {
  return `${(value / 1_000_000).toFixed(1)}M/s`;
}

export default function KeyValueStoreCapacityReplicationLab() {
  const [logicalDataTb, setLogicalDataTb] = useState(53);
  const [replicationFactor, setReplicationFactor] = useState(3);
  const [nodeCount, setNodeCount] = useState(36);
  const [diskPerNodeTb, setDiskPerNodeTb] = useState<(typeof diskOptions)[number]>(8);

  const model = useMemo(() => {
    const physicalDataTb = logicalDataTb * replicationFactor;
    const rawCapacityTb = nodeCount * diskPerNodeTb;
    const steadyUtilization = physicalDataTb / rawCapacityTb;
    const survivingNodes = nodeCount * (2 / 3);
    const twoZoneRebuildUtilization = physicalDataTb / (survivingNodes * diskPerNodeTb);
    const minimumSteadyNodes = roundUpToZoneMultiple(
      physicalDataTb / (diskPerNodeTb * steadyUtilizationLimit),
    );
    const minimumZoneReadyNodes = roundUpToZoneMultiple(
      physicalDataTb /
        (diskPerNodeTb * rebuildUtilizationLimit * (2 / 3)),
    );
    const replicaWritesPerSecond = baselineWritesPerSecond * replicationFactor;
    const steadyPass = steadyUtilization <= steadyUtilizationLimit;
    const rebuildPass = twoZoneRebuildUtilization <= rebuildUtilizationLimit;
    const placementPass = replicationFactor >= 3;
    const ready = steadyPass && rebuildPass && placementPass;

    let verdict = 'Capacity and three-zone placement clear the planning envelope.';
    let explanation =
      'The fleet stays below 70% in steady state and can temporarily hold the desired replica footprint on two zones below 85% utilization.';

    if (!placementPass) {
      verdict = 'The replica count cannot preserve one copy in every zone.';
      explanation =
        'RF=3 is the minimum for one independent copy in each of three zones. Extra disk capacity cannot replace a missing failure-domain copy.';
    } else if (!steadyPass) {
      verdict = 'The fleet misses its steady-state headroom target.';
      explanation = `Provision at least ${minimumSteadyNodes} of the selected nodes before accounting for compaction, skew, backups, or throughput limits.`;
    } else if (!rebuildPass) {
      verdict = 'A zone loss leaves too little room to rebuild safely.';
      explanation = `Provision at least ${minimumZoneReadyNodes} of the selected nodes to keep the modeled two-zone rebuild at or below 85%.`;
    }

    return {
      physicalDataTb,
      steadyUtilization,
      twoZoneRebuildUtilization,
      minimumSteadyNodes,
      minimumZoneReadyNodes,
      replicaWritesPerSecond,
      steadyPass,
      rebuildPass,
      placementPass,
      ready,
      verdict,
      explanation,
    };
  }, [diskPerNodeTb, logicalDataTb, nodeCount, replicationFactor]);

  const reset = () => {
    setLogicalDataTb(53);
    setReplicationFactor(3);
    setNodeCount(36);
    setDiskPerNodeTb(8);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and replication lab"
        title="Fit replicated data inside normal and zone-loss headroom"
        description="Change the logical dataset, replica count, fleet size, and disk profile. The model keeps storage multiplication, write fan-out, and failure-domain capacity in the same decision."
        icon={Database}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Logical dataset"
              value={logicalDataTb}
              output={`${logicalDataTb} TB`}
              min={20}
              max={100}
              step={1}
              accent="blue"
              lowLabel="20 TB"
              highLabel="100 TB"
              onChange={setLogicalDataTb}
            />
            <LabRange
              label="Replication factor"
              value={replicationFactor}
              output={`RF=${replicationFactor}`}
              min={1}
              max={5}
              step={1}
              accent="violet"
              lowLabel="One copy"
              highLabel="Five copies"
              onChange={setReplicationFactor}
            />
            <LabRange
              label="Storage nodes"
              value={nodeCount}
              output={nodeCount.toLocaleString()}
              min={12}
              max={72}
              step={3}
              accent="emerald"
              lowLabel="12 nodes"
              highLabel="72 nodes"
              onChange={setNodeCount}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Usable disk per node
              </legend>
              <div className="mt-3 space-y-2">
                {diskOptions.map((diskTb) => (
                  <LabChoice
                    key={diskTb}
                    selected={diskPerNodeTb === diskTb}
                    label={`${diskTb} TB data disk`}
                    detail={
                      diskTb === 4
                        ? 'More nodes and smaller failure units.'
                        : diskTb === 8
                          ? 'Balanced baseline for this model.'
                          : 'Fewer nodes, but larger rebuild units.'
                    }
                    icon={HardDrive}
                    accent={diskTb === 8 ? 'violet' : 'blue'}
                    onClick={() => setDiskPerNodeTb(diskTb)}
                  />
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Targets: at most 70% steady utilization, at most 85% while the desired
              replica footprint is rebuilt across two surviving zones, and at least
              one copy in each of three zones.
            </p>
          </div>
        )}
      >
        <div
          className="min-w-0"
          data-content-block="case-studies/key-value-store-capacity-replication-lab"
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Physical footprint"
              value={`${model.physicalDataTb.toLocaleString()} TB`}
              detail={`${logicalDataTb} TB x ${replicationFactor} copies`}
              icon={Layers3}
              tone="violet"
            />
            <LabMetric
              label="Steady utilization"
              value={formatPercent(model.steadyUtilization)}
              detail="70% planning ceiling"
              icon={Server}
              tone={model.steadyPass ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Two-zone rebuild"
              value={formatPercent(model.twoZoneRebuildUtilization)}
              detail="85% temporary ceiling"
              icon={Network}
              tone={model.rebuildPass ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Replica write load"
              value={formatReplicaWrites(model.replicaWritesPerSecond)}
              detail="At 1M logical writes/s"
              icon={Database}
              tone="amber"
            />
          </div>

          <div
            className={`mt-5 rounded-md border p-4 ${
              model.ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {model.ready ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{model.verdict}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{model.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                id: 'steady',
                label: 'Steady headroom',
                pass: model.steadyPass,
                text: `Need at least ${model.minimumSteadyNodes} selected nodes for the 70% target.`,
              },
              {
                id: 'rebuild',
                label: 'Failure headroom',
                pass: model.rebuildPass,
                text: `Need at least ${model.minimumZoneReadyNodes} selected nodes for the modeled two-zone rebuild.`,
              },
              {
                id: 'placement',
                label: 'Three-zone placement',
                pass: model.placementPass,
                text: model.placementPass
                  ? 'At least one replica can be placed in each zone.'
                  : 'RF must reach 3 before all zones hold a copy.',
              },
            ].map((gate) => (
              <div
                key={gate.id}
                className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {gate.pass ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                    />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300"
                    />
                  )}
                  {gate.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                  {gate.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
