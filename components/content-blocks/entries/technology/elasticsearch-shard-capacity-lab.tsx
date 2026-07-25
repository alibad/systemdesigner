'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  Network,
  Server,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
  type LucideIcon,
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

type Workload = {
  id: string;
  label: string;
  detail: string;
  currentPrimaryGb: number;
  dailyGrowthGb: number;
  documentsMillions: number;
  dailyDocumentGrowthMillions: number;
  diskPerNodeGb: number;
  usableDiskPercent: number;
  targetShardMinGb: number;
  targetShardMaxGb: number;
  zones: number;
};

type CapacityModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    planningDays: number;
    primaryShards: number;
    replicas: number;
    dataNodes: number;
  };
  bounds: {
    planningDays: Bound;
    primaryShards: Bound;
    replicas: Bound;
    dataNodes: Bound;
  };
  indexOverheadMultiplier: number;
  workloads: Workload[];
};

type Tone = 'emerald' | 'amber' | 'rose';

const BLOCK_ID = 'technology/elasticsearch-shard-capacity-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isWorkload(value: unknown): value is Workload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workload>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && [
        candidate.currentPrimaryGb,
        candidate.dailyGrowthGb,
        candidate.documentsMillions,
        candidate.dailyDocumentGrowthMillions,
        candidate.diskPerNodeGb,
        candidate.usableDiskPercent,
        candidate.targetShardMinGb,
        candidate.targetShardMaxGb,
        candidate.zones,
      ].every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
}

function isCapacityModel(value: unknown): value is CapacityModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.planningDays === 'number'
      && typeof candidate.defaults.primaryShards === 'number'
      && typeof candidate.defaults.replicas === 'number'
      && typeof candidate.defaults.dataNodes === 'number'
      && isBound(candidate.bounds?.planningDays)
      && isBound(candidate.bounds?.primaryShards)
      && isBound(candidate.bounds?.replicas)
      && isBound(candidate.bounds?.dataNodes)
      && typeof candidate.indexOverheadMultiplier === 'number'
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every(isWorkload),
  );
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

export default function ElasticsearchShardCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No shard-capacity model was supplied.');
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
        if (!isCapacityModel(payload)) throw new Error('The shard-capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the shard lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityModel }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [planningDays, setPlanningDays] = useState(data.defaults.planningDays);
  const [primaryShards, setPrimaryShards] = useState(data.defaults.primaryShards);
  const [replicas, setReplicas] = useState(data.defaults.replicas);
  const [dataNodes, setDataNodes] = useState(data.defaults.dataNodes);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const futurePrimaryGb = workload.currentPrimaryGb + workload.dailyGrowthGb * planningDays;
    const futureDocumentsMillions = workload.documentsMillions
      + workload.dailyDocumentGrowthMillions * planningDays;
    const averageShardGb = futurePrimaryGb / primaryShards;
    const documentsPerShardMillions = futureDocumentsMillions / primaryShards;
    const copiesPerShard = 1 + replicas;
    const totalCopies = primaryShards * copiesPerShard;
    const totalStoredGb = futurePrimaryGb * copiesPerShard * data.indexOverheadMultiplier;
    const averageNodeGb = totalStoredGb / dataNodes;
    const usableNodeGb = workload.diskPerNodeGb * workload.usableDiskPercent / 100;
    const diskHeadroomGb = usableNodeGb - averageNodeGb;
    const diskHeadroomPercent = diskHeadroomGb / usableNodeGb * 100;
    const allocationPossible = copiesPerShard <= dataNodes;
    const diskSafe = diskHeadroomGb >= usableNodeGb * 0.15;
    const shardTooSmall = averageShardGb < workload.targetShardMinGb;
    const shardTooLarge = averageShardGb > workload.targetShardMaxGb;
    const zoneAware = dataNodes >= workload.zones && replicas > 0;

    let tone: Tone = 'emerald';
    let verdict = 'The cluster has a recoverable planning envelope';
    let detail = 'Shard copies fit on distinct nodes, average shard size is in the workload target, and disk keeps recovery headroom.';

    if (!allocationPossible) {
      tone = 'rose';
      verdict = 'The requested copies cannot all be assigned';
      detail = `${copiesPerShard} copies of every shard need at least ${copiesPerShard} eligible nodes, but this plan has ${dataNodes}.`;
    } else if (diskHeadroomGb < 0) {
      tone = 'rose';
      verdict = 'Projected stored bytes exceed usable disk';
      detail = 'Add data nodes, reduce retained primary bytes, or change the copy plan before allocation watermarks block recovery.';
    } else if (!diskSafe) {
      tone = 'rose';
      verdict = 'The arithmetic fits, but recovery headroom does not';
      detail = 'Averages leave less than 15% modeled usable disk for relocation, merge bursts, skew, and failure recovery.';
    } else if (shardTooLarge) {
      tone = 'amber';
      verdict = 'Large shards widen the recovery unit';
      detail = `Average primary shards reach ${formatNumber(averageShardGb, 1)} GB, above this workload's ${workload.targetShardMaxGb} GB planning target. Benchmark more primaries or earlier rollover.`;
    } else if (shardTooSmall) {
      tone = 'amber';
      verdict = 'This plan is oversharded for its data volume';
      detail = `Average primary shards are only ${formatNumber(averageShardGb, 1)} GB. Fewer shards reduce fan-out, metadata, and segment overhead.`;
    } else if (replicas === 0) {
      tone = 'amber';
      verdict = 'Capacity fits, but one node loss can remove a shard';
      detail = 'Add at least one replica and enough eligible nodes when search availability matters.';
    } else if (!zoneAware) {
      tone = 'amber';
      verdict = 'Node copies exist without a full zone-aware layout';
      detail = `This workload expects ${workload.zones} zones. Add eligible nodes and allocation awareness before claiming zone-failure tolerance.`;
    }

    const nodes = Array.from({ length: dataNodes }, (_, index) => {
      const copies = Math.floor(totalCopies / dataNodes) + (index < totalCopies % dataNodes ? 1 : 0);
      const allocatedGb = totalStoredGb * copies / totalCopies;
      return {
        id: index + 1,
        zone: String.fromCharCode(65 + index % workload.zones),
        copies,
        allocatedGb,
        fillPercent: Math.min(100, allocatedGb / usableNodeGb * 100),
      };
    });

    return {
      allocationPossible,
      averageNodeGb,
      averageShardGb,
      copiesPerShard,
      detail,
      diskHeadroomGb,
      diskHeadroomPercent,
      documentsPerShardMillions,
      futurePrimaryGb,
      futureDocumentsMillions,
      nodes,
      tone,
      totalCopies,
      totalStoredGb,
      usableNodeGb,
      verdict,
      zoneAware,
    };
  }, [data.indexOverheadMultiplier, dataNodes, planningDays, primaryShards, replicas, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setPlanningDays(data.defaults.planningDays);
    setPrimaryShards(data.defaults.primaryShards);
    setReplicas(data.defaults.replicas);
    setDataNodes(data.defaults.dataNodes);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Shard placement workbench"
          title={data.title}
          description={data.description}
          icon={Boxes}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Data workload"
                items={data.workloads}
                selectedId={workload.id}
                icon={Database}
                onSelect={setWorkloadId}
              />
              <LabRange
                label="Planning horizon"
                value={planningDays}
                output={`${planningDays} days`}
                {...data.bounds.planningDays}
                accent="amber"
                lowLabel="Near term"
                highLabel="Growth exposed"
                onChange={setPlanningDays}
              />
              <LabRange
                label="Primary shards"
                value={primaryShards}
                output={String(primaryShards)}
                {...data.bounds.primaryShards}
                accent="blue"
                lowLabel="Large recovery units"
                highLabel="More fan-out"
                onChange={setPrimaryShards}
              />
              <LabRange
                label="Replica copies"
                value={replicas}
                output={String(replicas)}
                {...data.bounds.replicas}
                accent="violet"
                lowLabel="No redundancy"
                highLabel="More stored copies"
                onChange={setReplicas}
              />
              <LabRange
                label="Eligible data nodes"
                value={dataNodes}
                output={String(dataNodes)}
                {...data.bounds.dataNodes}
                accent="emerald"
                lowLabel="Concentrated"
                highLabel="Distributed"
                onChange={setDataNodes}
              />
            </div>
          )}
        >
          <div className="min-w-0" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Future primary data"
                value={`${formatNumber(result.futurePrimaryGb)} GB`}
                detail={`${formatNumber(result.futureDocumentsMillions, 1)}M documents at day ${planningDays}`}
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Average primary shard"
                value={`${formatNumber(result.averageShardGb, 1)} GB`}
                detail={`${formatNumber(result.documentsPerShardMillions, 1)}M documents per shard`}
                icon={Boxes}
                tone={result.averageShardGb < workload.targetShardMinGb || result.averageShardGb > workload.targetShardMaxGb ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Physical storage"
                value={`${formatNumber(result.totalStoredGb)} GB`}
                detail={`${result.totalCopies} shard copies including modeled overhead`}
                icon={HardDrive}
                tone={result.diskHeadroomGb < 0 ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Node headroom"
                value={`${formatNumber(result.diskHeadroomPercent)}%`}
                detail={`${formatNumber(result.averageNodeGb)} of ${formatNumber(result.usableNodeGb)} usable GB per node`}
                icon={Gauge}
                tone={result.diskHeadroomPercent >= 25 ? 'emerald' : result.diskHeadroomPercent >= 15 ? 'amber' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : result.tone === 'amber' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                )}
                <div className="min-w-0">
                  <p className="text-base font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Modeled allocation</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Every copy needs a node and recovery space</h4>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusPill
                    icon={Network}
                    label={`${result.copiesPerShard} copies / shard`}
                    ok={result.allocationPossible}
                  />
                  <StatusPill
                    icon={ShieldCheck}
                    label={result.zoneAware ? 'Zone-aware envelope' : 'Zone plan incomplete'}
                    ok={result.zoneAware}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {result.nodes.map((node) => (
                  <div key={node.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                        <Server aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        Node {node.id}
                      </span>
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Zone {node.zone}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${node.fillPercent > 85 ? 'bg-rose-500' : node.fillPercent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${node.fillPercent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{node.copies} shard copies</span>
                      <span>{formatNumber(node.allocatedGb)} GB</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                <TimerReset aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                Even allocation is an estimate. Routing skew, merge bursts, disk watermarks, and a failed node make the real recovery envelope less uniform.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  onSelect,
}: {
  label: string;
  items: Workload[];
  selectedId: string;
  icon: LucideIcon;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={selectedId === item.id}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent="amber"
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function StatusPill({ icon: Icon, label, ok }: { icon: LucideIcon; label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[720px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading Elasticsearch shard capacity lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      role="alert"
      className="min-h-48 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
    >
      <p className="flex items-center gap-2 font-semibold"><CircleAlert aria-hidden="true" className="h-4 w-4" /> Elasticsearch shard lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
