'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Route,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type AdaptationMethod = {
  id: string;
  label: string;
  detail: string;
  capabilities: string[];
  stateLocation: string;
  changesWeights: boolean;
  updateHours: number;
  rollbackMinutes: number;
  addedLatencyMs: number;
  operatingWeight: number;
  minimumExamples: number;
  contract: string;
  failureMode: string;
};

type AdaptationScenario = {
  id: string;
  label: string;
  brief: string;
  requiredCapability: string;
  recommendedMethodId: string;
  maximumStalenessHours: number;
  changeFrequencyDays: number;
  consequence: string;
};

type AdaptationDecisionModel = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    scenarioId: string;
    methodId: string;
  };
  methods: AdaptationMethod[];
  scenarios: AdaptationScenario[];
};

const BLOCK_ID = 'genai/llms-adaptation-decision-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAdaptationDecisionModel(value: unknown): value is AdaptationDecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdaptationDecisionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.notice
      && candidate.defaults
      && Array.isArray(candidate.methods)
      && candidate.methods.length >= 3
      && candidate.methods.every((method) => (
        method.id
        && method.label
        && Array.isArray(method.capabilities)
        && isFiniteNumber(method.updateHours)
        && isFiniteNumber(method.operatingWeight)
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        scenario.id
        && scenario.label
        && scenario.requiredCapability
        && scenario.recommendedMethodId
        && isFiniteNumber(scenario.maximumStalenessHours)
      )),
  );
}

function formatHours(hours: number) {
  if (hours === 0) return 'Immediate';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours} hr`;
  return `${Math.round(hours / 24)} days`;
}

function methodIcon(methodId: string): LucideIcon {
  if (methodId === 'prompt') return MessageSquareText;
  if (methodId === 'retrieval') return Database;
  if (methodId === 'adapter') return Layers3;
  return BrainCircuit;
}

export default function LlmsAdaptationDecisionLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<AdaptationDecisionModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No adaptation decision model was supplied.');
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
        if (!isAdaptationDecisionModel(payload)) {
          throw new Error('The adaptation decision model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load adaptation data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <AdaptationDecisionLab data={data} />;
}

function AdaptationDecisionLab({ data }: { data: AdaptationDecisionModel }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialMethod = data.methods.find((item) => item.id === data.defaults.methodId)
    ?? data.methods[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [methodId, setMethodId] = useState(initialMethod.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const method = data.methods.find((item) => item.id === methodId) ?? data.methods[0];
  const recommended = data.methods.find((item) => item.id === scenario.recommendedMethodId)
    ?? data.methods[0];

  const result = useMemo(() => {
    const capabilityFit = method.capabilities.includes(scenario.requiredCapability);
    const freshnessFit = method.updateHours <= scenario.maximumStalenessHours;
    const persistenceFit = !method.changesWeights || scenario.changeFrequencyDays >= 30;
    const smallestFit = method.id === recommended.id;
    const checks = [capabilityFit, freshnessFit, persistenceFit, smallestFit];
    const fitScore = Math.round(checks.filter(Boolean).length / checks.length * 100);

    let verdict = 'The state boundary fits the requirement';
    let detail = scenario.consequence;
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!capabilityFit) {
      verdict = 'This mechanism does not create the required capability';
      detail = `${method.label} does not satisfy ${scenario.requiredCapability}. Start with ${recommended.label}.`;
      tone = 'rose';
    } else if (!freshnessFit) {
      verdict = 'The update path becomes stale before the requirement allows';
      detail = `${method.label} changes in ${formatHours(method.updateHours)}, but this scenario allows at most ${formatHours(scenario.maximumStalenessHours)}.`;
      tone = 'rose';
    } else if (!persistenceFit) {
      verdict = 'The behavior changes too often for learned weights';
      detail = `The requirement changes about every ${scenario.changeFrequencyDays} days. Keep it in a request-time layer that can be inspected and reversed quickly.`;
      tone = 'amber';
    } else if (!smallestFit) {
      verdict = 'Capable, but more operationally expensive than necessary';
      detail = `${recommended.label} satisfies the requirement with a lower persistence and release burden.`;
      tone = 'amber';
    }

    return { capabilityFit, fitScore, freshnessFit, persistenceFit, smallestFit, verdict, detail, tone };
  }, [method, recommended, scenario]);

  const chooseScenario = (nextScenario: AdaptationScenario) => {
    setScenarioId(nextScenario.id);
    setMethodId(nextScenario.recommendedMethodId);
  };

  const reset = () => {
    setScenarioId(initialScenario.id);
    setMethodId(initialMethod.id);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Adaptation boundary lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product requirement
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={BookOpenCheck}
                      accent="blue"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Adaptation mechanism
                </legend>
                <div className="mt-3 space-y-2">
                  {data.methods.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === method.id}
                      label={item.label}
                      detail={item.detail}
                      icon={methodIcon(item.id)}
                      accent={item.id === 'retrieval' ? 'emerald' : item.id === 'prompt' ? 'blue' : item.id === 'adapter' ? 'violet' : 'amber'}
                      onClick={() => setMethodId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Decision fit"
                value={`${result.fitScore}%`}
                detail="Capability, freshness, persistence, and least-burden checks."
                icon={Gauge}
                tone={result.fitScore === 100 ? 'emerald' : result.fitScore >= 75 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Update path"
                value={formatHours(method.updateHours)}
                detail={`Requirement allows ${formatHours(scenario.maximumStalenessHours)}.`}
                icon={Clock3}
                tone={result.freshnessFit ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Rollback"
                value={`${method.rollbackMinutes} min`}
                detail={method.changesWeights ? 'Requires a versioned model-bundle rollback.' : 'State can change outside base weights.'}
                icon={TimerReset}
                tone={method.changesWeights ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Request cost"
                value={`+${method.addedLatencyMs} ms`}
                detail="Modeled median mechanism overhead before generation."
                icon={Clock3}
                tone={method.addedLatencyMs > 50 ? 'amber' : 'violet'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    State placement map
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    Persistence and release burden increase from left to right
                  </h4>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Recommended: {recommended.label}
                </p>
              </div>

              <ol className="mt-5 grid gap-3 md:grid-cols-4">
                {data.methods.map((item, index) => {
                  const selected = item.id === method.id;
                  const isRecommended = item.id === recommended.id;
                  const Icon = methodIcon(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`relative min-w-0 rounded-md border p-4 ${selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-200 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-900'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-75">{item.stateLocation}</p>
                      <p className="mt-3 text-xs font-semibold">
                        {item.changesWeights ? 'Changes learned weights' : 'Keeps base weights fixed'}
                      </p>
                      {isRecommended ? (
                        <span className="mt-3 inline-flex rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          Smallest fit
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-start gap-3">
                  <BookOpenCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Release contract</p>
                    <h4 className="mt-2 font-semibold text-neutral-950 dark:text-white">{method.label}</h4>
                    <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{method.contract}</p>
                    <p className="mt-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                      Minimum modeled examples: {method.minimumExamples.toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-start gap-3">
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure to test</p>
                    <h4 className="mt-2 font-semibold text-neutral-950 dark:text-white">Where this mechanism breaks</h4>
                    <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{method.failureMode}</p>
                  </div>
                </div>
              </section>
            </div>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading adaptation boundaries...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center">
            <div className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-semibold">Adaptation lab unavailable</h3>
                  <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
