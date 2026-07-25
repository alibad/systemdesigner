'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Camera, Gauge, Route, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeValue {
  min: number;
  max: number;
  step: number;
  default: number;
}

interface PerceptionSafetyData {
  title: string;
  description: string;
  bitsPerPixel: number;
  reactionBufferMs: number;
  confidenceThresholdPercent: number;
  ranges: Record<'sensorCount' | 'resolutionMp' | 'frameRate' | 'modelLatencyMs' | 'speedKph' | 'confidencePercent' | 'headroomPercent', RangeValue>;
}

function isRangeValue(value: unknown): value is RangeValue {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<RangeValue>;
  return [range.min, range.max, range.step, range.default].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  ) && range.min! < range.max! && range.default! >= range.min! && range.default! <= range.max!;
}

function isPerceptionSafetyData(value: unknown): value is PerceptionSafetyData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PerceptionSafetyData>;
  const keys = ['sensorCount', 'resolutionMp', 'frameRate', 'modelLatencyMs', 'speedKph', 'confidencePercent', 'headroomPercent'] as const;
  return typeof data.title === 'string' && typeof data.description === 'string' &&
    typeof data.bitsPerPixel === 'number' && typeof data.reactionBufferMs === 'number' &&
    typeof data.confidenceThresholdPercent === 'number' && Boolean(data.ranges) &&
    keys.every((key) => isRangeValue(data.ranges?.[key]));
}

const formatRate = (megabitsPerSecond: number) => megabitsPerSecond >= 1000
  ? `${(megabitsPerSecond / 1000).toFixed(1)} Gb/s`
  : `${Math.round(megabitsPerSecond).toLocaleString()} Mb/s`;

export default function TeslaAutopilotPerceptionSafetyMarginLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PerceptionSafetyData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sensorCount, setSensorCount] = useState(8);
  const [resolutionMp, setResolutionMp] = useState(4);
  const [frameRate, setFrameRate] = useState(30);
  const [modelLatencyMs, setModelLatencyMs] = useState(45);
  const [speedKph, setSpeedKph] = useState(70);
  const [confidencePercent, setConfidencePercent] = useState(90);
  const [headroomPercent, setHeadroomPercent] = useState(30);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }
    const controller = new AbortController();
    setLoadError(false);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Perception safety model request failed');
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPerceptionSafetyData(payload)) throw new Error('Perception safety model is invalid');
        setData(payload);
        setSensorCount(payload.ranges.sensorCount.default);
        setResolutionMp(payload.ranges.resolutionMp.default);
        setFrameRate(payload.ranges.frameRate.default);
        setModelLatencyMs(payload.ranges.modelLatencyMs.default);
        setSpeedKph(payload.ranges.speedKph.default);
        setConfidencePercent(payload.ranges.confidencePercent.default);
        setHeadroomPercent(payload.ranges.headroomPercent.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const frameBudgetMs = 1000 / frameRate;
    const plannedComputeBudgetMs = frameBudgetMs * (1 - headroomPercent / 100);
    const ingressMbps = sensorCount * resolutionMp * frameRate * data.bitsPerPixel;
    const computePressure = modelLatencyMs / plannedComputeBudgetMs;
    const speedMps = speedKph / 3.6;
    const reactionDistanceM = speedMps * ((modelLatencyMs + data.reactionBufferMs) / 1000);
    const droppedFramePressure = Math.max(0, (modelLatencyMs - frameBudgetMs) / frameBudgetMs);
    const timingSupported = computePressure <= 1;
    const confidenceSupported = confidencePercent >= data.confidenceThresholdPercent;
    const status = timingSupported && confidenceSupported
      ? 'supported'
      : timingSupported || confidenceSupported
        ? 'constrained'
        : 'unsupported';
    return { frameBudgetMs, plannedComputeBudgetMs, ingressMbps, computePressure, reactionDistanceM, droppedFramePressure, timingSupported, confidenceSupported, status };
  }, [confidencePercent, data, frameRate, headroomPercent, modelLatencyMs, resolutionMp, sensorCount, speedKph]);

  if (loadError) {
    return <div data-content-block="case-studies/tesla-autopilot-perception-safety-margin-lab" role="alert" className="min-h-40 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">The perception and safety model could not be loaded.</div>;
  }
  if (!data || !model) {
    return <div data-content-block="case-studies/tesla-autopilot-perception-safety-margin-lab" aria-busy="true" aria-label="Loading perception and safety model" className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />;
  }

  const reset = () => {
    setSensorCount(data.ranges.sensorCount.default);
    setResolutionMp(data.ranges.resolutionMp.default);
    setFrameRate(data.ranges.frameRate.default);
    setModelLatencyMs(data.ranges.modelLatencyMs.default);
    setSpeedKph(data.ranges.speedKph.default);
    setConfidencePercent(data.ranges.confidencePercent.default);
    setHeadroomPercent(data.ranges.headroomPercent.default);
  };
  const envelopeTone = model.status === 'supported' ? 'emerald' : model.status === 'constrained' ? 'amber' : 'rose';
  const envelopeCopy = model.status === 'supported'
    ? 'Supported in this model: confidence and planned compute budget both pass. Continue monitoring the next observation.'
    : model.status === 'constrained'
      ? 'Constrained: one gate is failing. Narrow the maneuver and seek fresh evidence rather than treating the nominal frame rate as sufficient.'
      : 'Unsupported: evidence and timing are both outside the modeled envelope. A normal automated maneuver should not continue.';

  return (
    <div data-content-block="case-studies/tesla-autopilot-perception-safety-margin-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Illustrative on-vehicle timing model" title={data.title} description={data.description} icon={Gauge} accent="cyan" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-6">
          <LabRange label="Sensor streams" value={sensorCount} output={`${sensorCount}`} {...data.ranges.sensorCount} accent="blue" lowLabel="fewer views" highLabel="more views" onChange={setSensorCount} />
          <LabRange label="Resolution per stream" value={resolutionMp} output={`${resolutionMp} MP`} {...data.ranges.resolutionMp} accent="violet" lowLabel="less detail" highLabel="more detail" onChange={setResolutionMp} />
          <LabRange label="Frame rate" value={frameRate} output={`${frameRate} fps`} {...data.ranges.frameRate} accent="cyan" lowLabel="slower updates" highLabel="faster updates" onChange={setFrameRate} />
          <LabRange label="Model latency" value={modelLatencyMs} output={`${modelLatencyMs} ms`} {...data.ranges.modelLatencyMs} accent="amber" lowLabel="faster model" highLabel="slower model" onChange={setModelLatencyMs} />
          <LabRange label="Vehicle speed" value={speedKph} output={`${speedKph} km/h`} {...data.ranges.speedKph} accent="rose" lowLabel="low speed" highLabel="high speed" onChange={setSpeedKph} />
          <LabRange label="Scene confidence" value={confidencePercent} output={`${confidencePercent}%`} {...data.ranges.confidencePercent} accent="emerald" lowLabel="uncertain" highLabel="confident" onChange={setConfidencePercent} />
          <LabRange label="Reserved headroom" value={headroomPercent} output={`${headroomPercent}%`} {...data.ranges.headroomPercent} accent="blue" lowLabel="little reserve" highLabel="more reserve" onChange={setHeadroomPercent} />
        </div>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric label="Raw ingress estimate" value={formatRate(model.ingressMbps)} detail={`${sensorCount} streams x ${resolutionMp} MP x ${frameRate} fps x ${data.bitsPerPixel} bits`} icon={Camera} tone="blue" />
            <LabMetric label="Frame budget" value={`${model.frameBudgetMs.toFixed(1)} ms`} detail="Time between nominal observations" icon={Timer} tone="cyan" />
            <LabMetric label="Planned compute budget" value={`${model.plannedComputeBudgetMs.toFixed(1)} ms`} detail={`${headroomPercent}% of the frame interval reserved`} icon={Gauge} tone={model.timingSupported ? 'emerald' : 'rose'} />
            <LabMetric label="Reaction distance" value={`${model.reactionDistanceM.toFixed(1)} m`} detail={`At ${speedKph} km/h with ${data.reactionBufferMs} ms response buffer`} icon={Route} tone="violet" />
            <LabMetric label="Dropped-frame pressure" value={`${(model.droppedFramePressure * 100).toFixed(0)}%`} detail={model.droppedFramePressure > 0 ? 'Latency exceeds one nominal frame interval' : 'Latency remains inside one nominal frame interval'} icon={Activity} tone={model.droppedFramePressure > 0 ? 'rose' : 'emerald'} />
            <LabMetric label="Safety envelope" value={model.status === 'supported' ? 'Supported' : model.status === 'constrained' ? 'Constrained' : 'Unsupported'} detail={`Confidence ${model.confidenceSupported ? 'passes' : 'misses'} ${data.confidenceThresholdPercent}% gate; timing ${model.timingSupported ? 'passes' : 'misses'} budget`} icon={model.status === 'supported' ? ShieldCheck : ShieldAlert} tone={envelopeTone} />
          </div>
          <div className={`mt-6 rounded-md border p-4 ${model.status === 'supported' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : model.status === 'constrained' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
            <p className="text-sm font-semibold">Safety-envelope status: {model.status}</p>
            <p className="mt-1 text-sm leading-6 opacity-80">{envelopeCopy}</p>
            <p className="mt-3 text-xs leading-5 opacity-75">Compute pressure = model latency / (frame interval x (1 - headroom)). Reaction distance = speed x (model latency + response buffer). These formulas demonstrate dependency, not a driving-control policy.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
