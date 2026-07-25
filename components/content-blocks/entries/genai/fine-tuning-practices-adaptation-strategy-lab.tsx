'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Gauge,
  GitBranch,
  ListChecks,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FailureKind = 'behavior' | 'knowledge' | 'combined';

interface Scenario {
  id: string;
  label: string;
  detail: string;
  failureKind: FailureKind;
  knowledgeVolatility: number;
  behaviorConsistency: number;
  currentContextNeed: number;
}

interface EvidenceState {
  id: string;
  label: string;
  detail: string;
  taskContract: boolean;
  promptBaseline: boolean;
  retrievalBaseline: boolean;
  heldOutSlices: boolean;
  dataRights: boolean;
}

interface Priority {
  id: string;
  label: string;
  detail: string;
  weights: {
    iteration: number;
    promptCompression: number;
    isolation: number;
  };
}

interface Strategy {
  id: string;
  label: string;
  detail: string;
  behaviorFit: number;
  knowledgeFit: number;
  freshContextFit: number;
  iteration: number;
  promptCompression: number;
  isolation: number;
  requiresPromptBaseline: boolean;
  requiresRetrievalBaseline: boolean;
  requiresHeldOutSlices: boolean;
  requiresDataRights: boolean;
  nextStep: string;
}

interface AdaptationData {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    evidenceId: string;
    priorityId: string;
  };
  scenarios: Scenario[];
  evidenceStates: EvidenceState[];
  priorities: Priority[];
  strategies: Strategy[];
}

interface RankedStrategy {
  strategy: Strategy;
  score: number;
  blockers: string[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/fine-tuning-practices/data/adaptation-strategy-model.json';
const BLOCK_ID = 'genai/fine-tuning-practices-adaptation-strategy-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAdaptationData(value: unknown): value is AdaptationData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<AdaptationData>;
  return Boolean(
    data.blockId === BLOCK_ID
      && data.title
      && data.description
      && data.defaults
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((item) => (
        typeof item.id === 'string'
          && typeof item.label === 'string'
          && ['behavior', 'knowledge', 'combined'].includes(item.failureKind)
          && isFiniteNumber(item.knowledgeVolatility)
          && isFiniteNumber(item.behaviorConsistency)
          && isFiniteNumber(item.currentContextNeed)
      ))
      && Array.isArray(data.evidenceStates)
      && data.evidenceStates.length >= 3
      && Array.isArray(data.priorities)
      && data.priorities.length >= 3
      && Array.isArray(data.strategies)
      && data.strategies.length >= 4
      && data.strategies.every((item) => (
        typeof item.id === 'string'
          && typeof item.label === 'string'
          && isFiniteNumber(item.behaviorFit)
          && isFiniteNumber(item.knowledgeFit)
          && isFiniteNumber(item.freshContextFit)
          && isFiniteNumber(item.iteration)
          && isFiniteNumber(item.promptCompression)
          && isFiniteNumber(item.isolation)
      )),
  );
}

function strategyIcon(id: string) {
  if (id === 'measure-first') return ListChecks;
  if (id === 'prompt') return Sparkles;
  if (id === 'rag') return FileSearch;
  if (id === 'lora-sft') return GitBranch;
  return BrainCircuit;
}

function strategyTone(id: string): 'blue' | 'cyan' | 'violet' | 'emerald' | 'amber' {
  if (id === 'measure-first') return 'amber';
  if (id === 'prompt') return 'blue';
  if (id === 'rag') return 'cyan';
  if (id === 'lora-sft') return 'emerald';
  return 'violet';
}

export default function FineTuningPracticesAdaptationStrategyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AdaptationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [priorityId, setPriorityId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isAdaptationData(payload)) {
          throw new Error('Adaptation strategy data is incomplete.');
        }
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setEvidenceId(payload.defaults.evidenceId);
        setPriorityId(payload.defaults.priorityId);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the decision model.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const evidence = data?.evidenceStates.find((item) => item.id === evidenceId)
    ?? data?.evidenceStates[0];
  const priority = data?.priorities.find((item) => item.id === priorityId)
    ?? data?.priorities[0];

  const model = useMemo(() => {
    if (!data || !scenario || !evidence || !priority) return null;

    const ranked: RankedStrategy[] = data.strategies.map((strategy) => {
      const behaviorWeight = scenario.behaviorConsistency / 100;
      const knowledgeWeight = scenario.currentContextNeed / 100;
      const stableKnowledgeFit = (
        strategy.knowledgeFit * (100 - scenario.knowledgeVolatility)
        + strategy.freshContextFit * scenario.knowledgeVolatility
      ) / 100;
      const activeBehaviorWeight = scenario.failureKind === 'knowledge' ? 0.2 : behaviorWeight;
      const activeKnowledgeWeight = scenario.failureKind === 'behavior' ? 0.2 : knowledgeWeight;
      const problemFit = (
        strategy.behaviorFit * activeBehaviorWeight
        + stableKnowledgeFit * activeKnowledgeWeight
      ) / Math.max(0.4, activeBehaviorWeight + activeKnowledgeWeight);
      const priorityFit = (
        strategy.iteration * priority.weights.iteration
        + strategy.promptCompression * priority.weights.promptCompression
        + strategy.isolation * priority.weights.isolation
      ) / (
        priority.weights.iteration
        + priority.weights.promptCompression
        + priority.weights.isolation
      );
      const score = Math.round(problemFit * 0.72 + priorityFit * 0.28);
      const blockers: string[] = [];

      if (strategy.requiresPromptBaseline && !evidence.promptBaseline) {
        blockers.push('prompt baseline missing');
      }
      if (strategy.requiresRetrievalBaseline && !evidence.retrievalBaseline) {
        blockers.push('retrieval baseline missing');
      }
      if (strategy.requiresHeldOutSlices && !evidence.heldOutSlices) {
        blockers.push('held-out slices missing');
      }
      if (strategy.requiresDataRights && !evidence.dataRights) {
        blockers.push('training-data rights unverified');
      }
      if (!evidence.taskContract && strategy.id !== 'measure-first') {
        blockers.push('task contract missing');
      }

      return { strategy, score, blockers };
    }).sort((left, right) => {
      const leftBlocked = left.blockers.length > 0 ? 1 : 0;
      const rightBlocked = right.blockers.length > 0 ? 1 : 0;
      return leftBlocked - rightBlocked || right.score - left.score;
    });

    const recommendation = ranked.find((item) => item.blockers.length === 0) ?? ranked[0];
    const fineTuningReady = evidence.taskContract
      && evidence.promptBaseline
      && evidence.heldOutSlices
      && evidence.dataRights;

    return { fineTuningReady, ranked, recommendation };
  }, [data, evidence, priority, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setEvidenceId(data.defaults.evidenceId);
    setPriorityId(data.defaults.priorityId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Adaptation strategy lab"
          title={data?.title ?? 'Choose the smallest effective intervention'}
          description={data?.description ?? 'Loading the decision model...'}
          icon={Route}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !evidence || !priority || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product scenario
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.failureKind === 'knowledge' ? BookOpenCheck : item.failureKind === 'combined' ? Boxes : Gauge}
                        accent={item.failureKind === 'knowledge' ? 'cyan' : item.failureKind === 'combined' ? 'violet' : 'blue'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Evidence maturity
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.evidenceStates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === evidence.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.heldOutSlices ? ShieldCheck : item.taskContract ? ListChecks : AlertTriangle}
                        accent={item.dataRights ? 'emerald' : item.taskContract ? 'amber' : 'rose'}
                        onClick={() => setEvidenceId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Deployment priority
                  </span>
                  <select
                    value={priority.id}
                    onChange={(event) => setPriorityId(event.target.value)}
                    className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                    {data.priorities.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    {priority.detail}
                  </span>
                </label>
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Failure shape"
                value={scenario.failureKind}
                detail={`${scenario.knowledgeVolatility}% knowledge volatility in this planning fixture`}
                icon={BrainCircuit}
                tone="violet"
              />
              <LabMetric
                label="Contract state"
                value={evidence.taskContract ? 'Defined' : 'Missing'}
                detail={evidence.heldOutSlices ? 'Held-out slices exist' : 'No representative release slices'}
                icon={ListChecks}
                tone={evidence.taskContract ? 'blue' : 'amber'}
              />
              <LabMetric
                label="Fine-tune entry gate"
                value={model.fineTuningReady ? 'Ready' : 'Blocked'}
                detail="Requires baseline, holdout, provenance, and rights"
                icon={model.fineTuningReady ? CheckCircle2 : AlertTriangle}
                tone={model.fineTuningReady ? 'emerald' : 'rose'}
              />
            </div>

            <div className="mt-6 rounded-md border border-cyan-200 bg-cyan-50 p-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50">
              <div className="flex items-start gap-3">
                {(() => {
                  const Icon = strategyIcon(model.recommendation.strategy.id);
                  return <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
                })()}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Recommended next experiment</p>
                  <h4 className="mt-1 text-lg font-semibold">{model.recommendation.strategy.label}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {model.recommendation.strategy.detail}
                  </p>
                  <p className="mt-3 text-sm font-semibold">
                    {model.recommendation.strategy.nextStep}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Strategy fit and prerequisites
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Scores compare this fixture only. Blocked options cannot be selected safely yet.
                  </p>
                </div>
                <GitBranch aria-hidden="true" className="h-5 w-5 text-neutral-400" />
              </div>
              <div className="mt-4 space-y-3">
                {model.ranked.map(({ strategy, score, blockers }) => {
                  const Icon = strategyIcon(strategy.id);
                  const recommended = strategy.id === model.recommendation.strategy.id;
                  return (
                    <div
                      key={strategy.id}
                      className={`rounded-md border p-4 ${
                        recommended
                          ? 'border-cyan-300 bg-cyan-50/70 dark:border-cyan-800 dark:bg-cyan-950/25'
                          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`rounded-md p-2 ${recommended ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300'}`}>
                            <Icon aria-hidden="true" className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {strategy.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                              {blockers.length > 0 ? `Blocked: ${blockers.join(', ')}` : strategy.nextStep}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                          {score}/100
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${blockers.length > 0 ? 'bg-neutral-400 dark:bg-neutral-600' : strategyTone(strategy.id) === 'emerald' ? 'bg-emerald-500' : strategyTone(strategy.id) === 'violet' ? 'bg-violet-500' : strategyTone(strategy.id) === 'amber' ? 'bg-amber-500' : strategyTone(strategy.id) === 'blue' ? 'bg-blue-500' : 'bg-cyan-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              <Rocket aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              A recommendation is an experiment order, not a promise that one method will meet the release gate.
            </p>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
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
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {error ? 'The strategy model could not be loaded.' : 'Loading strategy evidence...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
