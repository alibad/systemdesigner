'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Database, Gauge, TriangleAlert } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ObjectOption = {
  id: string;
  label: string;
  bytes: number;
  detail: string;
};

type VolumeBandwidthModel = {
  objectOptions: ObjectOption[];
  assumptions: {
    transferLinkGbps: number;
    safeLinkUtilizationPercent: number;
    throughputWarningMbps: number;
    secondsPerDay: number;
  };
};

const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

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

function formatRate(bytesPerSecond: number) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${decimal.format(seconds)} seconds`;
  if (seconds < 3600) return `${decimal.format(seconds / 60)} minutes`;
  if (seconds < 86_400) return `${decimal.format(seconds / 3600)} hours`;
  return `${decimal.format(seconds / 86_400)} days`;
}

export default function DataSizesVolumeBandwidthLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<VolumeBandwidthModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [objectId, setObjectId] = useState('event');
  const [bytesPerItem, setBytesPerItem] = useState(1200);
  const [initialItemsMillions, setInitialItemsMillions] = useState(10);
  const [itemsPerSecond, setItemsPerSecond] = useState(500);
  const [retentionDays, setRetentionDays] = useState(30);
  const [transferWindowMinutes, setTransferWindowMinutes] = useState(60);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The volume model data file was not provided.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<VolumeBandwidthModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the volume model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return <LabError block="reference/data-sizes-volume-bandwidth-lab" title="Volume and bandwidth model unavailable" detail={loadError} />;
  }
  if (!data) {
    return <LabLoading block="reference/data-sizes-volume-bandwidth-lab" label="Loading volume and bandwidth model" />;
  }

  const object = data.objectOptions.find((option) => option.id === objectId) ?? data.objectOptions[0];
  if (!object) {
    return <LabError block="reference/data-sizes-volume-bandwidth-lab" title="Volume and bandwidth model unavailable" detail="The model has no object options." />;
  }

  const initialItems = initialItemsMillions * 1_000_000;
  const arrivingItems = itemsPerSecond * data.assumptions.secondsPerDay * retentionDays;
  const retainedItems = initialItems + arrivingItems;
  const rawBytes = retainedItems * bytesPerItem;
  const ingestBytesPerSecond = itemsPerSecond * bytesPerItem;
  const linkBytesPerSecond = data.assumptions.transferLinkGbps * 1_000_000_000 / 8;
  const safeLinkBytesPerSecond = linkBytesPerSecond * (data.assumptions.safeLinkUtilizationPercent / 100);
  const transferSeconds = rawBytes / safeLinkBytesPerSecond;
  const requiredBytesPerSecond = rawBytes / (transferWindowMinutes * 60);
  const requiredMbps = requiredBytesPerSecond * 8 / 1_000_000;
  const ingestMbps = ingestBytesPerSecond * 8 / 1_000_000;
  const exceedsWindow = requiredBytesPerSecond > safeLinkBytesPerSecond;
  const highIngest = ingestMbps > data.assumptions.throughputWarningMbps;

  return (
    <div data-content-block="reference/data-sizes-volume-bandwidth-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Data volume and bandwidth budget lab"
          title="Make the object, rate, and deadline explicit"
          description="Change the workload inputs to expose retained raw bytes, ingest throughput, scan time on a modeled link, and the transfer rate required by the chosen window."
          icon={Database}
          accent="cyan"
          onReset={() => {
            setObjectId('event');
            setBytesPerItem(1200);
            setInitialItemsMillions(10);
            setItemsPerSecond(500);
            setRetentionDays(30);
            setTransferWindowMinutes(60);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Representative object</legend>
                <div className="mt-3 space-y-2">
                  {data.objectOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === object.id}
                      label={option.label}
                      detail={`${formatBytes(option.bytes)} each. ${option.detail}`}
                      icon={Database}
                      accent={option.id === 'image' ? 'violet' : option.id === 'profile' ? 'blue' : 'cyan'}
                      onClick={() => {
                        setObjectId(option.id);
                        setBytesPerItem(option.bytes);
                      }}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Bytes per item" value={bytesPerItem} output={formatBytes(bytesPerItem)} min={100} max={5_000_000} step={100} accent="cyan" lowLabel="100 B" highLabel="5 MB" onChange={setBytesPerItem} />
              <LabRange label="Initial item count" value={initialItemsMillions} output={`${initialItemsMillions}M items`} min={0} max={100} step={1} accent="blue" lowLabel="empty" highLabel="100 million" onChange={setInitialItemsMillions} />
              <LabRange label="Arrival rate" value={itemsPerSecond} output={`${decimal.format(itemsPerSecond)} items/s`} min={0} max={10_000} step={50} accent="violet" lowLabel="idle" highLabel="10,000 items/s" onChange={setItemsPerSecond} />
              <LabRange label="Retention" value={retentionDays} output={`${retentionDays} days`} min={1} max={365} step={1} accent="emerald" lowLabel="1 day" highLabel="1 year" onChange={setRetentionDays} />
              <LabRange label="Transfer window" value={transferWindowMinutes} output={`${transferWindowMinutes} min`} min={5} max={720} step={5} accent="amber" lowLabel="5 min" highLabel="12 hours" onChange={setTransferWindowMinutes} />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Retained raw size" value={formatBytes(rawBytes)} detail={`${decimal.format(retainedItems)} items over ${retentionDays} days.`} icon={Database} tone="cyan" />
            <LabMetric label="Write throughput" value={formatRate(ingestBytesPerSecond)} detail={`${decimal.format(ingestMbps)} Mb/s before compression.`} icon={Activity} tone={highIngest ? 'amber' : 'blue'} />
            <LabMetric label="Scan on modeled link" value={formatDuration(transferSeconds)} detail={`${data.assumptions.transferLinkGbps} Gb/s link at ${data.assumptions.safeLinkUtilizationPercent}% safe utilization.`} icon={Clock3} tone={exceedsWindow ? 'rose' : 'emerald'} />
            <LabMetric label="Rate for window" value={`${decimal.format(requiredMbps)} Mb/s`} detail={`Needed to move the retained set in ${transferWindowMinutes} minutes.`} icon={Gauge} tone={exceedsWindow ? 'rose' : 'amber'} />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Unit math</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              <p><code>retained items = {decimal.format(initialItems)} initial + ({decimal.format(itemsPerSecond)} items/s x {data.assumptions.secondsPerDay.toLocaleString()} s/day x {retentionDays} days) = {decimal.format(retainedItems)} items</code></p>
              <p><code>raw bytes = {decimal.format(retainedItems)} items x {formatBytes(bytesPerItem)} / item = {formatBytes(rawBytes)}</code></p>
              <p><code>required transfer = {formatBytes(rawBytes)} / ({transferWindowMinutes} min x 60 s/min) = {formatRate(requiredBytesPerSecond)} ({decimal.format(requiredMbps)} Mb/s)</code></p>
            </div>
          </section>

          <section className={`mt-5 rounded-md border p-5 ${exceedsWindow || highIngest ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
            <div className="flex items-start gap-3">
              {exceedsWindow || highIngest ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">Threshold check</p>
                <h4 className="mt-2 text-lg font-semibold">{exceedsWindow ? 'The requested transfer window exceeds the modeled safe link budget' : highIngest ? 'Ingest is above the lab warning threshold' : 'The modeled link and ingest rate are within the selected thresholds'}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{exceedsWindow ? `The window needs ${decimal.format(requiredMbps)} Mb/s, while the safe modeled link budget is ${decimal.format(safeLinkBytesPerSecond * 8 / 1_000_000)} Mb/s. Widen the window, reduce the retained set, or use more measured transfer capacity.` : highIngest ? `${decimal.format(ingestMbps)} Mb/s exceeds the ${data.assumptions.throughputWarningMbps} Mb/s warning. Confirm partitioning, batching, source writes, and downstream durability at peak rate.` : 'Try a larger object, longer retention, tighter deadline, or higher arrival rate to find which dimension becomes the limiting constraint.'}</p>
              </div>
            </div>
          </section>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading({ block, label }: { block: string; label: string }) {
  return <div data-content-block={block}><div className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} /></div>;
}

function LabError({ block, title, detail }: { block: string; title: string; detail: string }) {
  return <div data-content-block={block}><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
