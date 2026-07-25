'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Gauge,
  LocateFixed,
  Route,
  ShieldAlert,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/autonomous-systems-closed-loop-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/autonomous-systems/data/closed-loop-scenarios.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  environment: string;
  speedMps: number;
  obstacleDistanceM: number;
  reactionBudgetMs: number;
  maxDecelerationMps2: number;
  localizationUncertaintyM: number;
  minimumClearanceM: number;
  defaultSensorReliability: number;
};

type EvidenceMode = {
  id: string;
  label: string;
  detail: string;
  confidenceMultiplier: number;
  uncertaintyMultiplier: number;
  pipelineDelayMs: number;
};

type PlanningMode = {
  id: string;
  label: string;
  detail: string;
  speedMultiplier: number;
  reactionMultiplier: number;
  clearanceMultiplier: number;
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    evidenceModeId: string;
    planningModeId: string;
    sensorReliability: number;
  };
  scenarios: Scenario[];
  evidenceModes: EvidenceMode[];
  planningModes: PlanningMode[];
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
      data.scenarios.length >= 3 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.speedMps === 'number' &&
          typeof scenario.obstacleDistanceM === 'number' &&
          typeof scenario.maxDecelerationMps2 === 'number',
      ) &&
      Array.isArray(data.evidenceModes) &&
      data.evidenceModes.length >= 3 &&
      Array.isArray(data.planningModes) &&
      data.planningModes.length >= 3,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function LabState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <div
        className={`not-prose my-7 min-h-[560px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'animate-pulse border-neutral-200 bg-neutral-100 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? 'Closed-loop workbench unavailable' : 'Loading closed-loop workbench'}
      >
        {error ? (
          <>
            <p className="font-semibold">Closed-loop workbench unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

const stageTones = {
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
  violet:
    'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  amber:
    'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  emerald:
    'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
};

function DecisionStage({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: keyof typeof stageTones;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-4 ${stageTones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      <p className="mt-3 break-words text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function StageConnector() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 xl:block" />
      <ArrowDown aria-hidden="true" className="h-5 w-5 xl:hidden" />
    </div>
  );
}

export default function AutonomousSystemsClosedLoopLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('warehouse-crossing');
  const [evidenceModeId, setEvidenceModeId] = useState('tracked-belief');
  const [planningModeId, setPlanningModeId] = useState('balanced');
  const [sensorReliability, setSensorReliability] = useState(86);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The autonomy scenarios have an invalid contract.');
        const scenario =
          value.scenarios.find((item) => item.id === value.defaults.scenarioId) ??
          value.scenarios[0];
        setData(value);
        setScenarioId(scenario.id);
        setEvidenceModeId(value.defaults.evidenceModeId);
        setPlanningModeId(value.defaults.planningModeId);
        setSensorReliability(scenario.defaultSensorReliability);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the workbench.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const evidenceMode =
      data.evidenceModes.find((item) => item.id === evidenceModeId) ?? data.evidenceModes[0];
    const planningMode =
      data.planningModes.find((item) => item.id === planningModeId) ?? data.planningModes[0];
    if (!scenario || !evidenceMode || !planningMode) return null;

    const effectiveConfidence = clamp(
      sensorReliability * evidenceMode.confidenceMultiplier,
      0,
      99,
    );
    const stateUncertaintyM =
      scenario.localizationUncertaintyM * evidenceMode.uncertaintyMultiplier +
      (100 - effectiveConfidence) * 0.018;
    const commandedSpeedMps = scenario.speedMps * planningMode.speedMultiplier;
    const reactionTimeS =
      ((scenario.reactionBudgetMs + evidenceMode.pipelineDelayMs) *
        planningMode.reactionMultiplier) /
      1000;
    const stoppingDistanceM =
      commandedSpeedMps * reactionTimeS +
      (commandedSpeedMps * commandedSpeedMps) / (2 * scenario.maxDecelerationMps2);
    const clearanceReserveM = scenario.minimumClearanceM * planningMode.clearanceMultiplier;
    const requiredDistanceM = stoppingDistanceM + clearanceReserveM + stateUncertaintyM;
    const distanceMarginM = scenario.obstacleDistanceM - requiredDistanceM;
    const confidencePass = effectiveConfidence >= 75;

    let authority: 'execute' | 'reduced' | 'withhold';
    let outcome: string;
    if (!confidencePass) {
      authority = 'withhold';
      outcome =
        'The state estimate is below the evidence boundary. Reobserve, use a redundant modality, or enter the bounded fallback controller.';
    } else if (distanceMarginM < 0) {
      authority = 'withhold';
      outcome =
        'The plan consumes more distance than is available. The safety gate must reject it and command braking or hold.';
    } else if (distanceMarginM < 1.2 || effectiveConfidence < 85) {
      authority = 'reduced';
      outcome =
        'The plan fits narrowly. Grant limited authority for one short control interval, then sense and estimate again.';
    } else {
      authority = 'execute';
      outcome =
        'The plan is inside both evidence and distance boundaries. Execute one bounded control step and verify the measured response.';
    }

    return {
      authority,
      clearanceReserveM,
      commandedSpeedMps,
      distanceMarginM,
      effectiveConfidence,
      evidenceMode,
      outcome,
      planningMode,
      requiredDistanceM,
      scenario,
      stateUncertaintyM,
      stoppingDistanceM,
    };
  }, [data, evidenceModeId, planningModeId, scenarioId, sensorReliability]);

  if (loadError) return <LabState error={loadError} />;
  if (!data) return <LabState />;
  if (!model) return <LabState error="The selected scenario, evidence path, or plan is missing." />;

  const reset = () => {
    const scenario =
      data.scenarios.find((item) => item.id === data.defaults.scenarioId) ?? data.scenarios[0];
    setScenarioId(scenario.id);
    setEvidenceModeId(data.defaults.evidenceModeId);
    setPlanningModeId(data.defaults.planningModeId);
    setSensorReliability(scenario.defaultSensorReliability);
  };
  const authorityTone =
    model.authority === 'execute' ? 'emerald' : model.authority === 'reduced' ? 'amber' : 'rose';
  const AuthorityIcon = model.authority === 'execute' ? CheckCircle2 : ShieldAlert;
  const authorityLabel =
    model.authority === 'execute'
      ? 'Bounded command allowed'
      : model.authority === 'reduced'
        ? 'Reduced authority only'
        : 'Command withheld';
  const meterScale = Math.max(model.scenario.obstacleDistanceM, model.requiredDistanceM) * 1.08;
  const requiredWidth = clamp((model.requiredDistanceM / meterScale) * 100, 0, 100);
  const availablePosition = clamp(
    (model.scenario.obstacleDistanceM / meterScale) * 100,
    0,
    100,
  );

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Closed-loop decision workbench"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Operating scenario
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === model.scenario.id}
                      label={scenario.label}
                      detail={scenario.detail}
                      icon={Route}
                      accent="blue"
                      onClick={() => {
                        setScenarioId(scenario.id);
                        setSensorReliability(scenario.defaultSensorReliability);
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Raw sensing reliability"
                value={sensorReliability}
                output={`${sensorReliability}%`}
                min={55}
                max={99}
                accent="cyan"
                lowLabel="Conflicting evidence"
                highLabel="Reliable evidence"
                onChange={setSensorReliability}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Evidence path
                </legend>
                <div className="mt-3 space-y-2">
                  {data.evidenceModes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={mode.id === model.evidenceMode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={LocateFixed}
                      accent="violet"
                      onClick={() => setEvidenceModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Planning posture
                </legend>
                <div className="mt-3 space-y-2">
                  {data.planningModes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={mode.id === model.planningMode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={Gauge}
                      accent="amber"
                      onClick={() => setPlanningModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Current operating context
              </p>
              <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                {model.scenario.environment}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                Obstacle evidence is {model.scenario.obstacleDistanceM.toFixed(1)} m ahead of a
                system moving at {model.scenario.speedMps.toFixed(1)} m/s before planning limits.
              </p>
            </div>

            <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-stretch">
              <DecisionStage
                icon={Camera}
                label="Perceive"
                value={`${model.effectiveConfidence.toFixed(0)}% trusted`}
                detail={`${model.evidenceMode.pipelineDelayMs} ms evidence-path delay`}
                tone="blue"
              />
              <StageConnector />
              <DecisionStage
                icon={LocateFixed}
                label="Estimate state"
                value={`+/-${model.stateUncertaintyM.toFixed(2)} m`}
                detail={model.evidenceMode.label}
                tone="violet"
              />
              <StageConnector />
              <DecisionStage
                icon={Route}
                label="Plan"
                value={`${model.requiredDistanceM.toFixed(2)} m needed`}
                detail={model.planningMode.label}
                tone="amber"
              />
              <StageConnector />
              <DecisionStage
                icon={AuthorityIcon}
                label="Control authority"
                value={authorityLabel}
                detail="One control interval, then observe again"
                tone={authorityTone}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <span>Required stopping envelope</span>
                <span>Available {model.scenario.obstacleDistanceM.toFixed(1)} m</span>
              </div>
              <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    model.distanceMarginM >= 0 ? 'bg-cyan-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${requiredWidth}%` }}
                />
                <span
                  className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                  style={{ left: `${availablePosition}%` }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Stopping distance + clearance reserve + state uncertainty must stay left of the
                available-distance marker.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Commanded speed"
                value={`${model.commandedSpeedMps.toFixed(2)} m/s`}
                detail={`Nominal ${model.scenario.speedMps.toFixed(1)} m/s`}
                icon={Gauge}
                tone="blue"
              />
              <LabMetric
                label="Stopping distance"
                value={`${model.stoppingDistanceM.toFixed(2)} m`}
                detail={`${model.clearanceReserveM.toFixed(2)} m clearance added separately`}
                icon={Timer}
                tone="violet"
              />
              <LabMetric
                label="Distance margin"
                value={`${model.distanceMarginM >= 0 ? '+' : ''}${model.distanceMarginM.toFixed(2)} m`}
                detail="After uncertainty and clearance"
                icon={ShieldAlert}
                tone={authorityTone}
              />
            </div>

            <div className={`rounded-md border p-4 ${stageTones[authorityTone]}`}>
              <div className="flex items-start gap-3">
                <AuthorityIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{authorityLabel}</p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{model.outcome}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
