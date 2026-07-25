'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Gauge,
  Hand,
  Radar,
  ShieldCheck,
  Siren,
  TimerReset,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/robotics-agents-runtime-response-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/robotics-agents/data/runtime-response-scenarios.json';

type Failure = {
  id: string;
  label: string;
  detail: string;
  hazardWindowMs: number;
  baseRisk: number;
  severity: number;
  requiredCoverage: number;
  safeState: string;
};

type Monitor = {
  id: string;
  label: string;
  detail: string;
  detectionMs: number;
  coverage: number;
  commonCausePenalty: number;
};

type Fallback = {
  id: string;
  label: string;
  detail: string;
  settleMs: number;
  riskReduction: number;
  capability: number;
};

type LabData = {
  blockId: string;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    failureId: string;
    monitorId: string;
    fallbackId: string;
  };
  failures: Failure[];
  monitors: Monitor[];
  fallbacks: Fallback[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    data.blockId === BLOCK_ID &&
      typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.modelNote === 'string' &&
      data.defaults &&
      typeof data.defaults.failureId === 'string' &&
      typeof data.defaults.monitorId === 'string' &&
      typeof data.defaults.fallbackId === 'string' &&
      Array.isArray(data.failures) &&
      data.failures.length >= 4 &&
      data.failures.every(
        (failure) =>
          typeof failure.id === 'string' &&
          typeof failure.hazardWindowMs === 'number' &&
          typeof failure.requiredCoverage === 'number',
      ) &&
      Array.isArray(data.monitors) &&
      data.monitors.length >= 3 &&
      data.monitors.every(
        (monitor) =>
          typeof monitor.id === 'string' &&
          typeof monitor.detectionMs === 'number' &&
          typeof monitor.coverage === 'number',
      ) &&
      Array.isArray(data.fallbacks) &&
      data.fallbacks.length >= 4 &&
      data.fallbacks.every(
        (fallback) =>
          typeof fallback.id === 'string' &&
          typeof fallback.settleMs === 'number' &&
          typeof fallback.riskReduction === 'number',
      ),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function BlockState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[600px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? 'Runtime response lab unavailable' : 'Loading runtime response lab'}
      >
        {error ? (
          <>
            <p className="font-semibold">Runtime response lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function GateRow({
  label,
  value,
  boundary,
  pass,
}: {
  label: string;
  value: string;
  boundary: string;
  pass: boolean;
}) {
  const Icon = pass ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 py-3 last:border-b-0 dark:border-neutral-800">
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          aria-hidden="true"
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            pass ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
          }`}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{boundary}</p>
        </div>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function RoboticsAgentsRuntimeResponseLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failureId, setFailureId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [fallbackId, setFallbackId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The response model has an invalid contract.');
        setData(value);
        setFailureId(value.defaults.failureId);
        setMonitorId(value.defaults.monitorId);
        setFallbackId(value.defaults.fallbackId);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
    const monitor = data.monitors.find((item) => item.id === monitorId) ?? data.monitors[0];
    const fallback = data.fallbacks.find((item) => item.id === fallbackId) ?? data.fallbacks[0];
    if (!failure || !monitor || !fallback) return null;

    const effectiveCoverage = clamp(monitor.coverage - monitor.commonCausePenalty, 0, 1);
    const responseMs = monitor.detectionMs + fallback.settleMs;
    const timeMarginMs = failure.hazardWindowMs - responseMs;
    const timingPass = timeMarginMs >= 0;
    const coveragePass = effectiveCoverage >= failure.requiredCoverage;
    const residualRisk = failure.baseRisk * (1 - effectiveCoverage * fallback.riskReduction);
    const riskBoundary = failure.severity >= 5 ? 24 : 25;
    const riskPass = residualRisk <= riskBoundary;
    const ready = timingPass && coveragePass && riskPass;

    let recommendation: string;
    if (ready) {
      recommendation = `The selected path reaches "${failure.safeState}" inside the modeled timing, coverage, and residual-risk gates.`;
    } else if (!timingPass) {
      recommendation =
        'The response arrives after the hazard window. Contain locally first; operator or remote recovery can follow after motion is safe.';
    } else if (!coveragePass) {
      recommendation =
        'The response is fast enough, but the monitor shares too much of the policy failure or misses this hazard class. Add an independent signal.';
    } else {
      recommendation =
        'Detection fits, but the fallback preserves too much authority. Reduce speed or force further, or transition to the defined safe state.';
    }

    return {
      coveragePass,
      effectiveCoverage,
      failure,
      fallback,
      monitor,
      ready,
      recommendation,
      residualRisk,
      responseMs,
      riskBoundary,
      riskPass,
      timeMarginMs,
      timingPass,
    };
  }, [data, failureId, fallbackId, monitorId]);

  if (loadError) return <BlockState error={loadError} />;
  if (!data) return <BlockState />;
  if (!model) return <BlockState error="The selected failure, monitor, or fallback is missing." />;

  const reset = () => {
    setFailureId(data.defaults.failureId);
    setMonitorId(data.defaults.monitorId);
    setFallbackId(data.defaults.fallbackId);
  };

  const OutcomeIcon = model.ready ? ShieldCheck : Siren;
  const outcomeStyle = model.ready
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
  const timelineScale = Math.max(model.failure.hazardWindowMs, model.responseMs) * 1.08;
  const detectionWidth = clamp((model.monitor.detectionMs / timelineScale) * 100, 1.5, 100);
  const settleWidth = clamp((model.fallback.settleMs / timelineScale) * 100, 1.5, 100);
  const hazardPosition = clamp((model.failure.hazardWindowMs / timelineScale) * 100, 0, 100);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime authority simulator"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 space-y-2">
                  {data.failures.map((failure) => (
                    <LabChoice
                      key={failure.id}
                      selected={failure.id === model.failure.id}
                      label={failure.label}
                      detail={failure.detail}
                      icon={AlertTriangle}
                      accent="rose"
                      onClick={() => setFailureId(failure.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Detection authority
                </legend>
                <div className="mt-3 space-y-2">
                  {data.monitors.map((monitor) => (
                    <LabChoice
                      key={monitor.id}
                      selected={monitor.id === model.monitor.id}
                      label={monitor.label}
                      detail={monitor.detail}
                      icon={monitor.id === 'policy-self-check' ? Bot : Radar}
                      accent="violet"
                      onClick={() => setMonitorId(monitor.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Fallback action
                </legend>
                <div className="mt-3 space-y-2">
                  {data.fallbacks.map((fallback) => (
                    <LabChoice
                      key={fallback.id}
                      selected={fallback.id === model.fallback.id}
                      label={fallback.label}
                      detail={fallback.detail}
                      icon={fallback.id === 'teleoperation' ? Hand : ShieldCheck}
                      accent="amber"
                      onClick={() => setFallbackId(fallback.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Detection-to-safe-state timeline
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {model.failure.label}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  Hazard window {model.failure.hazardWindowMs} ms
                </p>
              </div>

              <div className="relative mt-7 h-12 rounded-md bg-neutral-100 dark:bg-neutral-900">
                <div
                  className="absolute inset-y-0 left-0 rounded-l-md bg-violet-500"
                  style={{ width: `${detectionWidth}%` }}
                  title={`Detection: ${model.monitor.detectionMs} ms`}
                />
                <div
                  className="absolute inset-y-0 bg-amber-500"
                  style={{ left: `${detectionWidth}%`, width: `${settleWidth}%` }}
                  title={`Fallback settling: ${model.fallback.settleMs} ms`}
                />
                <span
                  className="absolute -top-2 bottom-[-8px] w-0.5 bg-rose-700 dark:bg-rose-300"
                  style={{ left: `${hazardPosition}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" aria-hidden="true" />
                  Detection {model.monitor.detectionMs} ms
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" />
                  Fallback settles {model.fallback.settleMs} ms
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-0.5 bg-rose-700 dark:bg-rose-300" aria-hidden="true" />
                  Hazard boundary
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Response time"
                value={`${model.responseMs} ms`}
                detail={`${model.timeMarginMs >= 0 ? '+' : ''}${model.timeMarginMs} ms margin`}
                icon={TimerReset}
                tone={model.timingPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Independent coverage"
                value={`${Math.round(model.effectiveCoverage * 100)}%`}
                detail={`Required ${Math.round(model.failure.requiredCoverage * 100)}%`}
                icon={Radar}
                tone={model.coveragePass ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Residual risk"
                value={model.residualRisk.toFixed(1)}
                detail={`Boundary ${model.riskBoundary}`}
                icon={Siren}
                tone={model.riskPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Task capability"
                value={`${model.fallback.capability}%`}
                detail="Capability retained during fallback"
                icon={Gauge}
                tone="amber"
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 dark:border-neutral-800 dark:bg-neutral-900">
              <GateRow
                label="Timing gate"
                value={`${model.responseMs} ms`}
                boundary={`Must finish within ${model.failure.hazardWindowMs} ms`}
                pass={model.timingPass}
              />
              <GateRow
                label="Coverage gate"
                value={`${Math.round(model.effectiveCoverage * 100)}%`}
                boundary={`Must cover at least ${Math.round(model.failure.requiredCoverage * 100)}%`}
                pass={model.coveragePass}
              />
              <GateRow
                label="Residual-risk gate"
                value={model.residualRisk.toFixed(1)}
                boundary={`Must remain at or below ${model.riskBoundary}`}
                pass={model.riskPass}
              />
            </div>

            <div className={`rounded-md border p-5 ${outcomeStyle}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-lg font-semibold">
                    {model.ready ? 'Release gate passes' : 'Release gate blocked'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{model.recommendation}</p>
                </div>
              </div>
            </div>

            <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              {data.modelNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
