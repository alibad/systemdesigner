'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Layers3,
  Server,
  ShieldCheck,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const logicalWorkingSetTb = 2;
const usableGbPerNode = 48;
const testedOpsPerNode = 45_000;
const originReadLimit = 150_000;
const readFraction = 0.8;
const zoneSurvivalFraction = 2 / 3;
const planningUtilization = 0.8;

const replicaOptions = [1, 2, 3] as const;

function formatQps(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M/s`;
  }
  return `${Math.round(value / 1_000)}K/s`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function roundUpToTen(value: number) {
  return Math.ceil(value / 10) * 10;
}

export default function DistributedCacheCapacityLab() {
  const [peakQps, setPeakQps] = useState(1_500_000);
  const [hitRate, setHitRate] = useState(90);
  const [nodeCount, setNodeCount] = useState(160);
  const [replicationFactor, setReplicationFactor] = useState<(typeof replicaOptions)[number]>(2);

  const model = useMemo(() => {
    const readQps = peakQps * readFraction;
    const writeQps = peakQps * (1 - readFraction);
    const cacheHitQps = readQps * (hitRate / 100);
    const originReadQps = readQps - cacheHitQps;
    const replicationOps = writeQps * (replicationFactor - 1);
    const totalCacheOps = peakQps + replicationOps;
    const physicalWorkingSetTb = logicalWorkingSetTb * replicationFactor;
    const steadyMemoryUtilization =
      (physicalWorkingSetTb * 1_000) / (nodeCount * usableGbPerNode);
    const survivingNodes = Math.max(1, Math.floor(nodeCount * zoneSurvivalFraction));
    const zoneLossThroughputUtilization =
      totalCacheOps / (survivingNodes * testedOpsPerNode);
    const memoryNodesForZoneLoss =
      (physicalWorkingSetTb * 1_000) /
      (usableGbPerNode * planningUtilization * zoneSurvivalFraction);
    const throughputNodesForZoneLoss =
      totalCacheOps /
      (testedOpsPerNode * planningUtilization * zoneSurvivalFraction);
    const recommendedNodes = roundUpToTen(
      Math.max(memoryNodesForZoneLoss, throughputNodesForZoneLoss),
    );

    const originPass = originReadQps <= originReadLimit;
    const memoryPass = steadyMemoryUtilization <= planningUtilization;
    const failoverPass = zoneLossThroughputUtilization <= planningUtilization;
    const replicaPass = replicationFactor >= 2;
    const ready = originPass && memoryPass && failoverPass && replicaPass;

    let verdict = 'The cache protects both latency and the backing store.';
    let explanation =
      'The modeled fleet has replicated ownership, steady memory headroom, zone-loss throughput headroom, and a bounded miss path.';

    if (!replicaPass) {
      verdict = 'One cache copy turns a node loss into an origin surge.';
      explanation =
        'Add an independently placed replica before treating this fleet as highly available. Spare capacity cannot recover a key that has no surviving copy.';
    } else if (!memoryPass) {
      verdict = 'The replicated working set does not fit with steady headroom.';
      explanation = `The selected fleet is above the 80% memory ceiling. This model recommends at least ${recommendedNodes} nodes for the full planning envelope.`;
    } else if (!failoverPass) {
      verdict = 'A zone loss pushes surviving cache nodes past the load target.';
      explanation = `Provision at least ${recommendedNodes} nodes or reduce per-request work before relying on automatic failover.`;
    } else if (!originPass) {
      verdict = 'Miss traffic exceeds the backing store fallback budget.';
      explanation =
        'Improve hit rate, admit fewer fallback reads, pre-warm critical keys, or scale the source of truth before the cache can fail safely.';
    }

    return {
      cacheHitQps,
      originReadQps,
      writeQps,
      replicationOps,
      totalCacheOps,
      physicalWorkingSetTb,
      steadyMemoryUtilization,
      zoneLossThroughputUtilization,
      survivingNodes,
      recommendedNodes,
      originPass,
      memoryPass,
      failoverPass,
      replicaPass,
      ready,
      verdict,
      explanation,
    };
  }, [hitRate, nodeCount, peakQps, replicationFactor]);

  const reset = () => {
    setPeakQps(1_500_000);
    setHitRate(90);
    setNodeCount(160);
    setReplicationFactor(2);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Capacity and fallback lab"
        title="Keep cache pressure and origin pressure inside one envelope"
        description="Change demand, hit rate, fleet size, and replica count. The same configuration must fit the working set, survive a zone loss, and keep misses below the backing store limit."
        icon={Gauge}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <LabRange
              label="Peak operations"
              value={peakQps}
              output={formatQps(peakQps)}
              min={500_000}
              max={3_000_000}
              step={250_000}
              accent="blue"
              lowLabel="500K/s"
              highLabel="3M/s"
              onChange={setPeakQps}
            />
            <LabRange
              label="Read hit rate"
              value={hitRate}
              output={`${hitRate}%`}
              min={70}
              max={98}
              step={1}
              accent="emerald"
              lowLabel="70%"
              highLabel="98%"
              onChange={setHitRate}
            />
            <LabRange
              label="Provisioned nodes"
              value={nodeCount}
              output={nodeCount.toLocaleString()}
              min={60}
              max={260}
              step={10}
              accent="violet"
              lowLabel="60 nodes"
              highLabel="260 nodes"
              onChange={setNodeCount}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Replica copies
              </legend>
              <div className="mt-3 space-y-2">
                {replicaOptions.map((copies) => (
                  <LabChoice
                    key={copies}
                    selected={replicationFactor === copies}
                    label={`${copies} ${copies === 1 ? 'copy' : 'copies'}`}
                    detail={
                      copies === 1
                        ? 'Lowest memory cost; no surviving cache copy.'
                        : copies === 2
                          ? 'Baseline failover with one independent replica.'
                          : 'More read and failure options at higher memory and write cost.'
                    }
                    icon={Layers3}
                    accent={copies === 2 ? 'cyan' : 'violet'}
                    onClick={() => setReplicationFactor(copies)}
                  />
                ))}
              </div>
            </fieldset>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Fixed assumptions: 80/20 reads and writes, a 2 TB logical working set,
              48 GB usable memory and 45K tested operations per node, plus a 150K/s
              backing store read budget.
            </p>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Origin reads"
            value={formatQps(model.originReadQps)}
            detail="Misses after the selected hit rate"
            icon={Database}
            tone={model.originPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Physical cache"
            value={`${model.physicalWorkingSetTb} TB`}
            detail={`${logicalWorkingSetTb} TB x ${replicationFactor} copies`}
            icon={Layers3}
            tone="violet"
          />
          <LabMetric
            label="Steady memory"
            value={formatPercent(model.steadyMemoryUtilization)}
            detail="80% planning ceiling"
            icon={Server}
            tone={model.memoryPass ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Zone-loss load"
            value={formatPercent(model.zoneLossThroughputUtilization)}
            detail={`${model.survivingNodes} nodes remain; 80% ceiling`}
            icon={Activity}
            tone={model.failoverPass ? 'cyan' : 'rose'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
              <p className="text-xs font-semibold uppercase opacity-75">Read demand</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatQps(peakQps * readFraction)}</p>
            </div>
            <span aria-hidden="true" className="hidden text-neutral-400 md:block">-&gt;</span>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
              <p className="text-xs font-semibold uppercase opacity-75">Cache hits</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatQps(model.cacheHitQps)}</p>
            </div>
            <span aria-hidden="true" className="hidden text-neutral-400 md:block">-&gt;</span>
            <div className={`rounded-md border p-3 ${
              model.originPass
                ? 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
            }`}>
              <p className="text-xs font-semibold uppercase opacity-75">Origin misses</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatQps(model.originReadQps)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            Writes add {formatQps(model.writeQps)} of primary work and {formatQps(model.replicationOps)}
            of replica work. The cache tier therefore processes {formatQps(model.totalCacheOps)}
            before repair or migration traffic.
          </p>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.ready
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.ready ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-950 dark:text-white">{model.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.explanation}</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                Modeled full-envelope fleet: {model.recommendedNodes} nodes
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
