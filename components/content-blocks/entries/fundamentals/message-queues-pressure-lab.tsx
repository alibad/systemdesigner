'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Gauge,
  Inbox,
  TimerReset,
  Users,
  Waves,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };

type QueuePressureModel = {
  windowSeconds: number;
  defaults: {
    arrivalRate: number;
    burstMultiplier: number;
    burstSeconds: number;
    workers: number;
    serviceTimeMs: number;
    deadlineSeconds: number;
  };
  bounds: Record<keyof QueuePressureModel['defaults'], Bound>;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 'Will not drain';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} sec`;
  return `${(seconds / 60).toFixed(1)} min`;
}

export default function MessageQueuesPressureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QueuePressureModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [arrivalRate, setArrivalRate] = useState(600);
  const [burstMultiplier, setBurstMultiplier] = useState(2);
  const [burstSeconds, setBurstSeconds] = useState(45);
  const [workers, setWorkers] = useState(8);
  const [serviceTimeMs, setServiceTimeMs] = useState(12);
  const [deadlineSeconds, setDeadlineSeconds] = useState(30);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The queue-pressure model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<QueuePressureModel>;
      })
      .then((model) => {
        setData(model);
        setArrivalRate(model.defaults.arrivalRate);
        setBurstMultiplier(model.defaults.burstMultiplier);
        setBurstSeconds(model.defaults.burstSeconds);
        setWorkers(model.defaults.workers);
        setServiceTimeMs(model.defaults.serviceTimeMs);
        setDeadlineSeconds(model.defaults.deadlineSeconds);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the queue-pressure model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const sampleCount = 12;
    const stepSeconds = data.windowSeconds / sampleCount;
    const capacity = workers * (1000 / serviceTimeMs);
    let backlog = 0;

    return Array.from({ length: sampleCount }, (_, index) => {
      const elapsed = (index + 1) * stepSeconds;
      const ingress = elapsed <= burstSeconds ? arrivalRate * burstMultiplier : arrivalRate;
      backlog = Math.max(0, backlog + (ingress - capacity) * stepSeconds);
      return { elapsed, backlog, ingress };
    });
  }, [arrivalRate, burstMultiplier, burstSeconds, data, serviceTimeMs, workers]);

  if (loadError) {
    return (
      <div data-content-block="fundamentals/message-queues-pressure-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Queue-pressure model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="fundamentals/message-queues-pressure-lab">
        <div className="min-h-[640px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading queue-pressure model" />
      </div>
    );
  }

  const burstIngress = arrivalRate * burstMultiplier;
  const capacity = workers * (1000 / serviceTimeMs);
  const burstGrowth = Math.max(0, burstIngress - capacity);
  const burstBacklog = burstGrowth * burstSeconds;
  const spareAfterBurst = capacity - arrivalRate;
  const drainSeconds = burstBacklog === 0 ? 0 : spareAfterBurst > 0 ? burstBacklog / spareAfterBurst : Number.POSITIVE_INFINITY;
  const oldestAge = capacity > 0 ? burstBacklog / capacity : Number.POSITIVE_INFINITY;
  const deadlineRisk = oldestAge > deadlineSeconds || !Number.isFinite(drainSeconds);
  const burstUtilization = burstIngress / capacity;
  const maxBacklog = Math.max(1, ...timeline.map((point) => point.backlog));
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  const guidance = burstBacklog === 0
    ? 'The workers keep up even during the burst. Preserve headroom for retries, uneven work, deploys, and slow dependencies rather than scaling to exactly 100% utilization.'
    : !Number.isFinite(drainSeconds)
      ? 'The fleet cannot drain after the burst because baseline arrival rate is at least consumer capacity. Improve handler time or add workers before relying on the queue as a buffer.'
      : deadlineRisk
        ? `The queue eventually drains, but the modeled oldest message waits ${formatDuration(oldestAge)}, beyond the ${deadlineSeconds}-second deadline. Add capacity or reduce per-message work.`
        : `The queue absorbs the burst and drains in ${formatDuration(drainSeconds)} after it ends. Alert on age early enough to preserve the ${deadlineSeconds}-second deadline.`;

  return (
    <div data-content-block="fundamentals/message-queues-pressure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Load leveling lab"
          title="Watch a burst become backlog, delay, or headroom"
          description="Change arrival pressure and consumer capacity. The queue can move work through time, but it cannot repair a sustained capacity deficit."
          icon={Waves}
          accent="cyan"
          onReset={() => {
            setArrivalRate(data.defaults.arrivalRate);
            setBurstMultiplier(data.defaults.burstMultiplier);
            setBurstSeconds(data.defaults.burstSeconds);
            setWorkers(data.defaults.workers);
            setServiceTimeMs(data.defaults.serviceTimeMs);
            setDeadlineSeconds(data.defaults.deadlineSeconds);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange label="Baseline arrival" value={arrivalRate} output={`${number.format(arrivalRate)} msg/s`} {...data.bounds.arrivalRate} accent="blue" lowLabel="quiet" highLabel="busy" onChange={setArrivalRate} />
              <LabRange label="Burst multiplier" value={burstMultiplier} output={`${burstMultiplier.toFixed(1)}x`} {...data.bounds.burstMultiplier} accent="violet" lowLabel="steady" highLabel="sharp spike" onChange={setBurstMultiplier} />
              <LabRange label="Burst duration" value={burstSeconds} output={`${burstSeconds} sec`} {...data.bounds.burstSeconds} accent="amber" lowLabel="brief" highLabel="sustained" onChange={setBurstSeconds} />
              <LabRange label="Workers" value={workers} output={`${workers}`} {...data.bounds.workers} accent="emerald" lowLabel="small fleet" highLabel="large fleet" onChange={setWorkers} />
              <LabRange label="Service time" value={serviceTimeMs} output={`${serviceTimeMs} ms`} {...data.bounds.serviceTimeMs} accent="rose" lowLabel="fast handler" highLabel="slow handler" onChange={setServiceTimeMs} />
              <LabRange label="Business deadline" value={deadlineSeconds} output={`${deadlineSeconds} sec`} {...data.bounds.deadlineSeconds} accent="cyan" lowLabel="urgent" highLabel="patient" onChange={setDeadlineSeconds} />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Burst ingress" value={`${number.format(burstIngress)} msg/s`} detail={`${number.format(arrivalRate)} baseline x ${burstMultiplier.toFixed(1)}`} icon={ArrowDownToLine} tone="blue" />
            <LabMetric label="Consumer capacity" value={`${number.format(capacity)} msg/s`} detail={`${workers} workers x ${number.format(1000 / serviceTimeMs)} msg/s`} icon={Users} tone={capacity >= burstIngress ? 'emerald' : 'amber'} />
            <LabMetric label="Peak backlog" value={number.format(burstBacklog)} detail={burstBacklog ? `${number.format(burstGrowth)} messages added each second of burst` : 'No modeled accumulation'} icon={Inbox} tone={burstBacklog ? 'violet' : 'emerald'} />
            <LabMetric label="Oldest wait" value={formatDuration(oldestAge)} detail={`Deadline: ${deadlineSeconds} sec`} icon={Clock3} tone={deadlineRisk ? 'rose' : 'emerald'} />
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Backlog over {data.windowSeconds} seconds</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Each column is a ten-second sample. Violet marks buffered work; rose marks a deadline or non-draining configuration.</p>
            </div>
            <div className="p-4">
              <div className="flex h-44 items-end gap-1 rounded-md border border-neutral-200 bg-[linear-gradient(to_top,transparent_24%,rgba(115,115,115,0.12)_25%,transparent_26%,transparent_49%,rgba(115,115,115,0.12)_50%,transparent_51%,transparent_74%,rgba(115,115,115,0.12)_75%,transparent_76%)] p-3 dark:border-neutral-800" aria-label="Modeled queue backlog timeline">
                {timeline.map((point) => {
                  const height = point.backlog === 0 ? 3 : Math.max(8, (point.backlog / maxBacklog) * 100);
                  return (
                    <div key={point.elapsed} className="flex h-full min-w-0 flex-1 items-end" title={`${Math.round(point.elapsed)} seconds: ${number.format(point.backlog)} queued`}>
                      <div className={`w-full rounded-t-sm ${deadlineRisk ? 'bg-rose-500 dark:bg-rose-400' : 'bg-violet-500 dark:bg-violet-400'}`} style={{ height: `${height}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400"><span>0 sec</span><span>Burst ends at {burstSeconds} sec</span><span>{data.windowSeconds} sec</span></div>
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${deadlineRisk ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : burstBacklog ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`} role="status">
            <div className="flex items-start gap-3">
              {deadlineRisk ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div><p className="text-sm font-semibold">Capacity decision</p><p className="mt-1 text-xs leading-5 opacity-80">{guidance}</p></div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><Gauge aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" /><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{(burstUtilization * 100).toFixed(0)}% burst utilization</p></div>
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><TimerReset aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{formatDuration(drainSeconds)} to drain</p></div>
            <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><Clock3 aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-300" /><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{deadlineSeconds} sec deadline</p></div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
