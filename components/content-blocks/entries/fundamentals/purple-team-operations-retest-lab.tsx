'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  Check,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Siren,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/purple-team-operations-retest-lab';
const DEFAULT_DATA_FILE = '/api/content/fundamentals/purple-team-operations/data/technique-proof-scenarios.json';

type ProofStage = {
  id: string;
  label: string;
  evidence: string;
};

type TechniqueScenario = {
  id: string;
  label: string;
  technique: string;
  boundary: string;
  expectedTelemetry: string;
  expectedResponse: string;
  stages: ProofStage[];
};

type ProofModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  scenarios: TechniqueScenario[];
};

function isProofModel(value: unknown): value is ProofModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProofModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        scenario.id
        && scenario.label
        && scenario.technique
        && scenario.boundary
        && scenario.expectedTelemetry
        && scenario.expectedResponse
        && Array.isArray(scenario.stages)
        && scenario.stages.length === 5
        && scenario.stages.every((stage) => stage.id && stage.label && stage.evidence)
      )),
  );
}

export default function PurpleTeamOperationsRetestLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ProofModel | null>(null);
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
        if (!isProofModel(payload)) throw new Error('The technique proof model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Technique proof lab"
            title="Build an evidence chain from execution to retest"
            description="Loading the lesson-owned scenarios."
            icon={ShieldCheck}
            accent="rose"
          />
          <LearningLabBody>
            <div className="flex min-h-40 items-center justify-center text-center">
              {error ? (
                <div>
                  <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-200"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <span className="text-sm text-neutral-600 dark:text-neutral-300">Loading proof scenarios</span>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return <TechniqueProofWorkbench model={model} />;
}

function TechniqueProofWorkbench({ model }: { model: ProofModel }) {
  const initialScenario = model.scenarios.find((scenario) => scenario.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [completed, setCompleted] = useState<string[]>([]);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];

  const result = useMemo(() => {
    const completedCount = scenario.stages.filter((stage) => completed.includes(stage.id)).length;
    const firstMissing = scenario.stages.find((stage) => !completed.includes(stage.id));
    return {
      completedCount,
      firstMissing,
      verified: completedCount === scenario.stages.length,
    };
  }, [completed, scenario]);

  function chooseScenario(nextId: string) {
    setScenarioId(nextId);
    setCompleted([]);
  }

  function toggleStage(id: string) {
    setCompleted((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Technique proof lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={() => {
            setScenarioId(initialScenario.id);
            setCompleted([]);
          }}
        />
        <LearningLabBody
          controls={(
            <fieldset className="space-y-3">
              <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose an authorized technique
              </legend>
              {model.scenarios.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === scenario.id}
                  label={item.label}
                  detail={item.technique}
                  accent="rose"
                  onClick={() => chooseScenario(item.id)}
                />
              ))}
            </fieldset>
          )}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <LabMetric label="Scope boundary" value={scenario.boundary} icon={Siren} tone="rose" />
            <LabMetric label="Expected telemetry" value={scenario.expectedTelemetry} icon={RadioTower} tone="cyan" />
            <LabMetric label="Expected response" value={scenario.expectedResponse} icon={BellRing} tone="amber" />
          </div>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              2. Record the evidence actually observed
            </legend>
            <div className="mt-3 grid gap-3">
              {scenario.stages.map((stage, index) => {
                const selected = completed.includes(stage.id);
                const Icon = [RadioTower, Activity, FileSearch, Siren, RotateCcw][index];
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleStage(stage.id)}
                    className={`grid min-h-20 grid-cols-[40px_minmax(0,1fr)_24px] items-center gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                        : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                    }`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-900">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{index + 1}. {stage.label}</span>
                      <span className="mt-1 block text-xs leading-5 opacity-75">{stage.evidence}</span>
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-neutral-300 dark:border-neutral-700'}`}>
                      {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className={`mt-6 rounded-md border p-4 ${
            result.verified
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
          }`}>
            <div className="flex items-start gap-3">
              {result.verified ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {result.verified
                    ? 'Improvement verified: the same technique completed the full evidence chain.'
                    : `${result.completedCount} of ${scenario.stages.length} proof stages recorded.`}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  {result.verified
                    ? 'Preserve the evidence, owner, control version, and test timestamp so the result can be reproduced.'
                    : `Next missing proof: ${result.firstMissing?.label}. A successful attack replay alone is not a defensive improvement.`}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
