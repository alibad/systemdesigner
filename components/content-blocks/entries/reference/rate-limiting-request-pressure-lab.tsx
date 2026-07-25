'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  ListEnd,
  ShieldAlert,
  TriangleAlert,
  Waves,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OverflowPolicy = 'reject' | 'queue';

type TrafficShape = {
  id: string;
  label: string;
  detail: string;
  multipliers: number[];
};

type PressureModel = {
  durationSeconds: number;
  queueCapacitySeconds: number;
  defaults: {
    baselineRate: number;
    bucketCapacity: number;
    refillRate: number;
    trafficShapeId: string;
    overflowPolicy: OverflowPolicy;
  };
  bounds: {
    baselineRate: { min: number; max: number; step: number };
    bucketCapacity: { min: number; max: number; step: number };
    refillRate: { min: number; max: number; step: number };
  };
  trafficShapes: TrafficShape[];
};

type TimelinePoint = {
  second: number;
  arrivals: number;
  allowed: number;
  rejected: number;
  queued: number;
  tokens: number;
};

const shapeIcons = {
  steady: Activity,
  'launch-spike': Zap,
  'retry-wave': Waves,
} as const;

function simulatePressure({
  data,
  shape,
  baselineRate,
  bucketCapacity,
  refillRate,
  overflowPolicy,
}: {
  data: PressureModel;
  shape: TrafficShape;
  baselineRate: number;
  bucketCapacity: number;
  refillRate: number;
  overflowPolicy: OverflowPolicy;
}) {
  let tokens = bucketCapacity;
  let queued = 0;
  let allowedTotal = 0;
  let rejectedTotal = 0;
  let offeredTotal = 0;
  let peakQueue = 0;
  const queueCapacity = Math.round(refillRate * data.queueCapacitySeconds);
  const timeline: TimelinePoint[] = [];

  shape.multipliers.slice(0, data.durationSeconds).forEach((multiplier, index) => {
    if (index > 0) {
      tokens = Math.min(bucketCapacity, tokens + refillRate);
    }

    const arrivals = Math.round(baselineRate * multiplier);
    const waiting = queued + arrivals;
    const allowed = Math.min(waiting, Math.floor(tokens));
    tokens -= allowed;

    const overflow = waiting - allowed;
    const rejected = overflowPolicy === 'reject' ? overflow : Math.max(0, overflow - queueCapacity);
    queued = overflowPolicy === 'queue' ? Math.min(overflow, queueCapacity) : 0;

    offeredTotal += arrivals;
    allowedTotal += allowed;
    rejectedTotal += rejected;
    peakQueue = Math.max(peakQueue, queued);
    timeline.push({
      second: index + 1,
      arrivals,
      allowed,
      rejected,
      queued,
      tokens: Math.floor(tokens),
    });
  });

  return {
    timeline,
    offeredTotal,
    allowedTotal,
    rejectedTotal,
    queued,
    peakQueue,
    queueCapacity,
    finalTokens: Math.floor(tokens),
    accountedTotal: allowedTotal + rejectedTotal + queued,
    averageOfferedRate: offeredTotal / data.durationSeconds,
    peakQueueWaitSeconds: refillRate > 0 ? peakQueue / refillRate : 0,
  };
}

export default function RateLimitingRequestPressureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PressureModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baselineRate, setBaselineRate] = useState(80);
  const [bucketCapacity, setBucketCapacity] = useState(140);
  const [refillRate, setRefillRate] = useState(70);
  const [trafficShapeId, setTrafficShapeId] = useState('launch-spike');
  const [overflowPolicy, setOverflowPolicy] = useState<OverflowPolicy>('reject');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The request pressure model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<PressureModel>;
      })
      .then((model) => {
        setData(model);
        setBaselineRate(model.defaults.baselineRate);
        setBucketCapacity(model.defaults.bucketCapacity);
        setRefillRate(model.defaults.refillRate);
        setTrafficShapeId(model.defaults.trafficShapeId);
        setOverflowPolicy(model.defaults.overflowPolicy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load the request pressure model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/rate-limiting-request-pressure-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Request pressure model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/rate-limiting-request-pressure-lab">
        <div className="min-h-[520px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading request pressure model" />
      </div>
    );
  }

  const shape = data.trafficShapes.find((item) => item.id === trafficShapeId) ?? data.trafficShapes[0];
  const result = simulatePressure({
    data,
    shape,
    baselineRate,
    bucketCapacity,
    refillRate,
    overflowPolicy,
  });
  const maxVolume = Math.max(
    1,
    ...result.timeline.map((point) => Math.max(point.arrivals, point.allowed + point.rejected)),
  );
  const allowedPercent = (result.allowedTotal / result.offeredTotal) * 100;
  const hasLoss = result.rejectedTotal > 0;
  const hasDelay = result.queued > 0;
  const consequenceTone = hasLoss
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
    : hasDelay
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';

  return (
    <div data-content-block="reference/rate-limiting-request-pressure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Token bucket and overflow model"
          title="Spend burst credit under real request pressure"
          description="Change the baseline rate, saved burst capacity, refill rate, traffic shape, and overflow policy. The model keeps every request accounted for as allowed, rejected, or still queued."
          icon={Gauge}
          accent="cyan"
          onReset={() => {
            setBaselineRate(data.defaults.baselineRate);
            setBucketCapacity(data.defaults.bucketCapacity);
            setRefillRate(data.defaults.refillRate);
            setTrafficShapeId(data.defaults.trafficShapeId);
            setOverflowPolicy(data.defaults.overflowPolicy);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Traffic shape</legend>
                <div className="mt-3 space-y-2">
                  {data.trafficShapes.map((option) => {
                    const Icon = shapeIcons[option.id as keyof typeof shapeIcons] ?? Activity;
                    return (
                      <LabChoice
                        key={option.id}
                        selected={shape.id === option.id}
                        label={option.label}
                        detail={option.detail}
                        icon={Icon}
                        accent={option.id === 'launch-spike' ? 'amber' : option.id === 'retry-wave' ? 'rose' : 'blue'}
                        onClick={() => setTrafficShapeId(option.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <LabRange
                label="Baseline request rate"
                value={baselineRate}
                output={`${baselineRate} req/s`}
                min={data.bounds.baselineRate.min}
                max={data.bounds.baselineRate.max}
                step={data.bounds.baselineRate.step}
                accent="blue"
                lowLabel="light demand"
                highLabel="heavy demand"
                onChange={setBaselineRate}
              />
              <LabRange
                label="Bucket burst capacity"
                value={bucketCapacity}
                output={`${bucketCapacity} tokens`}
                min={data.bounds.bucketCapacity.min}
                max={data.bounds.bucketCapacity.max}
                step={data.bounds.bucketCapacity.step}
                accent="violet"
                lowLabel="small burst"
                highLabel="large saved credit"
                onChange={setBucketCapacity}
              />
              <LabRange
                label="Token refill rate"
                value={refillRate}
                output={`${refillRate} tokens/s`}
                min={data.bounds.refillRate.min}
                max={data.bounds.refillRate.max}
                step={data.bounds.refillRate.step}
                accent="emerald"
                lowLabel="slow recovery"
                highLabel="high sustained rate"
                onChange={setRefillRate}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Overflow handling</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={overflowPolicy === 'reject'}
                    label="Reject immediately"
                    detail="Return excess work to the caller instead of hiding delay in a queue."
                    icon={ShieldAlert}
                    accent="rose"
                    onClick={() => setOverflowPolicy('reject')}
                  />
                  <LabChoice
                    selected={overflowPolicy === 'queue'}
                    label={`Queue up to ${data.queueCapacitySeconds} seconds`}
                    detail="Buffer a bounded amount of work, then reject when the queue is full."
                    icon={ListEnd}
                    accent="amber"
                    onClick={() => setOverflowPolicy('queue')}
                  />
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Offered" value={result.offeredTotal.toLocaleString()} detail={`${result.averageOfferedRate.toFixed(0)} req/s average across the modeled shape`} icon={Waves} tone="blue" />
              <LabMetric label="Allowed" value={result.allowedTotal.toLocaleString()} detail={`${allowedPercent.toFixed(1)}% of offered requests`} icon={CheckCircle2} tone="emerald" />
              <LabMetric label="Rejected" value={result.rejectedTotal.toLocaleString()} detail={overflowPolicy === 'reject' ? 'Immediate 429-style outcomes' : 'Queue capacity exhausted'} icon={ShieldAlert} tone={hasLoss ? 'rose' : 'neutral'} />
              <LabMetric label="Still queued" value={result.queued.toLocaleString()} detail={`Peak ${result.peakQueue.toLocaleString()} of ${result.queueCapacity.toLocaleString()} slots`} icon={Clock3} tone={hasDelay ? 'amber' : 'neutral'} />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800 dark:bg-neutral-900/60">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Twelve-second admission trace</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Green work was served, rose work was rejected, and the amber badge is the queue remaining after each second.</p>
                </div>
                <p className="text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">Final bucket: {result.finalTokens} / {bucketCapacity} tokens</p>
              </header>
              <div className="max-w-full overflow-x-auto p-4">
                <div className="grid min-w-[620px] gap-2" style={{ gridTemplateColumns: `repeat(${result.timeline.length}, minmax(40px, 1fr))` }}>
                  {result.timeline.map((point) => (
                    <div key={point.second} className="grid min-w-0 grid-rows-[24px_180px_20px] gap-2 text-center">
                      <span className="text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">{point.queued > 0 ? `Q ${point.queued}` : ''}</span>
                      <div className="flex h-[180px] flex-col justify-end overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900" title={`Second ${point.second}: ${point.arrivals} arrived, ${point.allowed} allowed, ${point.rejected} rejected, ${point.queued} queued`}>
                        <div className="bg-rose-500 transition-[height] duration-300" style={{ height: `${(point.rejected / maxVolume) * 100}%` }} />
                        <div className="bg-emerald-500 transition-[height] duration-300" style={{ height: `${(point.allowed / maxVolume) * 100}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">{point.second}s</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${consequenceTone}`}>
              <div className="flex items-start gap-3">
                {hasLoss ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : hasDelay ? <Clock3 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Visible consequence</p>
                  <h4 className="mt-2 text-lg font-semibold">
                    {hasLoss ? 'The policy sheds work under this shape' : hasDelay ? 'The queue preserves work by adding delay' : 'Saved tokens and refill absorb the modeled demand'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {hasLoss
                      ? `${result.rejectedTotal.toLocaleString()} requests cannot enter. Increasing burst capacity helps the opening peak, while increasing refill changes the sustained budget.`
                      : hasDelay
                        ? `No request is lost yet, but the peak queue implies about ${result.peakQueueWaitSeconds.toFixed(1)} seconds of drain time at the configured refill rate. A longer queue would hide overload as latency.`
                        : 'The bucket never exhausts and the bounded queue remains empty. Lower the refill or choose a retry wave to challenge the configuration.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Accounting check: {result.offeredTotal.toLocaleString()} offered = {result.allowedTotal.toLocaleString()} allowed + {result.rejectedTotal.toLocaleString()} rejected + {result.queued.toLocaleString()} still queued ({result.accountedTotal.toLocaleString()} total).
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
