'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Eye,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Defense = {
  id: string;
  stage: string;
  label: string;
  detail: string;
  defaultEnabled: boolean;
};

type ThreatScenario = {
  id: string;
  label: string;
  detail: string;
  asset: string;
  attackerGoal: string;
  baseEscapePct: number;
  requiredDefenseIds: string[];
  defenseEffects: Record<string, number>;
  containedOutcome: string;
  failureOutcome: string;
  assumption: string;
};

type ThreatData = {
  defaultScenarioId: string;
  defenses: Defense[];
  scenarios: ThreatScenario[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/adversarial-robustness-evaluation/data/threat-scenarios-defense-failures.json';

function isThreatData(value: unknown): value is ThreatData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ThreatData>;
  return Array.isArray(candidate.defenses)
    && candidate.defenses.length > 0
    && Array.isArray(candidate.scenarios)
    && candidate.scenarios.length > 0;
}

export default function AdversarialRobustnessEvaluationDefenseFailureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ThreatData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [enabledDefenseIds, setEnabledDefenseIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const payload = (await response.json()) as unknown;
        if (!isThreatData(payload)) throw new Error('Threat scenario data is incomplete.');

        if (active) {
          setData(payload);
          setScenarioId(payload.defaultScenarioId);
          setEnabledDefenseIds(
            payload.defenses.filter((defense) => defense.defaultEnabled).map((defense) => defense.id),
          );
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load threat data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];

  const model = useMemo(() => {
    if (!data || !scenario) return null;

    const missingDefenses = data.defenses.filter(
      (defense) => scenario.requiredDefenseIds.includes(defense.id)
        && !enabledDefenseIds.includes(defense.id),
    );
    const enabledRequired = scenario.requiredDefenseIds.length - missingDefenses.length;
    const residualEscapePct = Object.entries(scenario.defenseEffects).reduce(
      (risk, [defenseId, effect]) => enabledDefenseIds.includes(defenseId)
        ? risk * (1 - effect)
        : risk,
      scenario.baseEscapePct,
    );
    const contained = missingDefenses.length === 0;
    const detectionWindow = enabledDefenseIds.includes('output-gate')
      ? 'Before release'
      : enabledDefenseIds.includes('probe-monitor')
        ? 'After correlated probes'
        : 'After user impact';
    const outcome = contained ? scenario.containedOutcome : scenario.failureOutcome;

    return {
      contained,
      detectionWindow,
      enabledRequired,
      missingDefenses,
      outcome,
      residualEscapePct: Math.max(0.5, residualEscapePct),
    };
  }, [data, enabledDefenseIds, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaultScenarioId);
    setEnabledDefenseIds(
      data.defenses.filter((defense) => defense.defaultEnabled).map((defense) => defense.id),
    );
  }

  function toggleDefense(defenseId: string) {
    setEnabledDefenseIds((current) => current.includes(defenseId)
      ? current.filter((id) => id !== defenseId)
      : [...current, defenseId]);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Threat scenario and defense failure"
        title="Match each attacker path to the controls that can stop it"
        description="Select a threat, then enable or disable defenses. The path shows why model training, trust boundaries, output policy, and operations controls are not interchangeable."
        icon={ShieldAlert}
        accent="rose"
        onReset={data ? reset : undefined}
      />

      {!data || !scenario || !model ? (
        <div className="flex min-h-[560px] items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center">
              <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                Threat scenario data could not be loaded
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center" role="status">
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-rose-500 motion-reduce:animate-none" />
              <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Loading threat scenarios...
              </p>
            </div>
          )}
        </div>
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Threat scenario
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={scenario.id === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.id === 'retrieved-injection' ? LockKeyhole : ShieldAlert}
                      accent="rose"
                      onClick={() => setScenarioId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Defense stack
                </legend>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Each switch represents an independently owned control, not another prompt instruction.
                </p>
                <div className="mt-3 space-y-2">
                  {data.defenses.map((defense) => (
                    <DefenseSwitch
                      key={defense.id}
                      defense={defense}
                      checked={enabledDefenseIds.includes(defense.id)}
                      required={scenario.requiredDefenseIds.includes(defense.id)}
                      onChange={() => toggleDefense(defense.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div>
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Protected asset</p>
              <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{scenario.asset}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                <strong>Attacker goal:</strong> {scenario.attackerGoal}
              </p>
            </section>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Required controls"
                value={`${model.enabledRequired} / ${scenario.requiredDefenseIds.length}`}
                detail="All threat-specific controls must be active."
                icon={ShieldCheck}
                tone={model.contained ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled escape risk"
                value={`${model.residualEscapePct.toFixed(1)}%`}
                detail="Illustrative residual, not a measured probability."
                icon={CircleAlert}
                tone={model.residualEscapePct <= 10 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Detection window"
                value={model.detectionWindow}
                detail="Later detection increases user impact."
                icon={Eye}
                tone={model.detectionWindow === 'Before release' ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Review decision"
                value={model.contained ? 'Scenario covered' : 'Defense gap'}
                detail={model.contained ? 'Proceed to measured testing.' : 'Do not claim coverage.'}
                icon={model.contained ? CheckCircle2 : ShieldAlert}
                tone={model.contained ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Defense path</h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Required status is scenario-specific. An active non-required layer still provides defense in depth.
                </p>
              </div>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {data.defenses.map((defense, index) => {
                  const enabled = enabledDefenseIds.includes(defense.id);
                  const required = scenario.requiredDefenseIds.includes(defense.id);
                  const missing = required && !enabled;
                  const status = missing
                    ? 'Required control missing'
                    : required
                      ? 'Required control active'
                      : enabled
                        ? 'Defense in depth active'
                        : 'Not primary for this threat';

                  return (
                    <li
                      key={defense.id}
                      className={`min-h-40 rounded-md border p-4 ${
                        missing
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                          : enabled
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{index + 1}</span>
                        {missing ? (
                          <CircleAlert aria-label="Missing" className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                        ) : enabled ? (
                          <CheckCircle2 aria-label="Active" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        ) : (
                          <Activity aria-label="Inactive" className="h-4 w-4 text-neutral-400" />
                        )}
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{defense.stage}</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{defense.label}</p>
                      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{status}</p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-live="polite" className={`mt-5 rounded-md border p-4 ${
              model.contained
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {model.contained ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {model.contained ? 'The design covers the declared path' : 'The defense plan fails this scenario review'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-90">{model.outcome}</p>
                  {model.missingDefenses.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 opacity-90">
                      Missing: {model.missingDefenses.map((defense) => defense.label).join(', ')}.
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 opacity-75">
                    <strong>Security assumption:</strong> {scenario.assumption}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function DefenseSwitch({
  defense,
  checked,
  required,
  onChange,
}: {
  defense: Defense;
  checked: boolean;
  required: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
        checked
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
          : required
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{defense.label}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{defense.detail}</span>
          <span className="mt-2 block text-[11px] font-semibold uppercase opacity-70">
            {defense.stage}{required ? ' - required here' : ''}
          </span>
        </span>
        <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full ${checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </span>
    </button>
  );
}
