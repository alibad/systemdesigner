'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CloudOff,
  Gauge,
  Leaf,
  MapPin,
  Network,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Workload = {
  id: string;
  label: string;
  detail: string;
  energyKwh: number;
  dataGb: number;
  durationHours: number;
  deadlineHours: number;
  reserveHours: number;
  crossRegionAllowed: boolean;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  delayHours: number;
  intensityGPerKwh: number;
  crossRegion: boolean;
};

type StrategyEffect = {
  available: boolean;
  extraDelayHours: number;
  intensityDeltaGPerKwh: number;
  note: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  effects: Record<string, StrategyEffect>;
};

type Guardrail = {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
};

type ReliabilityModel = {
  title: string;
  description: string;
  assumptions: {
    baselineStrategyId: string;
    transferEnergyKwhPerGb: number;
    transferIntensityGPerKwh: number;
  };
  defaults: {
    workloadId: string;
    strategyId: string;
    scenarioId: string;
    guardrailId: string;
  };
  workloads: Workload[];
  strategies: Strategy[];
  scenarios: Scenario[];
  guardrails: Guardrail[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/carbon-aware-computing-systems/data/carbon-reliability-tradeoff-model.json';

function isReliabilityModel(value: unknown): value is ReliabilityModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ReliabilityModel>;

  return Boolean(
    model.title
      && model.description
      && model.assumptions?.baselineStrategyId
      && typeof model.assumptions.transferEnergyKwhPerGb === 'number'
      && typeof model.assumptions.transferIntensityGPerKwh === 'number'
      && model.defaults?.workloadId
      && model.defaults.strategyId
      && model.defaults.scenarioId
      && model.defaults.guardrailId
      && Array.isArray(model.workloads)
      && model.workloads.length >= 3
      && model.workloads.every((workload) => (
        workload.id
        && workload.label
        && workload.detail
        && workload.energyKwh > 0
        && workload.dataGb >= 0
        && workload.durationHours > 0
        && workload.deadlineHours > workload.durationHours
        && workload.reserveHours >= 0
        && typeof workload.crossRegionAllowed === 'boolean'
      ))
      && Array.isArray(model.strategies)
      && model.strategies.length >= 3
      && model.strategies.every((strategy) => (
        strategy.id
        && strategy.label
        && strategy.detail
        && strategy.delayHours >= 0
        && strategy.intensityGPerKwh > 0
        && typeof strategy.crossRegion === 'boolean'
      ))
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 3
      && model.scenarios.every((scenario) => (
        scenario.id
        && scenario.label
        && scenario.detail
        && scenario.effects
        && typeof scenario.effects === 'object'
      ))
      && Array.isArray(model.guardrails)
      && model.guardrails.length >= 2
      && model.guardrails.every((guardrail) => (
        guardrail.id
        && guardrail.label
        && guardrail.detail
        && typeof guardrail.enabled === 'boolean'
      )),
  );
}

function formatMass(value: number | null) {
  if (value === null) return 'Not run';
  return `${value.toFixed(value >= 100 ? 0 : 1)} kg CO2e`;
}

export default function CarbonAwareComputingSystemsReliabilityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ReliabilityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReliabilityModel(payload)) {
          throw new Error('The carbon and reliability model is incomplete.');
        }
        const effectsAreComplete = payload.scenarios.every((scenario) => (
          payload.strategies.every((strategy) => {
            const effect = scenario.effects[strategy.id];
            return Boolean(
              effect
                && typeof effect.available === 'boolean'
                && effect.extraDelayHours >= 0
                && typeof effect.intensityDeltaGPerKwh === 'number'
                && effect.note,
            );
          })
        ));
        if (!effectsAreComplete) {
          throw new Error('One or more scenario outcomes are incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the reliability model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Carbon and reliability stress lab"
        title={model?.title ?? 'Load the dispatch guardrails'}
        description={model?.description ?? 'The lesson-owned dispatch scenarios are loading.'}
        icon={ShieldCheck}
        accent="amber"
      />
      {!model ? (
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ReliabilityLab model={model} />
      )}
    </LearningLab>
  );
}

function ReliabilityLab({ model }: { model: ReliabilityModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [guardrailId, setGuardrailId] = useState(model.defaults.guardrailId);

  const workload = model.workloads.find((item) => item.id === workloadId)
    ?? model.workloads[0];
  const strategy = model.strategies.find((item) => item.id === strategyId)
    ?? model.strategies[0];
  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const guardrail = model.guardrails.find((item) => item.id === guardrailId)
    ?? model.guardrails[0];
  const baselineStrategy = model.strategies.find(
    (item) => item.id === model.assumptions.baselineStrategyId,
  ) ?? model.strategies[0];

  const result = useMemo(() => {
    const selectedEffect = scenario.effects[strategy.id];
    const baselineEffect = scenario.effects[baselineStrategy.id];
    const placementAllowed = !strategy.crossRegion || workload.crossRegionAllowed;
    const selectedAvailable = selectedEffect.available && placementAllowed;
    const selectedCompletionHours = strategy.delayHours
      + selectedEffect.extraDelayHours
      + workload.durationHours;
    const selectedMarginHours = workload.deadlineHours - selectedCompletionHours;
    const guardTriggered = guardrail.enabled && (
      !selectedAvailable || selectedMarginHours < workload.reserveHours
    );

    const effectiveStrategy = guardTriggered ? baselineStrategy : strategy;
    const effectiveEffect = scenario.effects[effectiveStrategy.id];
    const effectivePlacementAllowed = !effectiveStrategy.crossRegion
      || workload.crossRegionAllowed;
    const available = effectiveEffect.available && effectivePlacementAllowed;
    const completionHours = effectiveStrategy.delayHours
      + effectiveEffect.extraDelayHours
      + workload.durationHours;
    const marginHours = workload.deadlineHours - completionHours;
    const intensityGPerKwh = Math.max(
      0,
      effectiveStrategy.intensityGPerKwh + effectiveEffect.intensityDeltaGPerKwh,
    );
    const transferEnergyKwh = available && effectiveStrategy.crossRegion
      ? workload.dataGb * model.assumptions.transferEnergyKwhPerGb
      : 0;
    const computeKg = available
      ? workload.energyKwh * intensityGPerKwh / 1_000
      : null;
    const transferKg = available
      ? transferEnergyKwh * model.assumptions.transferIntensityGPerKwh / 1_000
      : null;
    const totalKg = computeKg === null || transferKg === null
      ? null
      : computeKg + transferKg;

    const baselineIntensity = Math.max(
      0,
      baselineStrategy.intensityGPerKwh + baselineEffect.intensityDeltaGPerKwh,
    );
    const baselineKg = workload.energyKwh * baselineIntensity / 1_000;
    const carbonDifferenceKg = totalKg === null ? null : baselineKg - totalKg;

    let status = 'Within reliability guardrails';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let explanation = `The job completes with ${marginHours.toFixed(1)} hours of deadline margin, at or above the required ${workload.reserveHours} hour reserve.`;

    if (!available) {
      status = 'Dispatch path unavailable';
      tone = 'rose';
      explanation = effectivePlacementAllowed
        ? 'The selected path cannot accept the job under this injected condition. No completion or emissions claim is reported.'
        : 'The selected placement violates this workload’s modeled residency boundary. No dispatch is allowed.';
    } else if (marginHours < 0) {
      status = 'Completion deadline missed';
      tone = 'rose';
      explanation = `The modeled completion is ${Math.abs(marginHours).toFixed(1)} hours late. Carbon savings cannot compensate for a failed workload.`;
    } else if (marginHours < workload.reserveHours) {
      status = 'Reliability reserve consumed';
      tone = 'amber';
      explanation = `The job finishes before the deadline, but leaves only ${marginHours.toFixed(1)} hours of margin instead of the required ${workload.reserveHours} hours.`;
    } else if (guardTriggered) {
      status = 'Guardrail selected the reliable fallback';
      tone = 'amber';
      explanation = 'The admission policy rejected the greener plan before dispatch and ran the home-region baseline to preserve the required completion reserve.';
    }

    return {
      selectedEffect,
      effectiveEffect,
      selectedAvailable,
      selectedCompletionHours,
      selectedMarginHours,
      guardTriggered,
      effectiveStrategy,
      placementAllowed,
      available,
      completionHours,
      marginHours,
      intensityGPerKwh,
      transferEnergyKwh,
      computeKg,
      transferKg,
      totalKg,
      baselineKg,
      carbonDifferenceKg,
      status,
      tone,
      explanation,
    };
  }, [
    baselineStrategy,
    guardrail.enabled,
    model.assumptions.transferEnergyKwhPerGb,
    model.assumptions.transferIntensityGPerKwh,
    scenario,
    strategy,
    workload,
  ]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setStrategyId(model.defaults.strategyId);
    setScenarioId(model.defaults.scenarioId);
    setGuardrailId(model.defaults.guardrailId);
  }

  const panelStyle = {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  }[result.tone];

  return (
    <LearningLabBody
      controls={(
        <div className="space-y-7">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Workload contract
            </legend>
            <div className="mt-3 space-y-2">
              {model.workloads.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === workload.id}
                  label={item.label}
                  detail={item.detail}
                  icon={Clock3}
                  accent="blue"
                  onClick={() => setWorkloadId(item.id)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              2. Carbon strategy
            </legend>
            <div className="mt-3 space-y-2">
              {model.strategies.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === strategy.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.crossRegion ? MapPin : Leaf}
                  accent="emerald"
                  onClick={() => setStrategyId(item.id)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              3. Inject an operating condition
            </legend>
            <div className="mt-3 space-y-2">
              {model.scenarios.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === scenario.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.id === 'network-partition' ? Network : AlertTriangle}
                  accent="amber"
                  onClick={() => setScenarioId(item.id)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              4. Admission guardrail
            </legend>
            <div className="mt-3 space-y-2">
              {model.guardrails.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === guardrail.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.enabled ? ShieldCheck : CloudOff}
                  accent={item.enabled ? 'violet' : 'rose'}
                  onClick={() => setGuardrailId(item.id)}
                />
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset stress test
          </button>
        </div>
      )}
    >
      <div className="min-w-0 space-y-6" aria-live="polite">
        <section className={`rounded-md border p-5 ${panelStyle}`}>
          <div className="flex items-start gap-3">
            {result.tone === 'emerald' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase opacity-70">
                Dispatch decision
              </p>
              <h4 className="mt-1 text-xl font-semibold">{result.status}</h4>
              <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Effective path"
            value={result.available ? result.effectiveStrategy.label : 'Blocked'}
            detail={result.guardTriggered
              ? `Requested: ${strategy.label}`
              : result.effectiveEffect.note}
            icon={ArrowRight}
            tone={result.available ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Completion margin"
            value={result.available ? `${result.marginHours.toFixed(1)} h` : '--'}
            detail={`Deadline ${workload.deadlineHours}h; reserve ${workload.reserveHours}h`}
            icon={TimerReset}
            tone={!result.available
              ? 'rose'
              : result.marginHours < 0
                ? 'rose'
                : result.marginHours < workload.reserveHours
                  ? 'amber'
                  : 'emerald'}
          />
          <LabMetric
            label="Modeled emissions"
            value={formatMass(result.totalKg)}
            detail={result.totalKg === null
              ? 'No successful execution to attribute'
              : `${workload.energyKwh} kWh at ${result.intensityGPerKwh} gCO2e/kWh`}
            icon={Leaf}
            tone={result.totalKg === null ? 'rose' : 'emerald'}
          />
          <LabMetric
            label="Versus run now"
            value={result.carbonDifferenceKg === null
              ? '--'
              : formatMass(Math.abs(result.carbonDifferenceKg))}
            detail={result.carbonDifferenceKg === null
              ? 'Comparison unavailable'
              : result.carbonDifferenceKg >= 0
                ? 'Lower than the same-scenario baseline'
                : 'Higher than the same-scenario baseline'}
            icon={Gauge}
            tone={result.carbonDifferenceKg !== null && result.carbonDifferenceKg > 0
              ? 'emerald'
              : 'amber'}
          />
        </div>

        <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Admission trace
            </p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              Carbon is optimized inside the workload contract
            </h4>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <TraceStep
              number="1"
              title="Check placement"
              state={result.placementAllowed ? 'pass' : 'fail'}
              detail={strategy.crossRegion
                ? workload.crossRegionAllowed
                  ? 'The secondary region is inside the modeled residency boundary.'
                  : 'This workload is not approved to cross the region boundary.'
                : 'The plan stays inside the home region.'}
            />
            <TraceStep
              number="2"
              title="Protect completion reserve"
              state={result.selectedMarginHours >= workload.reserveHours ? 'pass' : 'warn'}
              detail={`Requested plan leaves ${result.selectedMarginHours.toFixed(1)}h; policy requires ${workload.reserveHours}h.`}
            />
            <TraceStep
              number="3"
              title="Commit or fall back"
              state={!result.available
                ? 'fail'
                : result.guardTriggered
                  ? 'warn'
                  : 'pass'}
              detail={result.guardTriggered
                ? `The guardrail substitutes ${baselineStrategy.label}.`
                : result.available
                  ? `The scheduler commits ${result.effectiveStrategy.label}.`
                  : 'The job has no viable dispatch path.'}
            />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
            <p className="text-xs font-semibold uppercase opacity-70">
              Injected condition
            </p>
            <h4 className="mt-1 text-sm font-semibold">{scenario.label}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.selectedEffect.note}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="opacity-70">Added start delay</dt>
                <dd className="mt-1 font-semibold">
                  {result.selectedEffect.extraDelayHours} h
                </dd>
              </div>
              <div>
                <dt className="opacity-70">Intensity adjustment</dt>
                <dd className="mt-1 font-semibold">
                  {result.selectedEffect.intensityDeltaGPerKwh >= 0 ? '+' : ''}
                  {result.selectedEffect.intensityDeltaGPerKwh} gCO2e/kWh
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50">
            <p className="text-xs font-semibold uppercase opacity-70">
              Accounting boundary
            </p>
            <ul className="mt-2 space-y-2 text-sm leading-6">
              <li>Compute: {formatMass(result.computeKg)}</li>
              <li>
                Transfer: {result.transferEnergyKwh.toFixed(1)} kWh and {
                  formatMass(result.transferKg)
                }
              </li>
              <li>
                Data movement: {result.effectiveStrategy.crossRegion
                  ? `${workload.dataGb} GB across regions`
                  : 'none across regions'}
              </li>
            </ul>
          </section>
        </div>
      </div>
    </LearningLabBody>
  );
}

function TraceStep({
  number,
  title,
  detail,
  state,
}: {
  number: string;
  title: string;
  detail: string;
  state: 'pass' | 'warn' | 'fail';
}) {
  const styles = {
    pass: 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950',
    warn: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    fail: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
  }[state];
  const badge = {
    pass: 'bg-emerald-600 text-white',
    warn: 'bg-amber-500 text-neutral-950',
    fail: 'bg-rose-600 text-white',
  }[state];

  return (
    <article className={`min-w-0 rounded-md border p-4 ${styles}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
          {number}
        </span>
        <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</h5>
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </article>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[280px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Reliability data could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <ShieldCheck
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-amber-500 motion-reduce:animate-none"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading dispatch scenarios...
          </p>
        </div>
      )}
    </div>
  );
}
