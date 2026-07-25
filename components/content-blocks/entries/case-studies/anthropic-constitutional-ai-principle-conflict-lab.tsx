'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, HeartHandshake, Scale, ShieldCheck, Sparkles } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Principle {
  label: string;
  detail: string;
}

interface Strategy {
  id: string;
  label: string;
  detail: string;
  revision: string;
  rationale: string;
  helpfulness: number;
  honesty: number;
  harmControl: number;
  recommended: boolean;
}

interface Scenario {
  id: string;
  label: string;
  context: string;
  draft: string;
  principles: Principle[];
  strategies: Strategy[];
}

interface PrincipleConflictData {
  title: string;
  description: string;
  scenarios: Scenario[];
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isPrinciple(value: unknown): value is Principle {
  if (!value || typeof value !== 'object') return false;
  const principle = value as Partial<Principle>;
  return typeof principle.label === 'string' && typeof principle.detail === 'string';
}

function isStrategy(value: unknown): value is Strategy {
  if (!value || typeof value !== 'object') return false;
  const strategy = value as Partial<Strategy>;
  return (
    typeof strategy.id === 'string' &&
    typeof strategy.label === 'string' &&
    typeof strategy.detail === 'string' &&
    typeof strategy.revision === 'string' &&
    typeof strategy.rationale === 'string' &&
    isScore(strategy.helpfulness) &&
    isScore(strategy.honesty) &&
    isScore(strategy.harmControl) &&
    typeof strategy.recommended === 'boolean'
  );
}

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const scenario = value as Partial<Scenario>;
  return (
    typeof scenario.id === 'string' &&
    typeof scenario.label === 'string' &&
    typeof scenario.context === 'string' &&
    typeof scenario.draft === 'string' &&
    Array.isArray(scenario.principles) &&
    scenario.principles.length >= 2 &&
    scenario.principles.every(isPrinciple) &&
    Array.isArray(scenario.strategies) &&
    scenario.strategies.length >= 2 &&
    scenario.strategies.every(isStrategy)
  );
}

function isPrincipleConflictData(value: unknown): value is PrincipleConflictData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<PrincipleConflictData>;
  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    Array.isArray(data.scenarios) &&
    data.scenarios.length > 0 &&
    data.scenarios.every(isScenario)
  );
}

function recommendedStrategy(scenario: Scenario): Strategy {
  return scenario.strategies.find((strategy) => strategy.recommended) ?? scenario.strategies[0]!;
}

export default function AnthropicConstitutionalAiPrincipleConflictLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PrincipleConflictData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [strategyId, setStrategyId] = useState('');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setLoadError(false);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Principle conflict data request failed');
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPrincipleConflictData(payload)) throw new Error('Principle conflict data is invalid');
        const firstScenario = payload.scenarios[0]!;
        setData(payload);
        setScenarioId(firstScenario.id);
        setStrategyId(recommendedStrategy(firstScenario).id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = useMemo(
    () => data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0] ?? null,
    [data, scenarioId],
  );
  const strategy = useMemo(
    () => scenario?.strategies.find((item) => item.id === strategyId) ?? (scenario ? recommendedStrategy(scenario) : null),
    [scenario, strategyId],
  );

  if (loadError) {
    return (
      <div
        data-content-block="case-studies/anthropic-constitutional-ai-principle-conflict-lab"
        role="alert"
        className="min-h-40 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      >
        The principle conflict scenarios could not be loaded.
      </div>
    );
  }

  if (!data || !scenario || !strategy) {
    return (
      <div
        data-content-block="case-studies/anthropic-constitutional-ai-principle-conflict-lab"
        aria-busy="true"
        aria-label="Loading principle conflict scenarios"
        className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const chooseScenario = (nextScenario: Scenario) => {
    setScenarioId(nextScenario.id);
    setStrategyId(recommendedStrategy(nextScenario).id);
  };
  const reset = () => {
    const firstScenario = data.scenarios[0]!;
    setScenarioId(firstScenario.id);
    setStrategyId(recommendedStrategy(firstScenario).id);
  };

  return (
    <div data-content-block="case-studies/anthropic-constitutional-ai-principle-conflict-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Constitution design lab"
          title={data.title}
          description={data.description}
          icon={Scale}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a conflict
                </p>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.context}
                      icon={BookOpenCheck}
                      accent="blue"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose a revision
                </p>
                <div className="mt-3 space-y-2">
                  {scenario.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Sparkles}
                      accent="violet"
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Draft to critique</p>
              <p className="mt-3 text-sm leading-6 text-neutral-800 dark:text-neutral-100">{scenario.draft}</p>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Applicable principles</p>
              <div className="mt-3 space-y-3">
                {scenario.principles.map((principle, index) => (
                  <div key={principle.label} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white dark:bg-blue-400 dark:text-blue-950">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-950 dark:text-blue-50">{principle.label}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900/75 dark:text-blue-100/75">{principle.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Safe usefulness"
              value={`${strategy.helpfulness}/100`}
              detail="Useful permitted assistance"
              icon={HeartHandshake}
              tone={strategy.helpfulness >= 75 ? 'emerald' : strategy.helpfulness >= 45 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Epistemic honesty"
              value={`${strategy.honesty}/100`}
              detail="Role and uncertainty accuracy"
              icon={CheckCircle2}
              tone={strategy.honesty >= 75 ? 'emerald' : strategy.honesty >= 45 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Harm control"
              value={`${strategy.harmControl}/100`}
              detail="Relevant boundary preserved"
              icon={ShieldCheck}
              tone={strategy.harmControl >= 75 ? 'emerald' : strategy.harmControl >= 45 ? 'amber' : 'rose'}
            />
          </div>

          <div
            role="status"
            aria-live="polite"
            className={`mt-4 rounded-md border p-4 ${
              strategy.recommended
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {strategy.recommended ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <Scale aria-hidden="true" className="h-4 w-4" />}
              {strategy.recommended ? 'Balanced revision' : 'A principle conflict remains'}
            </div>
            <p className="mt-3 text-sm font-semibold">Revised response</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{strategy.revision}</p>
            <p className="mt-3 border-t border-current/15 pt-3 text-xs leading-5 opacity-75">{strategy.rationale}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
