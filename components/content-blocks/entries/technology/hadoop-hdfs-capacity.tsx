'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Database,
  FileStack,
  Gauge,
  HardDrive,
  Network,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ReplicationFactor = 2 | 3 | 4;

const BLOCK_ID = 'technology/hadoop-hdfs-capacity';
const BLOCK_SIZE_MB = 128;
const BYTES_PER_BLOCK_METADATA = 180;
const BYTES_PER_FILE_METADATA = 250;

const replicationOptions: Array<{
  value: ReplicationFactor;
  label: string;
  detail: string;
}> = [
  { value: 2, label: '2 replicas', detail: 'Lower storage cost with less failure margin.' },
  { value: 3, label: '3 replicas', detail: 'Common balance for rack-aware production data.' },
  { value: 4, label: '4 replicas', detail: 'More copies for unusually critical hot data.' },
];

const formatTb = (value: number) => `${value >= 1000 ? `${(value / 1000).toFixed(2)} PB` : `${value.toFixed(0)} TB`}`;
const formatCount = (value: number) => value >= 1_000_000_000
  ? `${(value / 1_000_000_000).toFixed(1)}B`
  : value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value.toLocaleString();

export default function HadoopHdfsCapacityCalculator() {
  const [nodeCount, setNodeCount] = useState(48);
  const [storagePerNodeTb, setStoragePerNodeTb] = useState(48);
  const [replicationFactor, setReplicationFactor] = useState<ReplicationFactor>(3);
  const [averageFileMb, setAverageFileMb] = useState(512);
  const [reservePct, setReservePct] = useState(20);

  const metrics = useMemo(() => {
    const rawTb = nodeCount * storagePerNodeTb;
    const protectedTb = rawTb / replicationFactor;
    const usableTb = protectedTb * (1 - reservePct / 100);
    const usableMb = usableTb * 1024 * 1024;
    const fileCount = usableMb / averageFileMb;
    const blocksPerFile = Math.ceil(averageFileMb / BLOCK_SIZE_MB);
    const logicalBlocks = fileCount * blocksPerFile;
    const physicalBlocks = logicalBlocks * replicationFactor;
    const metadataBytes = logicalBlocks * BYTES_PER_BLOCK_METADATA
      + fileCount * BYTES_PER_FILE_METADATA;
    const metadataGiB = metadataBytes / (1024 ** 3);
    const nodeLossHeadroom = Math.floor((nodeCount * reservePct) / 100);
    const smallFileRisk = averageFileMb < BLOCK_SIZE_MB;
    const namespaceRisk = metadataGiB > 64;

    return {
      blocksPerFile,
      fileCount,
      logicalBlocks,
      metadataGiB,
      nodeLossHeadroom,
      physicalBlocks,
      protectedTb,
      rawTb,
      smallFileRisk,
      namespaceRisk,
      usableTb,
    };
  }, [averageFileMb, nodeCount, replicationFactor, reservePct, storagePerNodeTb]);

  const reset = () => {
    setNodeCount(48);
    setStoragePerNodeTb(48);
    setReplicationFactor(3);
    setAverageFileMb(512);
    setReservePct(20);
  };

  const isHealthy = metrics.nodeLossHeadroom >= replicationFactor
    && !metrics.smallFileRisk
    && !metrics.namespaceRisk;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="HDFS capacity model"
          title="Size storage, replicas, and namespace pressure together"
          description="Change the cluster shape and file profile. The model preserves the distinction between raw disk, replicated capacity, operating reserve, and NameNode metadata."
          icon={Database}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <LabRange
                label="DataNodes"
                value={nodeCount}
                output={nodeCount.toLocaleString()}
                min={6}
                max={300}
                step={6}
                accent="blue"
                lowLabel="Small cluster"
                highLabel="Large fleet"
                onChange={setNodeCount}
              />
              <LabRange
                label="Raw disk per node"
                value={storagePerNodeTb}
                output={`${storagePerNodeTb} TB`}
                min={12}
                max={120}
                step={4}
                accent="cyan"
                lowLabel="Fewer drives"
                highLabel="Dense nodes"
                onChange={setStoragePerNodeTb}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Replication policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {replicationOptions.map((option) => (
                    <LabChoice
                      key={option.value}
                      selected={replicationFactor === option.value}
                      label={option.label}
                      detail={option.detail}
                      icon={ShieldCheck}
                      accent={option.value === 3 ? 'emerald' : 'amber'}
                      onClick={() => setReplicationFactor(option.value)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Average file size"
                value={averageFileMb}
                output={`${averageFileMb} MB`}
                min={16}
                max={2_048}
                step={16}
                accent="violet"
                lowLabel="Small-file pressure"
                highLabel="Streaming files"
                onChange={setAverageFileMb}
              />
              <LabRange
                label="Operating reserve"
                value={reservePct}
                output={`${reservePct}%`}
                min={5}
                max={35}
                step={5}
                accent="emerald"
                lowLabel="Tight headroom"
                highLabel="More recovery room"
                onChange={setReservePct}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${isHealthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {isHealthy ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Capacity verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {isHealthy ? 'Balanced for sequential production workloads' : 'The design carries an avoidable operating risk'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {isHealthy
                      ? `The reserve can absorb about ${metrics.nodeLossHeadroom} full nodes while the namespace remains within the illustrative 64 GiB metadata envelope.`
                      : riskExplanation(metrics)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Raw disk" value={formatTb(metrics.rawTb)} detail="All DataNode storage" icon={HardDrive} tone="blue" />
              <LabMetric label="After replication" value={formatTb(metrics.protectedTb)} detail={`${replicationFactor} physical copies`} icon={Boxes} tone="violet" />
              <LabMetric label="Operating capacity" value={formatTb(metrics.usableTb)} detail={`${reservePct}% held free`} icon={Gauge} tone="emerald" />
              <LabMetric
                label="NameNode metadata"
                value={`${metrics.metadataGiB.toFixed(1)} GiB`}
                detail="Illustrative block and file metadata"
                icon={Network}
                tone={metrics.namespaceRisk ? 'rose' : 'cyan'}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <DetailCard
                icon={FileStack}
                label="Logical files"
                value={formatCount(metrics.fileCount)}
                detail={`${metrics.blocksPerFile} block${metrics.blocksPerFile === 1 ? '' : 's'} per file at ${BLOCK_SIZE_MB} MB`}
              />
              <DetailCard
                icon={Boxes}
                label="Logical blocks"
                value={formatCount(metrics.logicalBlocks)}
                detail={`${formatCount(metrics.physicalBlocks)} physical replicas tracked`}
              />
              <DetailCard
                icon={ShieldCheck}
                label="Reserve headroom"
                value={`${metrics.nodeLossHeadroom} nodes`}
                detail="Capacity only; rack placement and repair bandwidth still matter"
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Model boundary</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                This is a planning model, not a hardware benchmark. Validate drive throughput, rack bandwidth, NameNode heap, erasure-coding policy, ingest bursts, and re-replication time with the real cluster and file distribution.
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function riskExplanation(metrics: {
  metadataGiB: number;
  nodeLossHeadroom: number;
  namespaceRisk: boolean;
  smallFileRisk: boolean;
}) {
  const risks = [
    metrics.smallFileRisk ? 'average files are smaller than one HDFS block, creating namespace pressure' : null,
    metrics.namespaceRisk ? 'the illustrative NameNode metadata footprint exceeds 64 GiB' : null,
    metrics.nodeLossHeadroom < 3 ? 'free capacity cannot comfortably absorb a three-node repair event' : null,
  ].filter((risk): risk is string => Boolean(risk));
  return `Review the design because ${risks.join(', ')}.`;
}

function DetailCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileStack;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
