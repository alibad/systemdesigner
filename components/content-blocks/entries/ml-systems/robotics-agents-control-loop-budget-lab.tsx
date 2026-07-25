'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Network,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/robotics-agents-control-loop-budget-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/robotics-agents/data/control-loop-budgets.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  deadlineMs: number;
  sensorAgeMs: number;
  planningMs: number;
  safetyMs: number;
  commandMs: number;
  reserveMs: number;
  speedMps: number;
};

type Placement = {
  id: string;
  label: string;
  detail: string;
  networkMs: number;
  jitterMs: number;
  defaultInferenceMs: number;
  availability: string;
};

type LabData = {
  blockId: string;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    placementId: string;
    inferenceMs: number;
  };
  scenarios: Scenario[];
  placements: Placement[];
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
      typeof data.defaults.scenarioId === 'string' &&
      typeof data.defaults.placementId === 'string' &&
      typeof data.defaults.inferenceMs === 'number' &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length >= 3 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.deadlineMs === 'number' &&
          typeof scenario.reserveMs === 'number' &&
          typeof scenario.speedMps === 'number',
      ) &&
      Array.isArray(data.placements) &&
      data.placements.length >= 3 &&
      data.placements.every(
        (placement) =>
          typeof placement.id === 'string' &&
          typeof placement.networkMs === 'number' &&
          typeof placement.jitterMs === 'number' &&
          typeof placement.defaultInferenceMs === 'number',
      ),
  );
}

function BlockState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[520px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? 'Control-loop budget lab unavailable' : 'Loading control-loop budget lab'}
      >
        {error ? (
          <>
            <p className="font-semibold">Control-loop budget lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function RoboticsAgentsControlLoopBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [placementId, setPlacementId] = useState('');
  const [inferenceMs, setInferenceMs] = useState(42);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The control-loop model has an invalid contract.');
        setData(value);
        setScenarioId(value.defaults.scenarioId);
        setPlacementId(value.defaults.placementId);
        setInferenceMs(value.defaults.inferenceMs);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const placement = data.placements.find((item) => item.id === placementId) ?? data.placements[0];
    if (!scenario || !placement) return null;

    const transportMs = placement.networkMs + placement.jitterMs;
    const decisionMs =
      scenario.sensorAgeMs +
      inferenceMs +
      transportMs +
      scenario.planningMs +
      scenario.safetyMs +
      scenario.commandMs;
    const computeBoundaryMs = scenario.deadlineMs - scenario.reserveMs;
    const marginMs = computeBoundaryMs - decisionMs;
    const exposedDistanceCm = scenario.speedMps * (decisionMs / 1000) * 100;
    const maximumLoopHz = 1000 / decisionMs;
    const status = marginMs >= 0 ? 'ready' : marginMs >= -25 ? 'thin' : 'late';
    const stages = [
      { id: 'sense', label: 'Sensor age', value: scenario.sensorAgeMs, tone: 'bg-blue-500' },
      { id: 'infer', label: 'Model inference', value: inferenceMs, tone: 'bg-violet-500' },
      { id: 'network', label: 'Network + jitter', value: transportMs, tone: 'bg-amber-500' },
      {
        id: 'plan',
        label: 'Plan + authorize',
        value: scenario.planningMs + scenario.safetyMs,
        tone: 'bg-cyan-500',
      },
      { id: 'command', label: 'Command path', value: scenario.commandMs, tone: 'bg-emerald-500' },
    ];

    return {
      computeBoundaryMs,
      decisionMs,
      exposedDistanceCm,
      marginMs,
      maximumLoopHz,
      placement,
      scenario,
      stages,
      status,
    };
  }, [data, inferenceMs, placementId, scenarioId]);

  if (loadError) return <BlockState error={loadError} />;
  if (!data) return <BlockState />;
  if (!model) return <BlockState error="The selected scenario or placement is missing." />;

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setPlacementId(data.defaults.placementId);
    setInferenceMs(data.defaults.inferenceMs);
  };

  const choosePlacement = (placement: Placement) => {
    setPlacementId(placement.id);
    setInferenceMs(placement.defaultInferenceMs);
  };

  const outcome =
    model.status === 'ready'
      ? {
          title: 'The path preserves its response reserve',
          detail: `${Math.round(model.marginMs)} ms remains before the reserved stopping or fallback window begins.`,
          style:
            'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
          icon: CheckCircle2,
        }
      : model.status === 'thin'
        ? {
            title: 'The tail has consumed the reserve',
            detail:
              'The nominal deadline is close, but the required fallback time is no longer protected. Reduce tail latency or narrow the operating envelope.',
            style:
              'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
            icon: AlertTriangle,
          }
        : {
            title: 'This model path is too late for the motion',
            detail:
              'Move inference closer, use a smaller policy, slow the robot, or keep this model outside the time-critical authority path.',
            style:
              'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
            icon: AlertTriangle,
          };
  const OutcomeIcon = outcome.icon;
  const scaleMs = Math.max(model.scenario.deadlineMs, model.decisionMs + model.scenario.reserveMs);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Physical latency budget"
          title={data.title}
          description={data.description}
          icon={Timer}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Operating envelope
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === model.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Activity}
                      accent="blue"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Model placement
                </legend>
                <div className="mt-3 space-y-2">
                  {data.placements.map((placement) => (
                    <LabChoice
                      key={placement.id}
                      selected={placement.id === model.placement.id}
                      label={placement.label}
                      detail={placement.detail}
                      icon={placement.networkMs > 0 ? Network : Cpu}
                      accent="violet"
                      onClick={() => choosePlacement(placement)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Model inference p95"
                value={inferenceMs}
                output={`${inferenceMs} ms`}
                min={15}
                max={180}
                step={5}
                lowLabel="Small / warm"
                highLabel="Large / loaded"
                accent="amber"
                onChange={setInferenceMs}
              />
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Sense-to-command trace
                  </p>
                  <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    {model.scenario.label} through {model.placement.label.toLowerCase()}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  Boundary {model.computeBoundaryMs} ms
                </p>
              </div>

              <div
                className="mt-5 flex h-7 w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900"
                aria-label={`Decision path takes ${Math.round(model.decisionMs)} milliseconds`}
              >
                {model.stages.map((stage) => (
                  <span
                    key={stage.id}
                    className={`${stage.tone} min-w-1 border-r border-white/60 last:border-r-0 dark:border-neutral-950/60`}
                    style={{ width: `${Math.max(1.5, (stage.value / scaleMs) * 100)}%` }}
                    title={`${stage.label}: ${stage.value} ms`}
                  />
                ))}
                <span
                  className="min-w-1 bg-neutral-300 dark:bg-neutral-700"
                  style={{ width: `${Math.max(1.5, (model.scenario.reserveMs / scaleMs) * 100)}%` }}
                  title={`Protected response reserve: ${model.scenario.reserveMs} ms`}
                />
              </div>

              <ul className="mt-4 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2 dark:text-neutral-300">
                {model.stages.map((stage) => (
                  <li key={stage.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${stage.tone}`} aria-hidden="true" />
                      <span>{stage.label}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{stage.value} ms</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />
                    <span>Protected response reserve</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {model.scenario.reserveMs} ms
                  </span>
                </li>
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Decision age"
                value={`${Math.round(model.decisionMs)} ms`}
                detail={`Deadline ${model.scenario.deadlineMs} ms`}
                icon={Timer}
                tone={model.status === 'ready' ? 'emerald' : model.status === 'thin' ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Reserve margin"
                value={`${model.marginMs >= 0 ? '+' : ''}${Math.round(model.marginMs)} ms`}
                detail="After protected response time"
                icon={ShieldCheck}
                tone={model.marginMs >= 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Motion exposure"
                value={`${model.exposedDistanceCm.toFixed(1)} cm`}
                detail={`At ${model.scenario.speedMps.toFixed(2)} m/s`}
                icon={Activity}
                tone="amber"
              />
              <LabMetric
                label="Maximum loop rate"
                value={`${model.maximumLoopHz.toFixed(1)} Hz`}
                detail="Before downstream backpressure"
                icon={Gauge}
                tone="blue"
              />
            </div>

            <div className={`rounded-md border p-5 ${outcome.style}`}>
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-lg font-semibold">{outcome.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{outcome.detail}</p>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-75">
                    Availability: {model.placement.availability}
                  </p>
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
