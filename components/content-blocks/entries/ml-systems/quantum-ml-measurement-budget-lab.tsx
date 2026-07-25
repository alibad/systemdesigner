'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Atom,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Target,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/quantum-ml/data/measurement-budget-lab.json';

type Backend = {
  id: string;
  label: string;
  detail: string;
  visibility: number;
  bias: number;
  shotTimeMs: number;
  queueSeconds: number;
  mitigationMultiplier: number;
};

type LabData = {
  title: string;
  description: string;
  targetExpectation: number;
  confidenceZ: number;
  defaultShotExponent: number;
  defaultParameters: number;
  backends: Backend[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.targetExpectation === 'number' &&
      typeof data.confidenceZ === 'number' &&
      typeof data.defaultShotExponent === 'number' &&
      typeof data.defaultParameters === 'number' &&
      Array.isArray(data.backends) &&
      data.backends.length > 0,
  );
}

function formatDuration(seconds: number) {
  if (seconds < 1) return `${Math.max(1, Math.round(seconds * 1000))} ms`;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} sec`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function QuantumMlMeasurementBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backendId, setBackendId] = useState('noisy-device');
  const [shotExponent, setShotExponent] = useState(8);
  const [parameters, setParameters] = useState(12);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The measurement lab data does not match the expected contract.');
        }
        setData(value);
        setShotExponent(value.defaultShotExponent);
        setParameters(value.defaultParameters);
        setBackendId(value.backends.some((item) => item.id === 'noisy-device') ? 'noisy-device' : value.backends[0].id);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const backend = data.backends.find((item) => item.id === backendId) ?? data.backends[0];
    const shots = 2 ** shotExponent;
    const measuredExpectation = clamp(
      data.targetExpectation * backend.visibility + backend.bias,
      -0.999,
      0.999,
    );
    const standardError = Math.sqrt((1 - measuredExpectation ** 2) / shots);
    const halfWidth = data.confidenceZ * standardError;
    const lower = clamp(measuredExpectation - halfWidth, -1, 1);
    const upper = clamp(measuredExpectation + halfWidth, -1, 1);
    const biasError = Math.abs(measuredExpectation - data.targetExpectation);
    const gradientCircuits = parameters * 2;
    const totalShots = shots * gradientCircuits * backend.mitigationMultiplier;
    const wallSeconds = backend.queueSeconds + (totalShots * backend.shotTimeMs) / 1000;
    const signalResolved = lower > 0;
    const biasDominates = biasError > halfWidth;
    const status = !signalResolved
      ? 'Signal unresolved'
      : biasDominates
        ? 'Device bias dominates'
        : 'Signal resolved';
    const explanation = !signalResolved
      ? 'The 95% planning interval crosses zero. More shots can reduce sampling uncertainty, but they cannot repair device bias.'
      : biasDominates
        ? 'Sampling is now precise enough that hardware bias is the larger error. Use calibration, mitigation, or a shallower circuit instead of only adding shots.'
        : 'The interval stays above zero and sampling error remains larger than modeled bias. Validate this approximation with repeated hardware jobs.';

    return {
      backend,
      shots,
      measuredExpectation,
      halfWidth,
      lower,
      upper,
      biasError,
      gradientCircuits,
      totalShots,
      wallSeconds,
      signalResolved,
      biasDominates,
      status,
      explanation,
    };
  }, [backendId, data, parameters, shotExponent]);

  const reset = () => {
    if (!data) return;
    setBackendId(data.backends.some((item) => item.id === 'noisy-device') ? 'noisy-device' : data.backends[0].id);
    setShotExponent(data.defaultShotExponent);
    setParameters(data.defaultParameters);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading quantum measurement budget lab"
      />
    );
  }

  const statusTone = !result.signalResolved
    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
    : result.biasDominates
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35';
  const intervalLeft = clamp(((result.lower + 0.5) / 1.25) * 100, 0, 100);
  const intervalRight = clamp(((result.upper + 0.5) / 1.25) * 100, 0, 100);
  const measuredPosition = clamp(((result.measuredExpectation + 0.5) / 1.25) * 100, 0, 100);
  const targetPosition = clamp(((data.targetExpectation + 0.5) / 1.25) * 100, 0, 100);

  return (
    <div data-content-block="ml-systems/quantum-ml-measurement-budget-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Measurement budget lab"
          title={data.title}
          description={data.description}
          icon={Atom}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose an execution model
                </legend>
                <div className="mt-3 space-y-2">
                  {data.backends.map((backend) => (
                    <LabChoice
                      key={backend.id}
                      selected={backend.id === result.backend.id}
                      label={backend.label}
                      detail={backend.detail}
                      icon={Cpu}
                      accent="violet"
                      onClick={() => setBackendId(backend.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Allocate the measurement budget
                </legend>
                <LabRange
                  label="Shots per expectation"
                  value={shotExponent}
                  output={result.shots.toLocaleString()}
                  min={5}
                  max={13}
                  accent="cyan"
                  lowLabel="Fast, uncertain"
                  highLabel="Precise, expensive"
                  onChange={setShotExponent}
                />
                <LabRange
                  label="Trainable parameters"
                  value={parameters}
                  output={String(parameters)}
                  min={2}
                  max={24}
                  step={2}
                  accent="amber"
                  lowLabel="Shallow circuit"
                  highLabel="More gradient circuits"
                  onChange={setParameters}
                />
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Observable estimate
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Pauli expectation on {result.backend.label}
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${statusTone}`}>
                {result.signalResolved && !result.biasDominates ? (
                  <Gauge aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                )}
                {result.status}
              </span>
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span>-0.50</span>
                <span>Planning range for the observable</span>
                <span>+0.75</span>
              </div>
              <div className="relative mt-4 h-14" aria-label={`95% interval from ${result.lower.toFixed(3)} to ${result.upper.toFixed(3)}`}>
                <div className="absolute left-0 right-0 top-6 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div
                  className="absolute top-4 h-6 rounded-md border border-cyan-500 bg-cyan-200/80 dark:border-cyan-400 dark:bg-cyan-900"
                  style={{ left: `${intervalLeft}%`, width: `${Math.max(1.5, intervalRight - intervalLeft)}%` }}
                />
                <div
                  className="absolute top-1 h-11 w-px bg-amber-500"
                  style={{ left: `${targetPosition}%` }}
                  title="Noise-free target"
                />
                <div
                  className="absolute top-3 h-8 w-1 -translate-x-1/2 rounded-full bg-violet-600 dark:bg-violet-300"
                  style={{ left: `${measuredPosition}%` }}
                  title="Expected measured value"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="inline-flex items-center gap-2"><span className="h-3 w-1 bg-amber-500" /> Noise-free target {data.targetExpectation.toFixed(2)}</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-1 rounded-full bg-violet-600 dark:bg-violet-300" /> Expected measured {result.measuredExpectation.toFixed(3)}</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-4 rounded-sm border border-cyan-500 bg-cyan-200 dark:bg-cyan-900" /> 95% interval</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric
                label="95% half-width"
                value={`±${result.halfWidth.toFixed(3)}`}
                detail={`${result.shots.toLocaleString()} independent shots per expectation`}
                icon={Activity}
                tone={result.signalResolved ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Modeled device bias"
                value={result.biasError.toFixed(3)}
                detail="Absolute distance from the noise-free expectation"
                icon={Target}
                tone={result.biasDominates ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Gradient circuits"
                value={result.gradientCircuits.toLocaleString()}
                detail="Two parameter-shift evaluations per trainable parameter"
                icon={Layers3}
                tone="violet"
              />
              <LabMetric
                label="Total circuit shots"
                value={result.totalShots.toLocaleString()}
                detail={`${result.backend.mitigationMultiplier}x mitigation execution multiplier`}
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label="Modeled job time"
                value={formatDuration(result.wallSeconds)}
                detail="Queue plus shot execution; compilation and optimizer steps excluded"
                icon={Clock3}
                tone="neutral"
              />
            </div>

            <div className={`mt-5 rounded-md border p-4 ${statusTone}`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">What the budget means</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.explanation}
              </p>
            </div>
            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This deterministic model uses the independent-shot normal approximation. Correlated noise, calibration drift, noncommuting observables, and optimizer repetitions can increase the real budget.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
