'use client';

import { useEffect, useState } from 'react';
import { Archive, CheckCircle2, CircleDollarSign, Clock3, Copy, Database, Globe2, TriangleAlert } from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FootprintCostModel = {
  assumptions: {
    dailyRawGb: number;
    hotWorkingSetDays: number;
    storagePerTbMonthUsd: number;
    backupPerTbMonthUsd: number;
    regionalBaseMonthlyUsd: number;
    recoveryLinkGbps: number;
    safeRecoveryUtilizationPercent: number;
  };
  copyGuidance: {
    single: string;
    replicated: string;
    multiRegion: string;
    backup: string;
  };
};

const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatBytes(value: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let index = 0;
  let size = Math.max(0, value);
  while (size >= 1000 && index < units.length - 1) {
    size /= 1000;
    index += 1;
  }
  return `${decimal.format(size)} ${units[index]}`;
}

function formatDuration(seconds: number) {
  if (seconds < 3600) return `${decimal.format(seconds / 60)} minutes`;
  if (seconds < 86_400) return `${decimal.format(seconds / 3600)} hours`;
  return `${decimal.format(seconds / 86_400)} days`;
}

export default function DataSizesFootprintCostLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FootprintCostModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [compressionPercent, setCompressionPercent] = useState(45);
  const [indexPercent, setIndexPercent] = useState(35);
  const [replicasPerRegion, setReplicasPerRegion] = useState(2);
  const [backupCopies, setBackupCopies] = useState(1);
  const [regions, setRegions] = useState(1);
  const [retentionDays, setRetentionDays] = useState(90);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The footprint model data file was not provided.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<FootprintCostModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the footprint model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError title="Footprint and cost model unavailable" detail={loadError} />;
  if (!data) return <LabLoading />;

  const rawBytes = data.assumptions.dailyRawGb * 1_000_000_000 * retentionDays;
  const compressedBytes = rawBytes * (1 - compressionPercent / 100);
  const indexedServingBytes = compressedBytes * (1 + indexPercent / 100);
  const servingCopies = replicasPerRegion * regions;
  const durableServingBytes = indexedServingBytes * servingCopies;
  const backupBytes = compressedBytes * backupCopies;
  const durableBytes = durableServingBytes + backupBytes;
  const workingSetBytes = data.assumptions.dailyRawGb * 1_000_000_000 * data.assumptions.hotWorkingSetDays * (1 - compressionPercent / 100) * (1 + indexPercent / 100);
  const storageCost = durableServingBytes / 1_000_000_000_000 * data.assumptions.storagePerTbMonthUsd;
  const backupCost = backupBytes / 1_000_000_000_000 * data.assumptions.backupPerTbMonthUsd;
  const regionalCost = regions * data.assumptions.regionalBaseMonthlyUsd;
  const monthlyCost = storageCost + backupCost + regionalCost;
  const recoveryBytesPerSecond = data.assumptions.recoveryLinkGbps * 1_000_000_000 / 8 * (data.assumptions.safeRecoveryUtilizationPercent / 100);
  const restoreSeconds = backupCopies > 0 ? compressedBytes / recoveryBytesPerSecond : 0;
  const hasBackup = backupCopies > 0;
  const canSurviveRegion = regions > 1;
  const needsRecoveryWarning = !hasBackup || (backupCopies > 0 && restoreSeconds > 86_400);
  const protectionLabel = !hasBackup ? 'No historical recovery copy' : canSurviveRegion ? 'Regional recovery depends on tested promotion' : replicasPerRegion > 1 ? 'Replica availability, one regional boundary' : 'One serving copy, one regional boundary';
  const consequence = !hasBackup
    ? 'No backup copy is modeled. Replication can make a logical deletion or corruption immediately available everywhere.'
    : canSurviveRegion
      ? `${data.copyGuidance.multiRegion} ${data.copyGuidance.backup}`
      : replicasPerRegion > 1
        ? `${data.copyGuidance.replicated} ${data.copyGuidance.backup}`
        : `${data.copyGuidance.single} ${data.copyGuidance.backup}`;

  return (
    <div data-content-block="reference/data-sizes-footprint-cost-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Storage footprint and cost consequence lab"
          title="Choose protection deliberately, then inspect its cost and recovery path"
          description="This model starts with stated daily raw ingest. Adjust compression, index overhead, copies, regions, and retention to expose durable footprint, working set, cost, and recovery consequences."
          icon={CircleDollarSign}
          accent="emerald"
          onReset={() => {
            setCompressionPercent(45);
            setIndexPercent(35);
            setReplicasPerRegion(2);
            setBackupCopies(1);
            setRegions(1);
            setRetentionDays(90);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange label="Compression reduction" value={compressionPercent} output={`${compressionPercent}%`} min={0} max={90} step={5} accent="cyan" lowLabel="none" highLabel="highly compressible" onChange={setCompressionPercent} />
              <LabRange label="Index and metadata overhead" value={indexPercent} output={`${indexPercent}%`} min={0} max={150} step={5} accent="amber" lowLabel="payload only" highLabel="index-heavy" onChange={setIndexPercent} />
              <LabRange label="Serving replicas per region" value={replicasPerRegion} output={`${replicasPerRegion} copies`} min={1} max={4} step={1} accent="blue" lowLabel="one copy" highLabel="four copies" onChange={setReplicasPerRegion} />
              <LabRange label="Independent backup copies" value={backupCopies} output={`${backupCopies} copies`} min={0} max={3} step={1} accent="violet" lowLabel="no backup" highLabel="three copies" onChange={setBackupCopies} />
              <LabRange label="Serving regions" value={regions} output={`${regions} regions`} min={1} max={3} step={1} accent="emerald" lowLabel="one region" highLabel="three regions" onChange={setRegions} />
              <LabRange label="Retention" value={retentionDays} output={`${retentionDays} days`} min={7} max={365} step={7} accent="rose" lowLabel="one week" highLabel="one year" onChange={setRetentionDays} />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Durable footprint" value={formatBytes(durableBytes)} detail={`${servingCopies} serving copies plus ${backupCopies} backup copies.`} icon={Database} tone="emerald" />
            <LabMetric label="One-region working set" value={formatBytes(workingSetBytes)} detail={`${data.assumptions.hotWorkingSetDays} hot days including index overhead.`} icon={Copy} tone="blue" />
            <LabMetric label="Modeled monthly storage" value={money.format(monthlyCost)} detail={`${money.format(storageCost)} serving, ${money.format(backupCost)} backup, ${money.format(regionalCost)} regional base.`} icon={CircleDollarSign} tone="amber" />
            <LabMetric label="Backup restore time" value={hasBackup ? formatDuration(restoreSeconds) : 'No restore path'} detail={hasBackup ? `${data.assumptions.recoveryLinkGbps} Gb/s link at ${data.assumptions.safeRecoveryUtilizationPercent}% safe utilization.` : 'Add an independent backup and time its restore.'} icon={hasBackup ? Clock3 : Archive} tone={needsRecoveryWarning ? 'rose' : 'violet'} />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Footprint math</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              <p><code>raw retained = {data.assumptions.dailyRawGb} GB/day x {retentionDays} days = {formatBytes(rawBytes)}</code></p>
              <p><code>serving data = {formatBytes(rawBytes)} x (1 - {compressionPercent}%) x (1 + {indexPercent}%) = {formatBytes(indexedServingBytes)} per serving copy</code></p>
              <p><code>durable footprint = ({formatBytes(indexedServingBytes)} x {servingCopies} serving copies) + ({formatBytes(compressedBytes)} x {backupCopies} backups) = {formatBytes(durableBytes)}</code></p>
            </div>
          </section>

          <section className={`mt-5 rounded-md border p-5 ${needsRecoveryWarning ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : canSurviveRegion ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}>
            <div className="flex items-start gap-3">
              {needsRecoveryWarning ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">Failure and recovery consequence</p>
                <h4 className="mt-2 text-lg font-semibold">{protectionLabel}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{consequence}</p>
                <p className="mt-3 text-sm font-medium opacity-90">{canSurviveRegion ? <><Globe2 aria-hidden="true" className="mr-1 inline h-4 w-4" />Additional regions add a regional failure boundary, but do not prove failover.</> : <><Copy aria-hidden="true" className="mr-1 inline h-4 w-4" />More replicas improve immediate availability inside the configured region; they do not change the regional boundary.</>}</p>
              </div>
            </div>
          </section>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return <div data-content-block="reference/data-sizes-footprint-cost-lab"><div className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading footprint and cost model" /></div>;
}

function LabError({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block="reference/data-sizes-footprint-cost-lab"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
