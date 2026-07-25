'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Route,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Tone = 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';

interface SafetyControl {
  id: string;
  label: string;
  layer: string;
  detail: string;
}

interface ControlStrategy {
  id: string;
  label: string;
  detail: string;
  controlIds: string[];
}

interface ThreatPath {
  id: string;
  label: string;
  severity: number;
  requiredControlIds: string[];
  consequence: string;
}

interface SafetyScenario {
  id: string;
  label: string;
  detail: string;
  riskClass: string;
  threats: ThreatPath[];
}

interface ControlLayerModel {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
  };
  controls: SafetyControl[];
  strategies: ControlStrategy[];
  scenarios: SafetyScenario[];
}

const BLOCK_ID = 'genai/ai-safety-control-layer-lab';

function isControlLayerModel(value: unknown): value is ControlLayerModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ControlLayerModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.controls)
      && candidate.controls.length > 0
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function AiSafetyControlLayerLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ControlLayerModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No safety control model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isControlLayerModel(payload)) {
          throw new Error('Safety control data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load safety controls.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ControlLayerLab data={data} />;
}

function ControlLayerLab({ data }: { data: ControlLayerModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [strategyId, setStrategyId] = useState(data.defaults.strategyId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const model = useMemo(() => {
    const enabled = new Set(strategy.controlIds);
    const threats = scenario.threats.map((threat) => {
      const satisfied = threat.requiredControlIds.filter((controlId) => enabled.has(controlId));
      const coverage = satisfied.length / threat.requiredControlIds.length;
      const status = coverage === 1 ? 'controlled' : coverage > 0 ? 'partial' : 'exposed';
      return { ...threat, coverage, satisfied, status };
    });
    const weightedTotal = threats.reduce((sum, threat) => sum + threat.severity, 0);
    const weightedCoverage = threats.reduce(
      (sum, threat) => sum + threat.severity * threat.coverage,
      0,
    );
    const safetyScore = Math.round((weightedCoverage / weightedTotal) * 100);
    const controlledCount = threats.filter((threat) => threat.status === 'controlled').length;
    const missingIds = new Set(
      threats.flatMap((threat) => threat.requiredControlIds.filter((id) => !enabled.has(id))),
    );
    const missingControls = data.controls.filter((control) => missingIds.has(control.id));
    const tone: Tone = safetyScore >= 85 ? 'emerald' : safetyScore >= 45 ? 'amber' : 'rose';

    return { controlledCount, enabled, missingControls, safetyScore, threats, tone };
  }, [data.controls, scenario.threats, strategy.controlIds]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setStrategyId(data.defaults.strategyId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Safety boundary lab"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product context
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Route}
                      accent={item.riskClass.startsWith('High') ? 'rose' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Control strategy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.strategies.map((item, index) => (
                    <LabChoice
                      key={item.id}
                      selected={strategy.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={index === 2 ? ShieldCheck : index === 1 ? Layers3 : ShieldAlert}
                      accent={index === 2 ? 'emerald' : index === 1 ? 'amber' : 'rose'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Weighted coverage"
                value={`${model.safetyScore}%`}
                detail="Severity-weighted control-path coverage"
                icon={Gauge}
                tone={model.tone}
              />
              <LabMetric
                label="Threat paths controlled"
                value={`${model.controlledCount} / ${model.threats.length}`}
                detail="Every required boundary is present"
                icon={ShieldCheck}
                tone={model.controlledCount === model.threats.length ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Missing boundaries"
                value={`${model.missingControls.length}`}
                detail={scenario.riskClass}
                icon={LockKeyhole}
                tone={model.missingControls.length === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Enforced request path
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {strategy.label}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Enabled controls carry a check mark
                </p>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {data.controls.map((control, index) => {
                  const enabled = model.enabled.has(control.id);
                  return (
                    <li
                      key={control.id}
                      className={`relative min-w-0 rounded-md border p-4 ${enabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'}`}
                    >
                      <div className="flex items-start gap-3">
                        {enabled ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase opacity-70">
                            {index + 1}. {control.layer}
                          </p>
                          <p className="mt-1 text-sm font-semibold">{control.label}</p>
                          <p className="mt-1 text-xs leading-5 opacity-80">{control.detail}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Failure-path trace
                </p>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {model.threats.map((threat) => {
                  const tone = threat.status === 'controlled'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : threat.status === 'partial'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-rose-700 dark:text-rose-300';
                  const label = threat.status === 'controlled'
                    ? 'Controlled'
                    : threat.status === 'partial'
                      ? 'Partially contained'
                      : 'Exposed';
                  return (
                    <div key={threat.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{threat.label}</p>
                          <span className={`text-xs font-semibold ${tone}`}>{label}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {threat.consequence}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                          <span>Boundary coverage</span>
                          <span>{Math.round(threat.coverage * 100)}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${threat.status === 'controlled'
                              ? 'bg-emerald-500'
                              : threat.status === 'partial'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'}`}
                            style={{ width: `${threat.coverage * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-md border p-5 ${model.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : model.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Design consequence</p>
                  <p className="mt-2 text-sm font-semibold leading-6">
                    {model.missingControls.length === 0
                      ? 'Each modeled failure path meets every required independent boundary.'
                      : `${model.missingControls.map((control) => control.label).join(', ')} ${model.missingControls.length === 1 ? 'is' : 'are'} still missing from this strategy.`}
                  </p>
                  <p className="mt-2 text-xs leading-5 opacity-80">
                    Coverage is a design aid, not proof of safety. Validate each control against realistic failures and affected cohorts.
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
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading safety boundary model...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Safety boundary lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
