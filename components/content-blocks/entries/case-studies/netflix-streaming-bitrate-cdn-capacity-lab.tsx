'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Gauge,
  HardDrive,
  Server,
  Users,
  Video,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeConfig {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface Rendition {
  id: string;
  label: string;
  detail: string;
  mbps: number;
}

interface CapacityData {
  title: string;
  description: string;
  concurrentViewers: RangeConfig;
  segmentDurationSeconds: RangeConfig;
  regionalHitRatePercent: RangeConfig;
  peakFactor: RangeConfig;
  safetyHeadroomPercent: RangeConfig;
  defaultRenditionId: string;
  renditions: Rendition[];
  edgeCapacityGbps: number;
  edgeRequestCapacityRps: number;
  originCapacityGbps: number;
  originRequestCapacityRps: number;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRangeConfig(value: unknown): value is RangeConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeConfig>;
  return (
    isPositiveNumber(candidate.default) &&
    isPositiveNumber(candidate.min) &&
    isPositiveNumber(candidate.max) &&
    isPositiveNumber(candidate.step) &&
    candidate.min <= candidate.default &&
    candidate.default <= candidate.max
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    typeof candidate.title === 'string' &&
      typeof candidate.description === 'string' &&
      isRangeConfig(candidate.concurrentViewers) &&
      isRangeConfig(candidate.segmentDurationSeconds) &&
      isRangeConfig(candidate.regionalHitRatePercent) &&
      isRangeConfig(candidate.peakFactor) &&
      isRangeConfig(candidate.safetyHeadroomPercent) &&
      typeof candidate.defaultRenditionId === 'string' &&
      Array.isArray(candidate.renditions) &&
      candidate.renditions.length >= 2 &&
      candidate.renditions.every(
        (rendition) =>
          rendition &&
          typeof rendition.id === 'string' &&
          typeof rendition.label === 'string' &&
          typeof rendition.detail === 'string' &&
          isPositiveNumber(rendition.mbps),
      ) &&
      candidate.renditions.some((rendition) => rendition.id === candidate.defaultRenditionId) &&
      isPositiveNumber(candidate.edgeCapacityGbps) &&
      isPositiveNumber(candidate.edgeRequestCapacityRps) &&
      isPositiveNumber(candidate.originCapacityGbps) &&
      isPositiveNumber(candidate.originRequestCapacityRps),
  );
}

function formatGbps(value: number) {
  return value < 1 ? `${Math.round(value * 1000)} Mbps` : `${value.toFixed(1)} Gbps`;
}

function formatRps(value: number) {
  return `${Math.round(value).toLocaleString()}/s`;
}

export default function NetflixStreamingBitrateCdnCapacityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewers, setViewers] = useState(150000);
  const [segmentSeconds, setSegmentSeconds] = useState(4);
  const [hitRate, setHitRate] = useState(96);
  const [peakFactor, setPeakFactor] = useState(1.3);
  const [headroom, setHeadroom] = useState(25);
  const [renditionId, setRenditionId] = useState('hd');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Capacity model request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Capacity model data is invalid');
        setData(payload);
        setViewers(payload.concurrentViewers.default);
        setSegmentSeconds(payload.segmentDurationSeconds.default);
        setHitRate(payload.regionalHitRatePercent.default);
        setPeakFactor(payload.peakFactor.default);
        setHeadroom(payload.safetyHeadroomPercent.default);
        setRenditionId(payload.defaultRenditionId);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const rendition = data.renditions.find((item) => item.id === renditionId) ?? data.renditions[0];
    const peakViewers = viewers * peakFactor;
    const edgeGbps = (peakViewers * rendition.mbps) / 1000;
    const segmentRps = peakViewers / segmentSeconds;
    const missShare = (100 - hitRate) / 100;
    const originGbps = edgeGbps * missShare;
    const originRps = segmentRps * missShare;
    const usableShare = 1 - headroom / 100;
    const edgeGbpsBudget = data.edgeCapacityGbps * usableShare;
    const edgeRpsBudget = data.edgeRequestCapacityRps * usableShare;
    const originGbpsBudget = data.originCapacityGbps * usableShare;
    const originRpsBudget = data.originRequestCapacityRps * usableShare;
    const pressures = {
      edgeBytes: edgeGbps / edgeGbpsBudget,
      edgeRequests: segmentRps / edgeRpsBudget,
      originBytes: originGbps / originGbpsBudget,
      originRequests: originRps / originRpsBudget,
    };
    const highestPressure = Math.max(...Object.values(pressures));
    const overloaded = highestPressure > 1;
    const tight = !overloaded && highestPressure >= 0.85;
    const cachePressure = Math.max(pressures.originBytes, pressures.originRequests);

    return {
      rendition,
      peakViewers,
      edgeGbps,
      segmentRps,
      originGbps,
      originRps,
      edgeGbpsBudget,
      edgeRpsBudget,
      originGbpsBudget,
      originRpsBudget,
      pressures,
      cachePressure,
      overloaded,
      tight,
    };
  }, [data, headroom, hitRate, peakFactor, renditionId, segmentSeconds, viewers]);

  if (loadError) {
    return (
      <div role="alert" className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        The bitrate and CDN capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return <div aria-busy="true" className="min-h-[680px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />;
  }

  const reset = () => {
    setViewers(data.concurrentViewers.default);
    setSegmentSeconds(data.segmentDurationSeconds.default);
    setHitRate(data.regionalHitRatePercent.default);
    setPeakFactor(data.peakFactor.default);
    setHeadroom(data.safetyHeadroomPercent.default);
    setRenditionId(data.defaultRenditionId);
  };
  const statusTone = model.overloaded ? 'rose' : model.tight ? 'amber' : 'emerald';
  const verdict = model.overloaded
    ? 'At least one edge or origin budget is overloaded'
    : model.tight
      ? 'The plan fits, but recovery reserve is thin'
      : 'The modeled peak fits with the selected reserve';
  const guidance = model.overloaded
    ? 'Reduce the selected rendition, lower the peak exposure, improve cache residency, or add capacity before this cohort is admitted. Do not compensate with unbounded origin retries.'
    : model.tight
      ? 'Normal traffic fits, but a title-release skew, edge loss, or refill burst can cross the budget. Preserve headroom and rehearse controlled steering.'
      : 'The model keeps byte and request budgets below the planning ceiling. Test a lower hit rate and shorter segments before treating the configuration as resilient.';

  return (
    <div data-content-block="case-studies/netflix-streaming-bitrate-cdn-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Video bitrate and CDN capacity lab"
          title={data.title}
          description={data.description}
          icon={Cloud}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange label="Concurrent viewers" value={viewers} output={viewers.toLocaleString()} min={data.concurrentViewers.min} max={data.concurrentViewers.max} step={data.concurrentViewers.step} lowLabel={data.concurrentViewers.min.toLocaleString()} highLabel={data.concurrentViewers.max.toLocaleString()} onChange={setViewers} />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Selected rendition</legend>
                <div className="mt-3 space-y-2">
                  {data.renditions.map((rendition) => (
                    <LabChoice key={rendition.id} selected={rendition.id === model.rendition.id} label={`${rendition.label} (${rendition.mbps} Mbps)`} detail={rendition.detail} icon={Video} accent="violet" onClick={() => setRenditionId(rendition.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Segment duration" value={segmentSeconds} output={`${segmentSeconds} s`} min={data.segmentDurationSeconds.min} max={data.segmentDurationSeconds.max} step={data.segmentDurationSeconds.step} accent="blue" lowLabel={`${data.segmentDurationSeconds.min} s`} highLabel={`${data.segmentDurationSeconds.max} s`} onChange={setSegmentSeconds} />
              <LabRange label="Regional cache hit rate" value={hitRate} output={`${hitRate}%`} min={data.regionalHitRatePercent.min} max={data.regionalHitRatePercent.max} step={data.regionalHitRatePercent.step} accent="emerald" lowLabel={`${data.regionalHitRatePercent.min}%`} highLabel={`${data.regionalHitRatePercent.max}%`} onChange={setHitRate} />
              <LabRange label="Peak factor" value={peakFactor} output={`${peakFactor.toFixed(1)}x`} min={data.peakFactor.min} max={data.peakFactor.max} step={data.peakFactor.step} accent="amber" lowLabel={`${data.peakFactor.min.toFixed(1)}x`} highLabel={`${data.peakFactor.max.toFixed(1)}x`} onChange={setPeakFactor} />
              <LabRange label="Safety headroom" value={headroom} output={`${headroom}%`} min={data.safetyHeadroomPercent.min} max={data.safetyHeadroomPercent.max} step={data.safetyHeadroomPercent.step} accent="rose" lowLabel={`${data.safetyHeadroomPercent.min}%`} highLabel={`${data.safetyHeadroomPercent.max}%`} onChange={setHeadroom} />
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric label="Peak viewers" value={Math.round(model.peakViewers).toLocaleString()} detail={`${viewers.toLocaleString()} x ${peakFactor.toFixed(1)} peak factor`} icon={Users} tone="blue" />
            <LabMetric label="Edge bandwidth" value={formatGbps(model.edgeGbps)} detail="Media bytes delivered to viewers" icon={Activity} tone={model.pressures.edgeBytes > 1 ? 'rose' : 'cyan'} />
            <LabMetric label="Segment requests" value={formatRps(model.segmentRps)} detail={`${segmentSeconds}-second segments at peak`} icon={Gauge} tone={model.pressures.edgeRequests > 1 ? 'rose' : 'violet'} />
            <LabMetric label="Origin bandwidth" value={formatGbps(model.originGbps)} detail={`${100 - hitRate}% of media bytes miss locally`} icon={Server} tone={model.pressures.originBytes > 1 ? 'rose' : 'amber'} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Edge pressure</p><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">Bytes and segment requests must both fit after headroom.</p></div>
                <output className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{Math.floor(Math.max(model.pressures.edgeBytes, model.pressures.edgeRequests) * 100)}%</output>
              </div>
              <div className="mt-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
                <p className="flex justify-between gap-3"><span>Bandwidth</span><strong className="tabular-nums text-neutral-950 dark:text-white">{formatGbps(model.edgeGbps)} / {formatGbps(model.edgeGbpsBudget)}</strong></p>
                <p className="flex justify-between gap-3"><span>Requests</span><strong className="tabular-nums text-neutral-950 dark:text-white">{formatRps(model.segmentRps)} / {formatRps(model.edgeRpsBudget)}</strong></p>
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Cache-miss pressure</p><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">Only misses reach the origin, but they carry both bytes and request work.</p></div>
                <output className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{Math.round(model.cachePressure * 100)}%</output>
              </div>
              <div className="mt-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-300">
                <p className="flex justify-between gap-3"><span>Origin bandwidth</span><strong className="tabular-nums text-neutral-950 dark:text-white">{formatGbps(model.originGbps)} / {formatGbps(model.originGbpsBudget)}</strong></p>
                <p className="flex justify-between gap-3"><span>Origin requests</span><strong className="tabular-nums text-neutral-950 dark:text-white">{formatRps(model.originRps)} / {formatRps(model.originRpsBudget)}</strong></p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-5 ${model.overloaded ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40' : model.tight ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {model.overloaded || model.tight ? <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.overloaded ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`} /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />}
              <div className="min-w-0"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Overload guidance</p><p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{verdict}</p><p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{guidance}</p></div>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50"><HardDrive aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />The edge must still deliver all {formatGbps(model.edgeGbps)} to viewers. A {hitRate}% cache hit rate limits only the origin share to {formatGbps(model.originGbps)} and {formatRps(model.originRps)}.</div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
