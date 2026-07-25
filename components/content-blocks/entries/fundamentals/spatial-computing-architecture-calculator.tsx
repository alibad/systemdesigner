'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Cpu,
  Frame,
  Gauge,
  Glasses,
  LoaderCircle,
  ScanLine,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FrameTarget = {
  id: string;
  label: string;
  detail: string;
  fps: number;
  displayMs: number;
};

type InferenceMode = {
  id: string;
  label: string;
  detail: string;
  latencyMs: number;
  blocksFrame: boolean;
};

type FrameBudgetModel = {
  kind: 'spatial-frame-budget';
  title: string;
  description: string;
  defaults: {
    frameTargetId: string;
    inferenceModeId: string;
    sensorMs: number;
    trackingMs: number;
    applicationMs: number;
    renderMs: number;
  };
  ranges: {
    sensorMs: { min: number; max: number; step: number };
    trackingMs: { min: number; max: number; step: number };
    applicationMs: { min: number; max: number; step: number };
    renderMs: { min: number; max: number; step: number };
  };
  frameTargets: FrameTarget[];
  inferenceModes: InferenceMode[];
};

type StageTone = 'cyan' | 'violet' | 'blue' | 'amber' | 'emerald' | 'rose';

type FrameStage = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: StageTone;
};

const STAGE_COLORS: Record<StageTone, string> = {
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
};

const BLOCK_ID = 'fundamentals/spatial-computing-architecture-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/spatial-computing-architecture/data/frame-budget-model.json';

function isFrameBudgetModel(value: unknown): value is FrameBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameBudgetModel>;
  return Boolean(
    candidate.kind === 'spatial-frame-budget'
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && candidate.ranges
      && Array.isArray(candidate.frameTargets)
      && candidate.frameTargets.length > 0
      && candidate.frameTargets.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.fps === 'number'
        && typeof item.displayMs === 'number')
      && Array.isArray(candidate.inferenceModes)
      && candidate.inferenceModes.length > 0
      && candidate.inferenceModes.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.latencyMs === 'number'
        && typeof item.blocksFrame === 'boolean'),
  );
}

export default function SpatialComputingArchitectureCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<FrameBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [frameTargetId, setFrameTargetId] = useState('');
  const [inferenceModeId, setInferenceModeId] = useState('');
  const [sensorMs, setSensorMs] = useState(0);
  const [trackingMs, setTrackingMs] = useState(0);
  const [applicationMs, setApplicationMs] = useState(0);
  const [renderMs, setRenderMs] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFrameBudgetModel(payload)) {
          throw new Error('The spatial frame-budget model is incomplete.');
        }
        setModel(payload);
        setFrameTargetId(payload.defaults.frameTargetId);
        setInferenceModeId(payload.defaults.inferenceModeId);
        setSensorMs(payload.defaults.sensorMs);
        setTrackingMs(payload.defaults.trackingMs);
        setApplicationMs(payload.defaults.applicationMs);
        setRenderMs(payload.defaults.renderMs);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const target = model?.frameTargets.find((item) => item.id === frameTargetId)
    ?? model?.frameTargets[0];
  const inference = model?.inferenceModes.find((item) => item.id === inferenceModeId)
    ?? model?.inferenceModes[0];

  const result = useMemo(() => {
    if (!target || !inference) return null;
    const frameBudgetMs = 1000 / target.fps;
    const localPathMs =
      sensorMs + trackingMs + applicationMs + renderMs + target.displayMs;
    const blockingInferenceMs = inference.blocksFrame ? inference.latencyMs : 0;
    const criticalPathMs = localPathMs + blockingInferenceMs;
    const headroomMs = frameBudgetMs - criticalPathMs;
    const remoteFreshnessMs = inference.blocksFrame
      ? criticalPathMs
      : inference.latencyMs + frameBudgetMs;
    const tone = headroomMs >= 1
      ? 'emerald'
      : headroomMs >= 0
        ? 'amber'
        : 'rose';

    return {
      blockingInferenceMs,
      criticalPathMs,
      frameBudgetMs,
      headroomMs,
      localPathMs,
      remoteFreshnessMs,
      tone,
    } as const;
  }, [applicationMs, inference, renderMs, sensorMs, target, trackingMs]);

  if (!model || !target || !inference || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Motion-to-photon lab"
            title="Build a frame path that can finish on time"
            description="Loading frame targets, pipeline stages, and offload choices."
            icon={Glasses}
            accent="cyan"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading spatial frame model...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setFrameTargetId(model.defaults.frameTargetId);
    setInferenceModeId(model.defaults.inferenceModeId);
    setSensorMs(model.defaults.sensorMs);
    setTrackingMs(model.defaults.trackingMs);
    setApplicationMs(model.defaults.applicationMs);
    setRenderMs(model.defaults.renderMs);
  };

  const stages: FrameStage[] = [
    { label: 'Sensors', value: sensorMs, icon: ScanLine, tone: 'cyan' },
    { label: 'Tracking', value: trackingMs, icon: Activity, tone: 'violet' },
    { label: 'Application', value: applicationMs, icon: Cpu, tone: 'blue' },
    { label: 'Render', value: renderMs, icon: Frame, tone: 'amber' },
    { label: 'Display', value: target.displayMs, icon: Glasses, tone: 'emerald' },
  ];
  if (result.blockingInferenceMs > 0) {
    stages.push({
      label: 'Remote wait',
      value: result.blockingInferenceMs,
      icon: Cloud,
      tone: 'rose',
    });
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Motion-to-photon lab"
          title={model.title}
          description={model.description}
          icon={Glasses}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Display target
                </legend>
                <div className="mt-3 space-y-2">
                  {model.frameTargets.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === target.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Gauge}
                      accent="cyan"
                      onClick={() => setFrameTargetId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Semantic inference path
                </legend>
                <div className="mt-3 space-y-2">
                  {model.inferenceModes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === inference.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'device' ? Cpu : Cloud}
                      accent={item.blocksFrame ? 'rose' : item.id === 'device' ? 'emerald' : 'violet'}
                      onClick={() => setInferenceModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Sensor acquisition"
                  value={sensorMs}
                  output={`${sensorMs.toFixed(1)} ms`}
                  {...model.ranges.sensorMs}
                  lowLabel="short exposure"
                  highLabel="more capture time"
                  onChange={setSensorMs}
                />
                <LabRange
                  label="Pose and mapping"
                  value={trackingMs}
                  output={`${trackingMs.toFixed(1)} ms`}
                  {...model.ranges.trackingMs}
                  accent="violet"
                  lowLabel="stable scene"
                  highLabel="hard relocalization"
                  onChange={setTrackingMs}
                />
                <LabRange
                  label="Application update"
                  value={applicationMs}
                  output={`${applicationMs.toFixed(1)} ms`}
                  {...model.ranges.applicationMs}
                  accent="blue"
                  lowLabel="bounded work"
                  highLabel="busy simulation"
                  onChange={setApplicationMs}
                />
                <LabRange
                  label="Render work"
                  value={renderMs}
                  output={`${renderMs.toFixed(1)} ms`}
                  {...model.ranges.renderMs}
                  accent="amber"
                  lowLabel="simple scene"
                  highLabel="heavy scene"
                  onChange={setRenderMs}
                />
              </div>
            </div>
          )}
        >
          <div aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Frame budget"
                value={`${result.frameBudgetMs.toFixed(1)} ms`}
                detail={`${target.fps} frames per second`}
                icon={Timer}
                tone="cyan"
              />
              <LabMetric
                label="Critical path"
                value={`${result.criticalPathMs.toFixed(1)} ms`}
                detail={`${result.localPathMs.toFixed(1)} ms local work`}
                icon={Activity}
                tone={result.tone}
              />
              <LabMetric
                label="Headroom"
                value={`${result.headroomMs >= 0 ? '+' : ''}${result.headroomMs.toFixed(1)} ms`}
                detail={result.headroomMs >= 0 ? 'Budget remains' : 'Frame deadline missed'}
                icon={Gauge}
                tone={result.tone}
              />
              <LabMetric
                label="Remote freshness"
                value={`${result.remoteFreshnessMs.toFixed(1)} ms`}
                detail={inference.blocksFrame ? 'Frame waits for result' : 'Result updates a later frame'}
                icon={Cloud}
                tone={inference.blocksFrame ? 'rose' : 'violet'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    One modeled frame
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    Width shows each stage&apos;s share of the selected display deadline.
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {result.criticalPathMs.toFixed(1)} / {result.frameBudgetMs.toFixed(1)} ms
                </span>
              </div>
              <div className="mt-4 flex h-10 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                {stages.map((stage) => {
                  const width = Math.max(4, stage.value / result.frameBudgetMs * 100);
                  const StageIcon = stage.icon;
                  return (
                    <div
                      key={stage.label}
                      className={`flex min-w-0 items-center justify-center border-r border-white/40 px-1 text-[10px] font-semibold text-white last:border-r-0 ${STAGE_COLORS[stage.tone]}`}
                      style={{ width: `${width}%` }}
                      title={`${stage.label}: ${stage.value.toFixed(1)} ms`}
                    >
                      <StageIcon aria-hidden="true" className="mr-1 hidden h-3 w-3 shrink-0 sm:block" />
                      <span className="truncate">{stage.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.headroomMs >= 1
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : result.headroomMs >= 0
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.headroomMs >= 1 ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {result.headroomMs >= 1
                      ? 'The modeled frame finishes with recovery margin'
                      : result.headroomMs >= 0
                        ? 'The frame fits, but normal variance can break it'
                        : 'The selected work misses the display deadline'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {inference.blocksFrame
                      ? 'A remote response is on the motion-to-photon path. Move it to an asynchronous future-frame update or provide a local fallback.'
                      : 'Tracking and rendering stay local. Remote semantics may be older, so version them and reject results whose pose, map, or object identity is stale.'}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This is deterministic teaching arithmetic, not a device benchmark. Real runtimes overlap work,
              predict poses, vary scanout behavior, and expose platform-specific timing. Measure the complete
              motion-to-photon path on target hardware.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
