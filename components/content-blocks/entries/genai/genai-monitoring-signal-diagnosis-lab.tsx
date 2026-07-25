'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  GitBranch,
  Layers3,
  LoaderCircle,
  Route,
  Search,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type StepState = 'healthy' | 'warning' | 'failed' | 'unknown';

interface TraceStep {
  label: string;
  durationMs: number;
  state: StepState;
  detail: string;
}

interface TraceEvidence {
  id: string;
  sliceId: string;
  outcome: string;
  firstDivergence: string;
  steps: TraceStep[];
}

interface SignalSlice {
  id: string;
  label: string;
  detail: string;
  trafficSharePct: number;
  baselineValue: number;
  currentValue: number;
  traceCoveragePct: number;
  traceId: string;
}

interface SignalScenario {
  id: string;
  label: string;
  brief: string;
  signalLabel: string;
  baselineValue: number;
  currentValue: number;
  unit: '%' | 'ms' | 'USD';
  window: string;
  affectedSliceId: string;
  signalEvidence: string;
  diagnosis: string;
  slices: SignalSlice[];
  traces: TraceEvidence[];
}

interface SignalDiagnosisData {
  title: string;
  description: string;
  defaultScenarioId: string;
  scenarios: SignalScenario[];
}

const BLOCK_ID = 'genai/genai-monitoring-signal-diagnosis-lab';

const stepStyles: Record<StepState, string> = {
  healthy: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  failed: 'bg-rose-500 dark:bg-rose-400',
  unknown: 'bg-neutral-400 dark:bg-neutral-600',
};

const stepLabels: Record<StepState, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  failed: 'Failed',
  unknown: 'Mixed evidence',
};

function isSignalDiagnosisData(value: unknown): value is SignalDiagnosisData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SignalDiagnosisData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.defaultScenarioId === 'string'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.brief === 'string'
        && typeof scenario.signalLabel === 'string'
        && typeof scenario.baselineValue === 'number'
        && typeof scenario.currentValue === 'number'
        && ['%', 'ms', 'USD'].includes(scenario.unit)
        && typeof scenario.window === 'string'
        && typeof scenario.affectedSliceId === 'string'
        && typeof scenario.signalEvidence === 'string'
        && typeof scenario.diagnosis === 'string'
        && Array.isArray(scenario.slices)
        && scenario.slices.length > 0
        && scenario.slices.every((slice) => (
          typeof slice.id === 'string'
          && typeof slice.label === 'string'
          && typeof slice.detail === 'string'
          && typeof slice.trafficSharePct === 'number'
          && typeof slice.baselineValue === 'number'
          && typeof slice.currentValue === 'number'
          && typeof slice.traceCoveragePct === 'number'
          && typeof slice.traceId === 'string'
        ))
        && Array.isArray(scenario.traces)
        && scenario.traces.length > 0
        && scenario.traces.every((trace) => (
          typeof trace.id === 'string'
          && typeof trace.sliceId === 'string'
          && typeof trace.outcome === 'string'
          && typeof trace.firstDivergence === 'string'
          && Array.isArray(trace.steps)
          && trace.steps.length > 0
          && trace.steps.every((step) => (
            typeof step.label === 'string'
            && typeof step.durationMs === 'number'
            && ['healthy', 'warning', 'failed', 'unknown'].includes(step.state)
            && typeof step.detail === 'string'
          ))
        ))
      )),
  );
}

function formatValue(value: number, unit: SignalScenario['unit']) {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'ms') return `${Math.round(value).toLocaleString()} ms`;
  return `$${value.toFixed(3)}`;
}

function formatDelta(value: number, unit: SignalScenario['unit']) {
  const sign = value > 0 ? '+' : '';
  if (unit === '%') return `${sign}${value.toFixed(1)} points`;
  if (unit === 'ms') return `${sign}${Math.round(value).toLocaleString()} ms`;
  return `${sign}$${value.toFixed(3)}`;
}

export default function GenAiMonitoringSignalDiagnosisLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SignalDiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No signal diagnosis data file was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSignalDiagnosisData(payload)) {
          throw new Error('Signal diagnosis data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <SignalDiagnosisLab data={data} />;
}

function SignalDiagnosisLab({ data }: { data: SignalDiagnosisData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [sliceId, setSliceId] = useState(initialScenario.slices[0].id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const selectedSlice = scenario.slices.find((item) => item.id === sliceId)
    ?? scenario.slices[0];
  const trace = scenario.traces.find((item) => item.id === selectedSlice.traceId)
    ?? scenario.traces[0];
  const isAffected = selectedSlice.id === scenario.affectedSliceId;

  const model = useMemo(() => {
    const delta = selectedSlice.currentValue - selectedSlice.baselineValue;
    const totalDuration = trace.steps.reduce((sum, step) => sum + step.durationMs, 0);
    const maxStepDuration = Math.max(...trace.steps.map((step) => step.durationMs), 1);
    const failedSteps = trace.steps.filter((step) => step.state === 'failed').length;
    return { delta, failedSteps, maxStepDuration, totalDuration };
  }, [selectedSlice, trace]);

  function chooseScenario(nextScenario: SignalScenario) {
    setScenarioId(nextScenario.id);
    setSliceId(nextScenario.slices[0].id);
  }

  function reset() {
    setScenarioId(initialScenario.id);
    setSliceId(initialScenario.slices[0].id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Production diagnosis lab"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Production signal
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={item.id === 'groundedness-drop' ? Search : item.id === 'latency-spike' ? Clock3 : Gauge}
                      accent={item.id === 'groundedness-drop' ? 'violet' : item.id === 'latency-spike' ? 'amber' : 'cyan'}
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Population slice
                </legend>
                <div className="mt-3 grid gap-2">
                  {scenario.slices.map((slice) => {
                    const selected = slice.id === selectedSlice.id;
                    return (
                      <button
                        key={slice.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSliceId(slice.id)}
                        className={`rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-300 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-50'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{slice.label}</span>
                            <span className="mt-1 block text-xs leading-5 opacity-75">{slice.detail}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {slice.trafficSharePct}%
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label={scenario.signalLabel}
                value={formatValue(scenario.currentValue, scenario.unit)}
                detail={`${scenario.window}; fleet baseline ${formatValue(scenario.baselineValue, scenario.unit)}`}
                icon={Activity}
                tone="violet"
              />
              <LabMetric
                label="Selected slice delta"
                value={formatDelta(model.delta, scenario.unit)}
                detail={`${selectedSlice.traceCoveragePct}% trace coverage across ${selectedSlice.trafficSharePct}% of traffic`}
                icon={Layers3}
                tone={isAffected ? 'rose' : 'neutral'}
              />
            </div>

            <section aria-label="Investigation path">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-2 rounded-md bg-violet-50 px-2.5 py-1.5 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                  <Activity aria-hidden="true" className="h-3.5 w-3.5" />
                  Signal
                </span>
                <span aria-hidden="true">→</span>
                <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                  <GitBranch aria-hidden="true" className="h-3.5 w-3.5" />
                  {selectedSlice.label}
                </span>
                <span aria-hidden="true">→</span>
                <span className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-2.5 py-1.5 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  <Route aria-hidden="true" className="h-3.5 w-3.5" />
                  {trace.id}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                {scenario.signalEvidence}
              </p>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Representative trace
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {trace.firstDivergence}
                  </h4>
                </div>
                <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {model.totalDuration.toLocaleString()} ms observed
                </span>
              </div>

              <ol className="mt-5 space-y-4">
                {trace.steps.map((step, index) => (
                  <li key={`${step.label}-${index}`} className="grid gap-2 sm:grid-cols-[110px_minmax(0,1fr)_92px] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {step.label}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{stepLabels[step.state]}</p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-sm ${stepStyles[step.state]}`}
                        style={{ width: `${Math.max(8, (step.durationMs / model.maxStepDuration) * 100)}%` }}
                      />
                    </div>
                    <span className="text-left text-xs font-semibold tabular-nums text-neutral-600 sm:text-right dark:text-neutral-300">
                      {step.durationMs.toLocaleString()} ms
                    </span>
                    <p className="text-xs leading-5 text-neutral-600 sm:col-start-2 sm:col-span-2 dark:text-neutral-400">
                      {step.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className={`rounded-md border p-4 ${
                isAffected
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {isAffected ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">
                    {isAffected ? 'The failure boundary is visible' : 'This slice does not explain the alert'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{trace.outcome}</p>
                  <p className="mt-3 text-sm font-semibold leading-6">
                    {isAffected
                      ? scenario.diagnosis
                      : 'Compare this healthy peer with the affected slice before changing the system.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading signal diagnosis lab...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Signal diagnosis lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
