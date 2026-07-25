'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Monitor,
  Radio,
  RefreshCw,
  TriangleAlert,
  Users,
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
type RefreshRate = { hz: number; label: string; detail: string };
type SceneProfile = {
  id: string;
  label: string;
  detail: string;
  baseCpuMs: number;
  baseGpuMs: number;
  cpuPerParticipantMs: number;
  gpuPerParticipantMs: number;
};
type FoveationMode = {
  id: string;
  label: string;
  detail: string;
  gpuMultiplier: number;
};
type FrameBudgetModel = {
  runtimeReserveMs: number;
  defaults: {
    refreshHz: number;
    sceneId: string;
    foveationId: string;
    participants: number;
    renderScalePercent: number;
  };
  bounds: {
    participants: Bound;
    renderScalePercent: Bound;
  };
  refreshRates: RefreshRate[];
  scenes: SceneProfile[];
  foveationModes: FoveationMode[];
};

const BLOCK_ID = 'fundamentals/immersive-experience-platforms-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/immersive-experience-platforms/data/frame-budget-model.json';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isFrameBudgetModel(value: unknown): value is FrameBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameBudgetModel>;
  return Boolean(
    typeof candidate.runtimeReserveMs === 'number'
      && candidate.defaults?.sceneId
      && candidate.defaults.foveationId
      && typeof candidate.defaults.refreshHz === 'number'
      && typeof candidate.defaults.participants === 'number'
      && typeof candidate.defaults.renderScalePercent === 'number'
      && isBound(candidate.bounds?.participants)
      && isBound(candidate.bounds?.renderScalePercent)
      && Array.isArray(candidate.refreshRates)
      && candidate.refreshRates.length >= 2
      && Array.isArray(candidate.scenes)
      && candidate.scenes.length >= 2
      && Array.isArray(candidate.foveationModes)
      && candidate.foveationModes.length >= 2,
  );
}

function formatMs(value: number) {
  return `${value.toFixed(1)} ms`;
}

export default function ImmersiveExperiencePlatformsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FrameBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshHz, setRefreshHz] = useState(90);
  const [sceneId, setSceneId] = useState('shared-design-review');
  const [foveationId, setFoveationId] = useState('balanced');
  const [participants, setParticipants] = useState(8);
  const [renderScalePercent, setRenderScalePercent] = useState(100);

  function reset(model: FrameBudgetModel) {
    setRefreshHz(model.defaults.refreshHz);
    setSceneId(model.defaults.sceneId);
    setFoveationId(model.defaults.foveationId);
    setParticipants(model.defaults.participants);
    setRenderScalePercent(model.defaults.renderScalePercent);
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFrameBudgetModel(payload)) throw new Error('The frame-budget model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load frame data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const scene = data.scenes.find((candidate) => candidate.id === sceneId) ?? data.scenes[0];
    const foveation = data.foveationModes.find((candidate) => candidate.id === foveationId)
      ?? data.foveationModes[0];
    const displayIntervalMs = 1000 / refreshHz;
    const appBudgetMs = Math.max(0, displayIntervalMs - data.runtimeReserveMs);
    const cpuMs = scene.baseCpuMs + Math.max(0, participants - 1) * scene.cpuPerParticipantMs;
    const renderScale = renderScalePercent / 100;
    const gpuMs = (
      scene.baseGpuMs + Math.max(0, participants - 1) * scene.gpuPerParticipantMs
    ) * renderScale * renderScale * foveation.gpuMultiplier;
    const criticalPathMs = Math.max(cpuMs, gpuMs);
    const marginMs = appBudgetMs - criticalPathMs;
    const status = marginMs >= 1
      ? 'Inside the frame deadline'
      : marginMs >= 0
        ? 'Deadline is fragile'
        : 'Application frame misses the deadline';
    const tone: 'emerald' | 'amber' | 'rose' = marginMs >= 1
      ? 'emerald'
      : marginMs >= 0
        ? 'amber'
        : 'rose';
    const bottleneck = cpuMs >= gpuMs ? 'CPU simulation and scene work' : 'GPU rendering work';
    const recommendation = marginMs < 0
      ? cpuMs >= gpuMs
        ? 'Reduce per-frame simulation, avatar updates, or main-thread synchronization before lowering visual quality.'
        : 'Lower render scale, simplify visible materials or geometry, or increase foveation before weakening tracking and input.'
      : marginMs < 1
        ? 'Keep more reserve for spikes, thermal throttling, and runtime work; a passing average is not a stable frame contract.'
        : 'The model has working headroom. Validate p95 and p99 frame times on each supported device instead of trusting this estimate alone.';

    return {
      appBudgetMs,
      bottleneck,
      cpuMs,
      criticalPathMs,
      displayIntervalMs,
      foveation,
      gpuMs,
      marginMs,
      recommendation,
      scene,
      status,
      tone,
    };
  }, [data, foveationId, participants, refreshHz, renderScalePercent, sceneId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Frame deadline lab"
          title="Fit the scene into the next display interval"
          description="Choose a device refresh rate and workload, then change participant load, render scale, and foveation. The model compares the CPU/GPU critical path with the application time left after a small runtime reserve."
          icon={Gauge}
          accent="cyan"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !result ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Frame model could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  Loading the frame model...
                </p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Scene workload
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenes.map((scene) => (
                      <LabChoice
                        key={scene.id}
                        selected={scene.id === result.scene.id}
                        label={scene.label}
                        detail={scene.detail}
                        icon={scene.id === 'shared-design-review' ? Users : Layers3}
                        accent="blue"
                        onClick={() => setSceneId(scene.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Display refresh
                  </legend>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {data.refreshRates.map((rate) => (
                      <button
                        key={rate.hz}
                        type="button"
                        aria-pressed={refreshHz === rate.hz}
                        title={rate.detail}
                        onClick={() => setRefreshHz(rate.hz)}
                        className={`h-12 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          refreshHz === rate.hz
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:bg-cyan-950/50 dark:text-cyan-50'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                        }`}
                      >
                        {rate.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Active participants"
                  value={participants}
                  output={`${participants}`}
                  {...data.bounds.participants}
                  accent="violet"
                  lowLabel="solo"
                  highLabel="busy room"
                  onChange={setParticipants}
                />
                <LabRange
                  label="Per-eye render scale"
                  value={renderScalePercent}
                  output={`${renderScalePercent}%`}
                  {...data.bounds.renderScalePercent}
                  accent="blue"
                  lowLabel="reduced"
                  highLabel="supersampled"
                  onChange={setRenderScalePercent}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Foveation policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.foveationModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === result.foveation.id}
                        label={mode.label}
                        detail={mode.detail}
                        icon={Radio}
                        accent="violet"
                        onClick={() => setFoveationId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Display interval"
                  value={formatMs(result.displayIntervalMs)}
                  detail={`${refreshHz} refreshes each second.`}
                  icon={Monitor}
                  tone="blue"
                />
                <LabMetric
                  label="Application budget"
                  value={formatMs(result.appBudgetMs)}
                  detail={`${formatMs(data.runtimeReserveMs)} reserved for runtime and compositor work in this model.`}
                  icon={Clock3}
                  tone="cyan"
                />
                <LabMetric
                  label="Critical path"
                  value={formatMs(result.criticalPathMs)}
                  detail={result.bottleneck}
                  icon={Cpu}
                  tone={result.tone}
                />
                <LabMetric
                  label="Deadline margin"
                  value={`${result.marginMs >= 0 ? '+' : ''}${formatMs(result.marginMs)}`}
                  detail={result.status}
                  icon={result.marginMs >= 0 ? CheckCircle2 : TriangleAlert}
                  tone={result.tone}
                />
              </div>

              <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      One application frame
                    </p>
                    <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                      CPU and GPU are pipelined; the slower side determines this simplified critical path.
                    </p>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Deadline {formatMs(result.appBudgetMs)}
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {[
                    { label: 'CPU scene work', value: result.cpuMs, color: 'bg-violet-500' },
                    { label: 'GPU render work', value: result.gpuMs, color: 'bg-blue-500' },
                  ].map((stage) => {
                    const width = Math.min(100, stage.value / Math.max(result.appBudgetMs, 0.1) * 100);
                    const overflow = stage.value > result.appBudgetMs;
                    return (
                      <div key={stage.label}>
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-medium text-neutral-700 dark:text-neutral-200">{stage.label}</span>
                          <span className={`font-semibold tabular-nums ${overflow ? 'text-rose-600 dark:text-rose-300' : 'text-neutral-950 dark:text-white'}`}>
                            {formatMs(stage.value)}
                          </span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${overflow ? 'bg-rose-500' : stage.color}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`mt-5 rounded-md border p-4 ${
                result.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                    : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
              }`}>
                <div className="flex items-start gap-3">
                  {result.marginMs >= 0 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                  )}
                  <div>
                    <p className="font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {result.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
