'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  Gauge,
  Layers3,
  Route,
  ShieldAlert,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/world-models/data/latent-state-scenarios.json';
const BLOCK_ID = 'ml-systems/world-models-latent-state-lab';

type RepresentationId = 'latest-observation' | 'belief-state';
type ActionId = 'advance' | 'inspect' | 'wait';

type Representation = {
  id: RepresentationId;
  label: string;
  detail: string;
};

type Action = {
  id: ActionId;
  label: string;
  detail: string;
  riskDelta: number;
  progress: number;
  information: number;
};

type Scenario = {
  id: string;
  label: string;
  context: string;
  cue: string;
  cueSupportsHazard: boolean;
  priorHazard: number;
  defaultSensorReliability: number;
  hiddenState: string;
  safeBoundary: number;
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultRepresentation: RepresentationId;
  defaultAction: ActionId;
  representations: Representation[];
  actions: Action[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      Array.isArray(data.representations) &&
      data.representations.length === 2 &&
      Array.isArray(data.actions) &&
      data.actions.length >= 3 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.id === 'string' &&
          typeof scenario.priorHazard === 'number' &&
          typeof scenario.safeBoundary === 'number',
      ),
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function posteriorHazard(scenario: Scenario, reliability: number) {
  const prior = scenario.priorHazard / 100;
  const accuracy = reliability / 100;
  const likelihoodHazard = scenario.cueSupportsHazard ? accuracy : 1 - accuracy;
  const likelihoodSafe = scenario.cueSupportsHazard ? 1 - accuracy : accuracy;
  const evidence = likelihoodHazard * prior + likelihoodSafe * (1 - prior);
  return evidence === 0 ? scenario.priorHazard : (likelihoodHazard * prior * 100) / evidence;
}

const actionIcons: Record<ActionId, LucideIcon> = {
  advance: Route,
  inspect: Eye,
  wait: Gauge,
};

export default function WorldModelsLatentStateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('occluded-crossing');
  const [representationId, setRepresentationId] =
    useState<RepresentationId>('belief-state');
  const [actionId, setActionId] = useState<ActionId>('inspect');
  const [sensorReliability, setSensorReliability] = useState(78);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load latent-state cases (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The latent-state cases have an invalid contract.');
        const scenario =
          value.scenarios.find((item) => item.id === value.defaultScenario) ?? value.scenarios[0];
        setData(value);
        setScenarioId(scenario.id);
        setRepresentationId(value.defaultRepresentation);
        setActionId(value.defaultAction);
        setSensorReliability(scenario.defaultSensorReliability);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load the lab.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const representation =
      data.representations.find((item) => item.id === representationId) ?? data.representations[0];
    const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];
    const cueRisk = scenario.cueSupportsHazard ? sensorReliability : 100 - sensorReliability;
    const posterior = posteriorHazard(scenario, sensorReliability);
    const inferredRisk = representation.id === 'belief-state' ? posterior : cueRisk;
    const nextRisk = clamp(inferredRisk + action.riskDelta);
    const safe = nextRisk <= scenario.safeBoundary;
    const memoryEffect = posterior - cueRisk;

    return {
      scenario,
      representation,
      action,
      cueRisk,
      posterior,
      inferredRisk,
      nextRisk,
      safe,
      memoryEffect,
    };
  }, [actionId, data, representationId, scenarioId, sensorReliability]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setSensorReliability(scenario.defaultSensorReliability);
  };

  const reset = () => {
    if (!data) return;
    const scenario =
      data.scenarios.find((item) => item.id === data.defaultScenario) ?? data.scenarios[0];
    setScenarioId(scenario.id);
    setRepresentationId(data.defaultRepresentation);
    setActionId(data.defaultAction);
    setSensorReliability(scenario.defaultSensorReliability);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading latent-state lab"
      />
    );
  }

  const ActionIcon = actionIcons[result.action.id];
  const consequence = result.safe
    ? `${result.action.label} keeps predicted hazard below the ${result.scenario.safeBoundary}% control boundary. The controller may execute one bounded step and observe again.`
    : `${result.action.label} leaves predicted hazard above the ${result.scenario.safeBoundary}% control boundary. Gather evidence, choose a safer action, or stop.`;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Latent-state workbench"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a hidden-state problem
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={scenario.context}
                      accent="cyan"
                      onClick={() => chooseScenario(scenario)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Sensor reliability"
                value={sensorReliability}
                output={`${sensorReliability}%`}
                min={55}
                max={99}
                accent="blue"
                lowLabel="Ambiguous"
                highLabel="Reliable"
                onChange={setSensorReliability}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the representation
                </legend>
                <div className="mt-3 space-y-2">
                  {data.representations.map((representation) => (
                    <LabChoice
                      key={representation.id}
                      selected={representation.id === result.representation.id}
                      label={representation.label}
                      detail={representation.detail}
                      accent="violet"
                      onClick={() => setRepresentationId(representation.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose an action
                </legend>
                <div className="mt-3 space-y-2">
                  {data.actions.map((action) => (
                    <LabChoice
                      key={action.id}
                      selected={action.id === result.action.id}
                      label={action.label}
                      detail={action.detail}
                      icon={actionIcons[action.id]}
                      accent="emerald"
                      onClick={() => setActionId(action.id)}
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
                Hidden condition
              </p>
              <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.scenario.hiddenState}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                Current cue: <strong>{result.scenario.cue}</strong>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
              <StateStage
                icon={Eye}
                label="Observation"
                value={`${result.cueRisk.toFixed(0)}% cue risk`}
                detail="Evidence from this sensor sample"
                tone="blue"
              />
              <FlowArrow />
              <StateStage
                icon={Layers3}
                label="Inferred state"
                value={`${result.inferredRisk.toFixed(0)}% hazard`}
                detail={result.representation.label}
                tone="violet"
              />
              <FlowArrow />
              <StateStage
                icon={ActionIcon}
                label="Predicted next state"
                value={`${result.nextRisk.toFixed(0)}% hazard`}
                detail={result.action.label}
                tone={result.safe ? 'emerald' : 'rose'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <span>Predicted hazard</span>
                <span>Boundary {result.scenario.safeBoundary}%</span>
              </div>
              <div className="relative mt-3 h-4 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    result.safe ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${result.nextRisk}%` }}
                />
                <span
                  className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
                  style={{ left: `${result.scenario.safeBoundary}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Prior hazard"
                value={`${result.scenario.priorHazard}%`}
                detail="Belief before the current cue"
                icon={Layers3}
                tone="neutral"
              />
              <LabMetric
                label="Memory effect"
                value={`${result.memoryEffect >= 0 ? '+' : ''}${result.memoryEffect.toFixed(0)} pts`}
                detail="Belief posterior minus cue-only risk"
                icon={Gauge}
                tone="violet"
              />
              <LabMetric
                label="Information gain"
                value={`${result.action.information}/100`}
                detail={`${result.action.progress}/100 progress`}
                icon={Eye}
                tone="cyan"
              />
            </div>

            <div
              className={`rounded-md border p-4 ${
                result.safe
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {result.safe ? 'Inside the control boundary' : 'Control boundary crossed'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-85">{consequence}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 sm:block" />
      <span className="h-6 w-px bg-current sm:hidden" aria-hidden="true" />
    </div>
  );
}

function StateStage({
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
  tone: 'blue' | 'violet' | 'emerald' | 'rose';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
    violet:
      'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100',
    emerald:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}
