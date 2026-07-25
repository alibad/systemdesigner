'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckSquare2,
  CloudOff,
  Cpu,
  PackageCheck,
  Radio,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Square,
  ThermometerSun,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/edge-ml-deployment/data/fleet-rollout-policy.json';
const BLOCK_ID = 'ml-systems/edge-ml-deployment-rollout-lab';

type RolloutStage = {
  id: string;
  label: string;
  percentage: number;
  detail: string;
};

type Fallback = {
  id: string;
  label: string;
  detail: string;
  availableOffline: boolean;
};

type Control = {
  id: string;
  label: string;
  detail: string;
};

type ScenarioMode = 'healthy' | 'rollback' | 'offline' | 'blind';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  mode: ScenarioMode;
  requiredControls: string[];
  consequence: string;
};

type RolloutData = {
  title: string;
  description: string;
  fleetSize: number;
  defaults: {
    stageId: string;
    scenarioId: string;
    fallbackId: string;
    completedControls: string[];
  };
  stages: RolloutStage[];
  fallbacks: Fallback[];
  controls: Control[];
  scenarios: Scenario[];
};

function isRolloutData(value: unknown): value is RolloutData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RolloutData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.fleetSize === 'number'
      && data.defaults
      && typeof data.defaults.stageId === 'string'
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.fallbackId === 'string'
      && Array.isArray(data.defaults.completedControls)
      && Array.isArray(data.stages)
      && data.stages.length >= 3
      && data.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.percentage === 'number'
        && typeof stage.detail === 'string'
      ))
      && Array.isArray(data.fallbacks)
      && data.fallbacks.length >= 2
      && data.fallbacks.every((fallback) => (
        typeof fallback.id === 'string'
        && typeof fallback.label === 'string'
        && typeof fallback.detail === 'string'
        && typeof fallback.availableOffline === 'boolean'
      ))
      && Array.isArray(data.controls)
      && data.controls.length >= 4
      && data.controls.every((control) => (
        typeof control.id === 'string'
        && typeof control.label === 'string'
        && typeof control.detail === 'string'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 4
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && ['healthy', 'rollback', 'offline', 'blind'].includes(scenario.mode)
        && Array.isArray(scenario.requiredControls)
        && scenario.requiredControls.every((id) => typeof id === 'string')
        && typeof scenario.consequence === 'string'
      )),
  );
}

const scenarioIcons = {
  healthy: BadgeCheck,
  rollback: TriangleAlert,
  offline: CloudOff,
  blind: Radio,
} as const;

export default function EdgeMlDeploymentRolloutLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RolloutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageId, setStageId] = useState('canary');
  const [scenarioId, setScenarioId] = useState('healthy');
  const [fallbackId, setFallbackId] = useState('previous-model');
  const [completedControls, setCompletedControls] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRolloutData(payload)) throw new Error('Fleet-rollout policy data is incomplete.');
        setData(payload);
        setStageId(payload.defaults.stageId);
        setScenarioId(payload.defaults.scenarioId);
        setFallbackId(payload.defaults.fallbackId);
        setCompletedControls(payload.defaults.completedControls);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const stage = data?.stages.find((item) => item.id === stageId) ?? data?.stages[0];
  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const fallback = data?.fallbacks.find((item) => item.id === fallbackId) ?? data?.fallbacks[0];

  const result = useMemo(() => {
    if (!data || !stage || !scenario || !fallback) return null;
    const enrolledDevices = Math.round(data.fleetSize * (stage.percentage / 100));
    const required = data.controls.filter((control) => scenario.requiredControls.includes(control.id));
    const missing = required.filter((control) => !completedControls.includes(control.id));
    const nextStageIndex = Math.min(data.stages.length - 1, data.stages.indexOf(stage) + 1);
    const nextStage = data.stages[nextStageIndex];

    if (scenario.mode === 'healthy') {
      return missing.length === 0
        ? {
            action: stage.percentage === 100 ? 'Keep serving and monitor' : `Advance to ${nextStage.label}`,
            detail: stage.percentage === 100
              ? 'The full fleet remains inside the declared gates. A future model change starts a new staged release.'
              : `The required evidence is present. Expand from ${enrolledDevices.toLocaleString()} to ${Math.round(data.fleetSize * (nextStage.percentage / 100)).toLocaleString()} devices, then evaluate the next cohort independently.`,
            affectedDevices: enrolledDevices,
            missing,
            tone: 'emerald' as const,
            icon: BadgeCheck,
          }
        : {
            action: 'Hold this stage',
            detail: 'Healthy-looking traffic is not enough to advance. Collect every required signal while the blast radius remains bounded.',
            affectedDevices: enrolledDevices,
            missing,
            tone: 'amber' as const,
            icon: ShieldAlert,
          };
    }

    if (scenario.mode === 'rollback') {
      const canRollback = completedControls.includes('rollback-artifact');
      return {
        action: canRollback ? 'Stop rollout and restore the known-good model' : 'Contain rollout; rollback is unavailable',
        detail: canRollback
          ? `${enrolledDevices.toLocaleString()} enrolled devices should receive the signed rollback target. Diagnose the failed cohort before rebuilding the candidate.`
          : 'The candidate must not advance, but the fleet lacks a verified restoration path. Disable the affected ML feature where policy permits and escalate recovery.',
        affectedDevices: enrolledDevices,
        missing,
        tone: 'rose' as const,
        icon: RotateCcw,
      };
    }

    if (scenario.mode === 'offline') {
      return {
        action: fallback.availableOffline ? `Continue with ${fallback.label}` : 'Stop the ML-dependent path',
        detail: fallback.availableOffline
          ? `${enrolledDevices.toLocaleString()} devices can preserve bounded local behavior while telemetry queues for later upload.`
          : 'The selected fallback requires a network that is unavailable. The product needs a local known-good model or a deterministic non-ML path.',
        affectedDevices: enrolledDevices,
        missing,
        tone: fallback.availableOffline ? 'amber' as const : 'rose' as const,
        icon: CloudOff,
      };
    }

    return {
      action: 'Freeze promotion and restore observability',
      detail: 'Without load, crash, latency, thermal, and task-quality evidence, the release controller cannot distinguish success from silent fleet damage.',
      affectedDevices: enrolledDevices,
      missing,
      tone: 'amber' as const,
      icon: Radio,
    };
  }, [completedControls, data, fallback, scenario, stage]);

  function toggleControl(controlId: string) {
    setCompletedControls((current) => (
      current.includes(controlId)
        ? current.filter((id) => id !== controlId)
        : [...current, controlId]
    ));
  }

  function reset() {
    if (!data) return;
    setStageId(data.defaults.stageId);
    setScenarioId(data.defaults.scenarioId);
    setFallbackId(data.defaults.fallbackId);
    setCompletedControls(data.defaults.completedControls);
  }

  if (!data || !stage || !scenario || !fallback || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'h-96 animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading fleet-rollout lab'}
      >
        {error}
      </div>
    );
  }

  const StatusIcon = result.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Fleet release lab"
          title={data.title}
          description={data.description}
          icon={PackageCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the current rollout stage
                </legend>
                <div className="mt-3 space-y-2">
                  {data.stages.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === stage.id}
                      label={`${item.label} · ${item.percentage}%`}
                      detail={item.detail}
                      icon={Smartphone}
                      accent={item.percentage <= 5 ? 'cyan' : item.percentage < 100 ? 'violet' : 'emerald'}
                      onClick={() => setStageId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inject a fleet condition
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => {
                    const Icon = scenarioIcons[item.mode];
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Icon}
                        accent={item.mode === 'healthy' ? 'emerald' : item.mode === 'rollback' ? 'rose' : 'amber'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release-controller action</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.action}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Current blast radius"
                value={result.affectedDevices.toLocaleString()}
                detail={`${stage.percentage}% of a ${data.fleetSize.toLocaleString()} device fleet`}
                icon={Smartphone}
                tone={stage.percentage <= 5 ? 'cyan' : stage.percentage < 100 ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Required evidence"
                value={`${scenario.requiredControls.length - result.missing.length}/${scenario.requiredControls.length}`}
                detail={`${result.missing.length} required control${result.missing.length === 1 ? '' : 's'} missing`}
                icon={CheckSquare2}
                tone={result.missing.length === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="User-visible consequence"
                value={scenario.mode === 'healthy' ? 'Normal path' : scenario.mode === 'offline' ? 'Degraded path' : 'Candidate stopped'}
                detail={scenario.consequence}
                icon={Cpu}
                tone={scenario.mode === 'healthy' ? 'emerald' : 'amber'}
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose the device fallback
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {data.fallbacks.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === fallback.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'previous-model' ? RotateCcw : item.id === 'bounded-feature' ? ShieldAlert : CloudOff}
                    accent={item.availableOffline ? 'cyan' : 'rose'}
                    onClick={() => setFallbackId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Toggle evidence that actually exists
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.controls.map((control) => {
                  const checked = completedControls.includes(control.id);
                  const required = scenario.requiredControls.includes(control.id);
                  const Icon = checked ? CheckSquare2 : Square;
                  return (
                    <button
                      key={control.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleControl(control.id)}
                      className={`min-h-28 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        checked
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                          : required
                            ? 'border-rose-300 bg-white text-neutral-900 hover:border-rose-500 dark:border-rose-900 dark:bg-neutral-950 dark:text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                          <span className="flex flex-wrap items-center gap-2 font-semibold">
                            {control.label}
                            {required ? (
                              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] uppercase text-white dark:bg-white dark:text-neutral-950">
                                Required now
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-sm leading-6 opacity-75">{control.detail}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {scenario.id === 'thermal-regression' ? (
              <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <ThermometerSun aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  A warm-loop p95 regression can be invisible in a short benchmark. Keep the workload running long enough to observe throttling on each hardware cohort.
                </p>
              </div>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
