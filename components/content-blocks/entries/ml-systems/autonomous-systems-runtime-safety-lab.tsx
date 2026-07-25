'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Octagon,
  Radar,
  ShieldCheck,
  Siren,
  TimerReset,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/autonomous-systems-runtime-safety-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/autonomous-systems/data/runtime-safety-scenarios.json';

type FaultScenario = {
  id: string;
  label: string;
  detail: string;
  hazardWindowMs: number;
  severity: number;
  baseEscapeProbability: number;
  requiredEvidenceCoverage: number;
  safeState: string;
};

type Monitor = {
  id: string;
  label: string;
  detail: string;
  latencyMultiplier: number;
  faultCoverage: number;
  commonCausePenalty: number;
};

type Fallback = {
  id: string;
  label: string;
  detail: string;
  settleTimeMs: number;
  riskReduction: number;
  capability: string;
};

type EvidencePlan = {
  id: string;
  label: string;
  detail: string;
  coverage: number;
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    monitorId: string;
    fallbackId: string;
    evidencePlanId: string;
    detectionLatencyMs: number;
  };
  scenarios: FaultScenario[];
  monitors: Monitor[];
  fallbacks: Fallback[];
  evidencePlans: EvidencePlan[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      typeof data.defaults.scenarioId === 'string' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length >= 4 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.hazardWindowMs === 'number' &&
          typeof scenario.requiredEvidenceCoverage === 'number',
      ) &&
      Array.isArray(data.monitors) &&
      data.monitors.length >= 3 &&
      Array.isArray(data.fallbacks) &&
      data.fallbacks.length >= 3 &&
      Array.isArray(data.evidencePlans) &&
      data.evidencePlans.length >= 3,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function LabState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[640px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? 'Runtime safety lab unavailable' : 'Loading runtime safety lab'}
      >
        {error ? (
          <>
            <p className="font-semibold">Runtime safety lab unavailable</p>
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
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Boundary {boundary}</p>
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

export default function AutonomousSystemsRuntimeSafetyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('camera-occlusion');
  const [monitorId, setMonitorId] = useState('independent-runtime');
  const [fallbackId, setFallbackId] = useState('limited-motion');
  const [evidencePlanId, setEvidencePlanId] = useState('scenario-matrix');
  const [detectionLatencyMs, setDetectionLatencyMs] = useState(90);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The runtime safety cases have an invalid contract.');
        setData(value);
        setScenarioId(value.defaults.scenarioId);
        setMonitorId(value.defaults.monitorId);
        setFallbackId(value.defaults.fallbackId);
        setEvidencePlanId(value.defaults.evidencePlanId);
        setDetectionLatencyMs(value.defaults.detectionLatencyMs);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the safety lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const monitor = data.monitors.find((item) => item.id === monitorId) ?? data.monitors[0];
    const fallback = data.fallbacks.find((item) => item.id === fallbackId) ?? data.fallbacks[0];
    const evidencePlan =
      data.evidencePlans.find((item) => item.id === evidencePlanId) ?? data.evidencePlans[0];
    if (!scenario || !monitor || !fallback || !evidencePlan) return null;

    const monitorTimeMs = detectionLatencyMs * monitor.latencyMultiplier;
    const totalResponseMs = monitorTimeMs + fallback.settleTimeMs;
    const timeMarginMs = scenario.hazardWindowMs - totalResponseMs;
    const timingPass = timeMarginMs >= 0;
    const uncoveredFaultShare = clamp(
      1 - monitor.faultCoverage + monitor.commonCausePenalty,
      0,
      1,
    );
    const residualEscapeProbability =
      scenario.baseEscapeProbability * uncoveredFaultShare * (1 - fallback.riskReduction);
    const residualRiskIndex = residualEscapeProbability * scenario.severity * 100;
    const riskBoundary = 5;
    const riskPass = residualRiskIndex <= riskBoundary;
    const coveragePass = evidencePlan.coverage >= scenario.requiredEvidenceCoverage;
    const ready = timingPass && riskPass && coveragePass;

    let recommendation: string;
    if (ready) {
      recommendation =
        'The modeled response fits the timing and residual-risk boundaries, and the evidence plan covers this scenario class. Release still depends on traceable test evidence and monitored operation.';
    } else if (!timingPass) {
      recommendation =
        'The fallback finishes after the hazard window. Detect earlier, simplify the fallback, reduce operating speed, or narrow the operating domain.';
    } else if (!coveragePass) {
      recommendation =
        'The runtime path fits, but the evaluation plan does not justify the claim. Add scenario variation, fault injection, hardware timing, and protected replay evidence.';
    } else {
      recommendation =
        'The response is fast enough but leaves too much residual risk. Increase monitor independence or choose a fallback that removes more authority.';
    }

    return {
      coveragePass,
      evidencePlan,
      fallback,
      monitor,
      monitorTimeMs,
      ready,
      recommendation,
      residualRiskIndex,
      riskBoundary,
      riskPass,
      scenario,
      timeMarginMs,
      timingPass,
      totalResponseMs,
    };
  }, [data, detectionLatencyMs, evidencePlanId, fallbackId, monitorId, scenarioId]);

  if (loadError) return <LabState error={loadError} />;
  if (!data) return <LabState />;
  if (!model) return <LabState error="The selected fault, monitor, fallback, or evidence plan is missing." />;

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setMonitorId(data.defaults.monitorId);
    setFallbackId(data.defaults.fallbackId);
    setEvidencePlanId(data.defaults.evidencePlanId);
    setDetectionLatencyMs(data.defaults.detectionLatencyMs);
  };
  const OutcomeIcon = model.ready ? ShieldCheck : Siren;
  const outcomeTone = model.ready
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';
  const timelineScale = Math.max(model.scenario.hazardWindowMs, model.totalResponseMs) * 1.06;
  const monitorWidth = clamp((model.monitorTimeMs / timelineScale) * 100, 0, 100);
  const fallbackWidth = clamp((model.fallback.settleTimeMs / timelineScale) * 100, 0, 100);
  const hazardPosition = clamp((model.scenario.hazardWindowMs / timelineScale) * 100, 0, 100);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Runtime assurance control room"
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
                  1. Inject a fault
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === model.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={AlertTriangle}
                      accent="rose"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Detection architecture
                </legend>
                <div className="mt-3 space-y-2">
                  {data.monitors.map((monitor) => (
                    <LabChoice
                      key={monitor.id}
                      selected={monitor.id === model.monitor.id}
                      label={monitor.label}
                      detail={monitor.detail}
                      icon={Radar}
                      accent="violet"
                      onClick={() => setMonitorId(monitor.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Base detection latency"
                value={detectionLatencyMs}
                output={`${detectionLatencyMs} ms`}
                min={30}
                max={300}
                step={10}
                accent="amber"
                lowLabel="Early signal"
                highLabel="Late signal"
                onChange={setDetectionLatencyMs}
              />

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
                      icon={Octagon}
                      accent="amber"
                      onClick={() => setFallbackId(fallback.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Evaluation evidence
                </legend>
                <div className="mt-3 space-y-2">
                  {data.evidencePlans.map((plan) => (
                    <LabChoice
                      key={plan.id}
                      selected={plan.id === model.evidencePlan.id}
                      label={plan.label}
                      detail={plan.detail}
                      icon={ClipboardCheck}
                      accent="emerald"
                      onClick={() => setEvidencePlanId(plan.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Hazard window"
                value={`${model.scenario.hazardWindowMs} ms`}
                detail={`${model.scenario.label}; severity ${model.scenario.severity}/5`}
                icon={Clock3}
                tone="rose"
              />
              <LabMetric
                label="Total response"
                value={`${model.totalResponseMs.toFixed(0)} ms`}
                detail={`${model.monitorTimeMs.toFixed(0)} ms detect + ${model.fallback.settleTimeMs} ms settle`}
                icon={TimerReset}
                tone={model.timingPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Time margin"
                value={`${model.timeMarginMs >= 0 ? '+' : ''}${model.timeMarginMs.toFixed(0)} ms`}
                detail="Before the hazard boundary"
                icon={Activity}
                tone={model.timingPass ? 'emerald' : 'rose'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <span>Fault detected, authority revoked, fallback settled</span>
                <span>Hazard at {model.scenario.hazardWindowMs} ms</span>
              </div>
              <div className="relative mt-4 h-8 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                <div className="flex h-full">
                  <div
                    className="flex h-full items-center justify-center overflow-hidden bg-violet-500 text-[10px] font-semibold text-white transition-[width] motion-reduce:transition-none"
                    style={{ width: `${monitorWidth}%` }}
                    title={`Detection ${model.monitorTimeMs.toFixed(0)} ms`}
                  >
                    <span className="px-1">Detect</span>
                  </div>
                  <div
                    className={`flex h-full items-center justify-center overflow-hidden text-[10px] font-semibold text-white transition-[width] motion-reduce:transition-none ${
                      model.timingPass ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${fallbackWidth}%` }}
                    title={`Fallback ${model.fallback.settleTimeMs} ms`}
                  >
                    <span className="px-1">Fallback</span>
                  </div>
                </div>
                <span
                  className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                  style={{ left: `${hazardPosition}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
                <p>
                  <strong>Fallback capability:</strong> {model.fallback.capability}
                </p>
                <p className="sm:text-right">
                  <strong>Target safe state:</strong> {model.scenario.safeState}
                </p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]">
              <div className="rounded-md border border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
                <GateRow
                  label="Response timing"
                  value={`${model.totalResponseMs.toFixed(0)} ms`}
                  boundary={`<= ${model.scenario.hazardWindowMs} ms`}
                  pass={model.timingPass}
                />
                <GateRow
                  label="Residual risk index"
                  value={model.residualRiskIndex.toFixed(1)}
                  boundary={`<= ${model.riskBoundary.toFixed(1)}`}
                  pass={model.riskPass}
                />
                <GateRow
                  label="Evaluation coverage"
                  value={`${model.evidencePlan.coverage}%`}
                  boundary={`>= ${model.scenario.requiredEvidenceCoverage}%`}
                  pass={model.coveragePass}
                />
              </div>

              <div className={`rounded-md border p-4 ${outcomeTone}`}>
                <OutcomeIcon aria-hidden="true" className="h-6 w-6" />
                <p className="mt-3 text-xs font-semibold uppercase opacity-75">Release decision</p>
                <p className="mt-1 text-xl font-semibold">
                  {model.ready ? 'Evidence supports the boundary' : 'Do not promote this configuration'}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-85">{model.recommendation}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
