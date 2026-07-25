'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cloud,
  Gauge,
  HardDrive,
  Network,
  PlayCircle,
  ShieldAlert,
  Tv,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'practice/video-streaming-capacity-lab';
const DEFAULT_DATA_FILE = '/api/content/practice/video-streaming/data/capacity-scenarios.json';

type Bounds = { min: number; max: number; step: number };
type Scenario = {
  id: string;
  label: string;
  detail: string;
  viewerMultiplier: number;
  cachePenaltyPoints: number;
};
type CapacityData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    concurrentViewers: number;
    averageBitrateMbps: number;
    segmentDurationSeconds: number;
    byteCacheHitPercent: number;
  };
  bounds: {
    concurrentViewers: Bounds;
    averageBitrateMbps: Bounds;
    segmentDurationSeconds: Bounds;
    byteCacheHitPercent: Bounds;
  };
  originSafeTbps: number;
  scenarios: Scenario[];
};

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bounds>;
  return typeof item.min === 'number' && typeof item.max === 'number' && typeof item.step === 'number';
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CapacityData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.scenarioId === 'string'
      && typeof data.defaults.concurrentViewers === 'number'
      && typeof data.defaults.averageBitrateMbps === 'number'
      && typeof data.defaults.segmentDurationSeconds === 'number'
      && typeof data.defaults.byteCacheHitPercent === 'number'
      && isBounds(data.bounds?.concurrentViewers)
      && isBounds(data.bounds.averageBitrateMbps)
      && isBounds(data.bounds.segmentDurationSeconds)
      && isBounds(data.bounds.byteCacheHitPercent)
      && typeof data.originSafeTbps === 'number'
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.viewerMultiplier === 'number'
        && typeof scenario.cachePenaltyPoints === 'number'
      )),
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatViewers(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`;
}

function formatRequests(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M/s` : `${Math.round(value / 1000)}K/s`;
}

export default function VideoStreamingCapacityLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load capacity scenarios (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isCapacityData(value)) throw new Error('The capacity data does not match the expected contract.');
        setData(value);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load capacity scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <CapacityWorkbench data={data} />;
}

function CapacityWorkbench({ data }: { data: CapacityData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [concurrentViewers, setConcurrentViewers] = useState(data.defaults.concurrentViewers);
  const [averageBitrateMbps, setAverageBitrateMbps] = useState(data.defaults.averageBitrateMbps);
  const [segmentDurationSeconds, setSegmentDurationSeconds] = useState(data.defaults.segmentDurationSeconds);
  const [byteCacheHitPercent, setByteCacheHitPercent] = useState(data.defaults.byteCacheHitPercent);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const result = useMemo(() => {
    const effectiveViewers = Math.round(concurrentViewers * scenario.viewerMultiplier);
    const effectiveHitPercent = clamp(byteCacheHitPercent - scenario.cachePenaltyPoints, 0, 100);
    const edgeTbps = effectiveViewers * averageBitrateMbps / 1_000_000;
    const segmentRequestsPerSecond = effectiveViewers / segmentDurationSeconds;
    const originTbps = edgeTbps * (1 - effectiveHitPercent / 100);
    const originUtilizationPercent = originTbps / data.originSafeTbps * 100;
    const originSafe = originUtilizationPercent <= 100;
    const shieldedTbps = edgeTbps - originTbps;
    return {
      edgeTbps,
      effectiveHitPercent,
      effectiveViewers,
      originSafe,
      originTbps,
      originUtilizationPercent,
      segmentRequestsPerSecond,
      shieldedTbps,
    };
  }, [averageBitrateMbps, byteCacheHitPercent, concurrentViewers, data.originSafeTbps, scenario, segmentDurationSeconds]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setConcurrentViewers(data.defaults.concurrentViewers);
    setAverageBitrateMbps(data.defaults.averageBitrateMbps);
    setSegmentDurationSeconds(data.defaults.segmentDurationSeconds);
    setByteCacheHitPercent(data.defaults.byteCacheHitPercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Playback capacity lab" title={data.title} description={data.description} icon={Tv} accent="blue" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Traffic shape</legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice key={item.id} selected={scenario.id === item.id} label={item.label} detail={item.detail} icon={PlayCircle} accent="blue" onClick={() => setScenarioId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Concurrent viewers" value={concurrentViewers} output={formatViewers(concurrentViewers)} min={data.bounds.concurrentViewers.min} max={data.bounds.concurrentViewers.max} step={data.bounds.concurrentViewers.step} lowLabel={formatViewers(data.bounds.concurrentViewers.min)} highLabel={formatViewers(data.bounds.concurrentViewers.max)} accent="blue" onChange={setConcurrentViewers} />
              <LabRange label="Average delivered bitrate" value={averageBitrateMbps} output={`${averageBitrateMbps.toFixed(1)} Mbps`} min={data.bounds.averageBitrateMbps.min} max={data.bounds.averageBitrateMbps.max} step={data.bounds.averageBitrateMbps.step} lowLabel={`${data.bounds.averageBitrateMbps.min} Mbps`} highLabel={`${data.bounds.averageBitrateMbps.max} Mbps`} accent="violet" onChange={setAverageBitrateMbps} />
              <LabRange label="Segment duration" value={segmentDurationSeconds} output={`${segmentDurationSeconds}s`} min={data.bounds.segmentDurationSeconds.min} max={data.bounds.segmentDurationSeconds.max} step={data.bounds.segmentDurationSeconds.step} lowLabel="More requests" highLabel="Larger retries" accent="cyan" onChange={setSegmentDurationSeconds} />
              <LabRange label="Byte cache hit rate" value={byteCacheHitPercent} output={`${byteCacheHitPercent}%`} min={data.bounds.byteCacheHitPercent.min} max={data.bounds.byteCacheHitPercent.max} step={data.bounds.byteCacheHitPercent.step} lowLabel={`${data.bounds.byteCacheHitPercent.min}%`} highLabel={`${data.bounds.byteCacheHitPercent.max}%`} accent="emerald" onChange={setByteCacheHitPercent} />
            </div>
          )}
        >
          <div aria-live="polite" className={`rounded-md border p-4 ${result.originSafe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'}`}>
            <div className="flex items-start gap-3">
              {result.originSafe
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div className="min-w-0">
                <p className="text-base font-semibold text-neutral-950 dark:text-white">{result.originSafe ? 'Origin remains inside the modeled safety budget' : 'Miss traffic overwhelms the modeled origin budget'}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.originSafe
                    ? `The CDN absorbs ${result.shieldedTbps.toFixed(2)} Tbps before media reaches the origin.`
                    : 'Warm the release, improve byte hit rate, lower rendition demand, or add bounded origin capacity before launch.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Effective viewers" value={formatViewers(result.effectiveViewers)} detail={`${scenario.viewerMultiplier.toFixed(2)}x scenario multiplier`} icon={Tv} tone="blue" />
            <LabMetric label="Edge bandwidth" value={`${result.edgeTbps.toFixed(2)} Tbps`} detail="Aggregate delivered media" icon={Network} tone="cyan" />
            <LabMetric label="Segment requests" value={formatRequests(result.segmentRequestsPerSecond)} detail={`${segmentDurationSeconds}s segments`} icon={Activity} tone="violet" />
            <LabMetric label="Origin miss load" value={`${result.originTbps.toFixed(2)} Tbps`} detail={`${result.effectiveHitPercent}% effective byte hit`} icon={HardDrive} tone={result.originSafe ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-7 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Byte path at peak</p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">Request hit rate is not enough; the origin is sized from missed bytes.</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">{result.originUtilizationPercent.toFixed(0)}% origin budget</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
              <PathNode icon={PlayCircle} label="Players" value={`${result.edgeTbps.toFixed(2)} Tbps requested`} tone="blue" />
              <span className="hidden text-neutral-400 sm:block">-&gt;</span>
              <PathNode icon={Cloud} label="CDN fleet" value={`${result.shieldedTbps.toFixed(2)} Tbps absorbed`} tone="cyan" />
              <span className="hidden text-neutral-400 sm:block">-&gt;</span>
              <PathNode icon={HardDrive} label="Origin" value={`${result.originTbps.toFixed(2)} Tbps missed`} tone={result.originSafe ? 'emerald' : 'rose'} />
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div className={`h-full rounded-full ${result.originSafe ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, result.originUtilizationPercent)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-neutral-500 dark:text-neutral-400"><span>0 Tbps</span><span>{data.originSafeTbps.toFixed(1)} Tbps safety budget</span></div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathNode({ icon: Icon, label, value, tone }: { icon: typeof Gauge; label: string; value: string; tone: 'blue' | 'cyan' | 'emerald' | 'rose' }) {
  const styles = { blue: 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40', cyan: 'border-cyan-300 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40', emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40', rose: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40' };
  return <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}><Icon aria-hidden="true" className="h-5 w-5 text-neutral-700 dark:text-neutral-200" /><p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p><p className="mt-1 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-300">{value}</p></div>;
}

function LoadState() {
  return <div data-content-block={BLOCK_ID} aria-label="Loading video capacity lab" className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />;
}

function LoadError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{detail}</div>;
}
