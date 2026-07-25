'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Hand,
  HeartPulse,
  LoaderCircle,
  MessageSquareText,
  MousePointer2,
  OctagonX,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/neural-interface-architecture-command-safety-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/neural-interface-architecture/data/command-safety-model.json';

const IMPACTS = ['low', 'medium', 'high'] as const;
type Impact = (typeof IMPACTS)[number];

type NumericBound = {
  min: number;
  max: number;
  step: number;
};

type SignalScenario = {
  id: string;
  label: string;
  detail: string;
  confidencePercent: number;
  artifactPercent: number;
  calibrationAgeHours: number;
  frameAgeMs: number;
  outputHeartbeat: boolean;
};

type CommandClass = {
  id: string;
  label: string;
  detail: string;
  impact: Impact;
  maximumFrameAgeMs: number;
  confirmationMarginPercent: number;
  alwaysConfirm: boolean;
  safeState: string;
};

type CommandSafetyModel = {
  kind: 'neural-command-safety';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    commandClassId: string;
    minimumConfidencePercent: number;
    maximumArtifactPercent: number;
    maximumCalibrationAgeHours: number;
  };
  bounds: {
    minimumConfidencePercent: NumericBound;
    maximumArtifactPercent: NumericBound;
    maximumCalibrationAgeHours: NumericBound;
  };
  scenarios: SignalScenario[];
  commandClasses: CommandClass[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isBound(value: unknown): value is NumericBound {
  return Boolean(
    isRecord(value)
      && typeof value.min === 'number'
      && typeof value.max === 'number'
      && typeof value.step === 'number'
      && value.min < value.max
      && value.step > 0,
  );
}

function isCommandSafetyModel(value: unknown): value is CommandSafetyModel {
  if (
    !isRecord(value)
    || value.kind !== 'neural-command-safety'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.scenarioId !== 'string'
    || typeof value.defaults.commandClassId !== 'string'
    || typeof value.defaults.minimumConfidencePercent !== 'number'
    || typeof value.defaults.maximumArtifactPercent !== 'number'
    || typeof value.defaults.maximumCalibrationAgeHours !== 'number'
    || !isRecord(value.bounds)
    || !isBound(value.bounds.minimumConfidencePercent)
    || !isBound(value.bounds.maximumArtifactPercent)
    || !isBound(value.bounds.maximumCalibrationAgeHours)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 4
    || !Array.isArray(value.commandClasses)
    || value.commandClasses.length < 3
  ) {
    return false;
  }

  const scenariosValid = value.scenarios.every((scenario) => (
    isRecord(scenario)
    && typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && typeof scenario.confidencePercent === 'number'
    && scenario.confidencePercent >= 0
    && scenario.confidencePercent <= 100
    && typeof scenario.artifactPercent === 'number'
    && scenario.artifactPercent >= 0
    && scenario.artifactPercent <= 100
    && typeof scenario.calibrationAgeHours === 'number'
    && scenario.calibrationAgeHours >= 0
    && typeof scenario.frameAgeMs === 'number'
    && scenario.frameAgeMs >= 0
    && typeof scenario.outputHeartbeat === 'boolean'
  ));
  const classesValid = value.commandClasses.every((commandClass) => (
    isRecord(commandClass)
    && typeof commandClass.id === 'string'
    && typeof commandClass.label === 'string'
    && typeof commandClass.detail === 'string'
    && typeof commandClass.impact === 'string'
    && IMPACTS.includes(commandClass.impact as Impact)
    && typeof commandClass.maximumFrameAgeMs === 'number'
    && commandClass.maximumFrameAgeMs > 0
    && typeof commandClass.confirmationMarginPercent === 'number'
    && commandClass.confirmationMarginPercent >= 0
    && typeof commandClass.alwaysConfirm === 'boolean'
    && typeof commandClass.safeState === 'string'
  ));

  if (!scenariosValid || !classesValid) return false;

  const defaults = value.defaults as CommandSafetyModel['defaults'];
  return (
    value.scenarios.some((scenario) => scenario.id === defaults.scenarioId)
    && value.commandClasses.some(
      (commandClass) => commandClass.id === defaults.commandClassId,
    )
  );
}

function scenarioIcon(id: string) {
  if (id === 'nominal') return HeartPulse;
  if (id === 'artifact-burst') return Waves;
  if (id === 'stale-calibration') return RefreshCw;
  return TimerOff;
}

function commandIcon(id: string) {
  if (id === 'cursor') return MousePointer2;
  if (id === 'selection') return MessageSquareText;
  return Hand;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-56 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          {error} Retry
        </button>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
          Loading command-policy fixture...
        </>
      )}
    </div>
  );
}

export default function NeuralInterfaceCommandSafetyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CommandSafetyModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCommandSafetyModel(payload)) {
          throw new Error('The command-policy fixture is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the command-policy fixture.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Command safety lab"
            title="Decide whether evidence permits a command"
            description="Loading the illustrative evidence and policy contract."
            icon={ShieldCheck}
            accent="rose"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <CommandSafetyLab model={model} />
    </div>
  );
}

function CommandSafetyLab({ model }: { model: CommandSafetyModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [commandClassId, setCommandClassId] = useState(
    model.defaults.commandClassId,
  );
  const [minimumConfidencePercent, setMinimumConfidencePercent] = useState(
    model.defaults.minimumConfidencePercent,
  );
  const [maximumArtifactPercent, setMaximumArtifactPercent] = useState(
    model.defaults.maximumArtifactPercent,
  );
  const [maximumCalibrationAgeHours, setMaximumCalibrationAgeHours] = useState(
    model.defaults.maximumCalibrationAgeHours,
  );

  const scenario =
    model.scenarios.find((candidate) => candidate.id === scenarioId)
    ?? model.scenarios[0];
  const commandClass =
    model.commandClasses.find((candidate) => candidate.id === commandClassId)
    ?? model.commandClasses[0];

  const decision = useMemo(() => {
    const gates = [
      {
        id: 'heartbeat',
        label: 'Output heartbeat',
        observed: scenario.outputHeartbeat ? 'Live' : 'Missing',
        limit: 'Required',
        clears: scenario.outputHeartbeat,
        failure: 'The output device cannot acknowledge a bounded command.',
        icon: HeartPulse,
      },
      {
        id: 'frame-age',
        label: 'Frame freshness',
        observed: `${scenario.frameAgeMs} ms`,
        limit: `<= ${commandClass.maximumFrameAgeMs} ms`,
        clears: scenario.frameAgeMs <= commandClass.maximumFrameAgeMs,
        failure: 'The source frame is older than this command class permits.',
        icon: Clock3,
      },
      {
        id: 'calibration-age',
        label: 'Calibration age',
        observed: `${scenario.calibrationAgeHours} h`,
        limit: `<= ${maximumCalibrationAgeHours} h`,
        clears:
          scenario.calibrationAgeHours <= maximumCalibrationAgeHours,
        failure: 'The active calibration is outside the configured freshness limit.',
        icon: RefreshCw,
      },
      {
        id: 'artifact',
        label: 'Artifact estimate',
        observed: `${scenario.artifactPercent}%`,
        limit: `<= ${maximumArtifactPercent}%`,
        clears: scenario.artifactPercent <= maximumArtifactPercent,
        failure: 'The signal artifact estimate exceeds the configured limit.',
        icon: Activity,
      },
      {
        id: 'confidence',
        label: 'Decoder confidence',
        observed: `${scenario.confidencePercent}%`,
        limit: `>= ${minimumConfidencePercent}%`,
        clears: scenario.confidencePercent >= minimumConfidencePercent,
        failure: 'Decoder confidence is below the configured command threshold.',
        icon: BrainCircuit,
      },
    ];
    const failedGates = gates.filter((gate) => !gate.clears);
    const heartbeatFailed = !gates[0].clears;
    const needsConfirmation =
      commandClass.alwaysConfirm
      || scenario.confidencePercent
        < minimumConfidencePercent + commandClass.confirmationMarginPercent;

    if (heartbeatFailed) {
      return {
        kind: 'safe-stop' as const,
        title: 'Enter the device-defined safe state',
        summary:
          'A missing output heartbeat overrides decoder confidence. Block new commands and verify downstream state before recovery.',
        gates,
        failedGates,
      };
    }

    if (failedGates.length > 0) {
      return {
        kind: 'hold' as const,
        title: 'Hold the command',
        summary:
          'At least one evidence gate failed. Keep output bounded while the system reacquires, recalibrates, or receives a fresh frame.',
        gates,
        failedGates,
      };
    }

    if (needsConfirmation) {
      return {
        kind: 'confirm' as const,
        title: 'Require independent confirmation',
        summary: commandClass.alwaysConfirm
          ? 'This command class requires confirmation even when every evidence gate clears.'
          : `Confidence clears the gate but remains within the ${commandClass.confirmationMarginPercent}-point confirmation margin.`,
        gates,
        failedGates,
      };
    }

    return {
      kind: 'permit' as const,
      title: 'Permit one bounded command',
      summary:
        'Fresh evidence clears every configured gate. The output envelope, acknowledgement, watchdog, and stop path still remain active.',
      gates,
      failedGates,
    };
  }, [
    commandClass,
    maximumArtifactPercent,
    maximumCalibrationAgeHours,
    minimumConfidencePercent,
    scenario,
  ]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setCommandClassId(model.defaults.commandClassId);
    setMinimumConfidencePercent(model.defaults.minimumConfidencePercent);
    setMaximumArtifactPercent(model.defaults.maximumArtifactPercent);
    setMaximumCalibrationAgeHours(
      model.defaults.maximumCalibrationAgeHours,
    );
  }

  const decisionStyles = {
    'safe-stop': {
      tone: 'rose' as const,
      icon: OctagonX,
      className:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
      eyebrow: 'Safe stop',
    },
    hold: {
      tone: 'amber' as const,
      icon: Ban,
      className:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
      eyebrow: 'Command held',
    },
    confirm: {
      tone: 'violet' as const,
      icon: CircleAlert,
      className:
        'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50',
      eyebrow: 'Confirmation boundary',
    },
    permit: {
      tone: 'emerald' as const,
      icon: CheckCircle2,
      className:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
      eyebrow: 'Policy permits',
    },
  };
  const style = decisionStyles[decision.kind];
  const DecisionIcon = style.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Command safety lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a signal condition
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => {
                  const Icon = scenarioIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'nominal' ? 'emerald' : 'rose'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Command class
              </legend>
              <div className="mt-3 grid gap-2">
                {model.commandClasses.map((item) => {
                  const Icon = commandIcon(item.id);
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === commandClass.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={
                        item.impact === 'high'
                          ? 'rose'
                          : item.impact === 'medium'
                            ? 'violet'
                            : 'blue'
                      }
                      onClick={() => setCommandClassId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <LabRange
                label="Minimum confidence"
                value={minimumConfidencePercent}
                output={`${minimumConfidencePercent}%`}
                min={model.bounds.minimumConfidencePercent.min}
                max={model.bounds.minimumConfidencePercent.max}
                step={model.bounds.minimumConfidencePercent.step}
                lowLabel="Permissive"
                highLabel="Strict"
                accent="violet"
                onChange={setMinimumConfidencePercent}
              />
              <LabRange
                label="Maximum artifact"
                value={maximumArtifactPercent}
                output={`${maximumArtifactPercent}%`}
                min={model.bounds.maximumArtifactPercent.min}
                max={model.bounds.maximumArtifactPercent.max}
                step={model.bounds.maximumArtifactPercent.step}
                lowLabel="Strict"
                highLabel="Permissive"
                accent="amber"
                onChange={setMaximumArtifactPercent}
              />
              <LabRange
                label="Maximum calibration age"
                value={maximumCalibrationAgeHours}
                output={`${maximumCalibrationAgeHours} h`}
                min={model.bounds.maximumCalibrationAgeHours.min}
                max={model.bounds.maximumCalibrationAgeHours.max}
                step={model.bounds.maximumCalibrationAgeHours.step}
                lowLabel="Fresh only"
                highLabel="Longer window"
                accent="blue"
                onChange={setMaximumCalibrationAgeHours}
              />
            </div>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Command impact"
              value={commandClass.impact}
              detail={commandClass.alwaysConfirm ? 'Confirmation required' : 'Policy dependent'}
              icon={Hand}
              tone={
                commandClass.impact === 'high'
                  ? 'rose'
                  : commandClass.impact === 'medium'
                    ? 'violet'
                    : 'blue'
              }
            />
            <LabMetric
              label="Confidence"
              value={`${scenario.confidencePercent}%`}
              detail={`${minimumConfidencePercent}% minimum`}
              icon={BrainCircuit}
              tone={
                scenario.confidencePercent >= minimumConfidencePercent
                  ? 'emerald'
                  : 'rose'
              }
            />
            <LabMetric
              label="Artifact estimate"
              value={`${scenario.artifactPercent}%`}
              detail={`${maximumArtifactPercent}% maximum`}
              icon={Activity}
              tone={
                scenario.artifactPercent <= maximumArtifactPercent
                  ? 'emerald'
                  : 'rose'
              }
            />
            <LabMetric
              label="Failed gates"
              value={`${decision.failedGates.length}`}
              detail={`${decision.gates.length} independent checks`}
              icon={decision.failedGates.length > 0 ? TriangleAlert : BadgeCheck}
              tone={decision.failedGates.length > 0 ? 'rose' : 'emerald'}
            />
          </div>

          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence gates
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Every required check must clear
                </h4>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {scenario.label} x {commandClass.label}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {decision.gates.map((gate) => {
                const GateIcon = gate.icon;
                return (
                  <div
                    key={gate.id}
                    className={`rounded-md border p-4 ${
                      gate.clears
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <GateIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {gate.clears ? (
                        <CheckCircle2 aria-label="Pass" className="h-4 w-4 shrink-0" />
                      ) : (
                        <OctagonX aria-label="Fail" className="h-4 w-4 shrink-0" />
                      )}
                    </div>
                    <p className="mt-3 text-xs font-semibold uppercase opacity-75">
                      {gate.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {gate.observed}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-75">
                      Policy: {gate.limit}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`mt-6 rounded-md border p-5 ${style.className}`}>
            <div className="flex items-start gap-3">
              <DecisionIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">
                  {style.eyebrow}
                </p>
                <h4 className="mt-1 text-xl font-semibold">{decision.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {decision.summary}
                </p>
              </div>
            </div>

            {decision.failedGates.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-current/20 pt-4 text-sm">
                {decision.failedGates.map((gate) => (
                  <li key={gate.id} className="flex items-start gap-2">
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>{gate.failure}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <OctagonX aria-hidden="true" className="h-4 w-4" />
                Defined safe state
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">
                {commandClass.safeState}
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Authority boundary
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                The gate can block the decoder. Permitted output still remains inside
                rate, range, acknowledgement, watchdog, and user-stop limits.
              </p>
            </div>
          </section>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
