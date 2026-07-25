'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  FileText,
  GitCommitHorizontal,
  Network,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  rootCause: string;
  action: string;
  bestStartId: string;
  evidence: Array<{
    id: string;
    label: string;
    detail: string;
    signal: 'metric' | 'trace' | 'log' | 'change';
  }>;
};
type StartingSignal = {
  id: string;
  label: string;
  detail: string;
  baseMinutes: number;
  deadEnds: number;
};
type ContextContract = {
  id: string;
  label: string;
  detail: string;
  correlationPercent: number;
  pivotMultiplier: number;
  preservedSignals: string[];
};
type IncidentData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    startingSignalId: string;
    contextId: string;
  };
  scenarios: Scenario[];
  startingSignals: StartingSignal[];
  contextContracts: ContextContract[];
};

const BLOCK_ID = 'technology/observability-incident-correlation-lab';

function isIncidentData(value: unknown): value is IncidentData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IncidentData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.startingSignalId
      && candidate.defaults.contextId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.startingSignals)
      && candidate.startingSignals.length > 0
      && Array.isArray(candidate.contextContracts)
      && candidate.contextContracts.length > 0,
  );
}

export default function ObservabilityIncidentCorrelationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<IncidentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No incident correlation model was supplied.');
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
        if (!isIncidentData(payload)) throw new Error('The incident correlation model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the incident lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <IncidentWorkbench data={data} />;
}

function IncidentWorkbench({ data }: { data: IncidentData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [startingSignalId, setStartingSignalId] = useState(data.defaults.startingSignalId);
  const [contextId, setContextId] = useState(data.defaults.contextId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const startingSignal = data.startingSignals.find((item) => item.id === startingSignalId)
    ?? data.startingSignals[0];
  const context = data.contextContracts.find((item) => item.id === contextId)
    ?? data.contextContracts[0];

  const result = useMemo(() => {
    const startsAtSymptom = startingSignal.id === scenario.bestStartId;
    const visibleEvidence = scenario.evidence.filter((item) => context.preservedSignals.includes(item.signal));
    const missingEvidence = scenario.evidence.filter((item) => !context.preservedSignals.includes(item.signal));
    const pivotCount = Math.max(
      visibleEvidence.length,
      Math.round((startingSignal.deadEnds + scenario.evidence.length) * context.pivotMultiplier)
        + (startsAtSymptom ? 0 : 2),
    );
    const hypothesisMinutes = Math.max(
      3,
      Math.round(startingSignal.baseMinutes * context.pivotMultiplier)
        + missingEvidence.length * 6
        + (startsAtSymptom ? 0 : 8),
    );
    const diagnosisConfidence = Math.max(
      18,
      Math.min(99, context.correlationPercent - missingEvidence.length * 9 + (startsAtSymptom ? 6 : -8)),
    );
    const canAct = visibleEvidence.some((item) => item.signal === 'change')
      && visibleEvidence.some((item) => item.signal === 'trace' || item.signal === 'log');

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The evidence forms an actionable causal chain';
    let detail = `The responder can connect ${scenario.symptom.toLowerCase()} to ${scenario.rootCause.toLowerCase()} and verify the responsible change.`;

    if (visibleEvidence.length <= 1) {
      tone = 'rose';
      verdict = 'The investigation stalls at the symptom';
      detail = 'The selected contract does not preserve enough shared context to move between signal stores. Responders must search broad time ranges and guess at joins.';
    } else if (!canAct) {
      tone = 'amber';
      verdict = 'The path narrows the failure but not the change';
      detail = 'Add version, deploy, flag, and ownership context so the diagnosis leads directly to a safe mitigation.';
    } else if (!startsAtSymptom) {
      tone = 'amber';
      verdict = 'The evidence is connected, but the starting point is expensive';
      detail = 'Begin with the user-visible outcome to constrain time, route, and severity before searching high-volume events.';
    }

    return {
      canAct,
      detail,
      diagnosisConfidence,
      hypothesisMinutes,
      missingEvidence,
      pivotCount,
      startsAtSymptom,
      tone,
      verdict,
      visibleEvidence,
    };
  }, [context, scenario, startingSignal]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setStartingSignalId(data.defaults.startingSignalId);
    setContextId(data.defaults.contextId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Incident correlation lab"
          title={data.title}
          description={data.description}
          icon={FileSearch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Incident"
                items={data.scenarios}
                selectedId={scenario.id}
                icon={CircleAlert}
                accent="rose"
                onSelect={setScenarioId}
              />
              <ChoiceGroup
                label="2. First pivot"
                items={data.startingSignals}
                selectedId={startingSignal.id}
                icon={Search}
                accent="blue"
                onSelect={setStartingSignalId}
              />
              <ChoiceGroup
                label="3. Context contract"
                items={data.contextContracts}
                selectedId={context.id}
                icon={Network}
                accent="violet"
                onSelect={setContextId}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
              <div className="flex items-start gap-3">
                <BellRing aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                <div>
                  <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-300">Observed symptom</p>
                  <p className="mt-1 text-sm font-semibold text-rose-950 dark:text-rose-50">{scenario.symptom}</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Time to hypothesis"
                value={`${result.hypothesisMinutes} min`}
                detail="Modeled investigation time"
                icon={Clock3}
                tone={result.hypothesisMinutes <= 12 ? 'emerald' : result.hypothesisMinutes <= 30 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Manual pivots"
                value={String(result.pivotCount)}
                detail="Searches and cross-tool joins"
                icon={Search}
                tone={result.pivotCount <= 5 ? 'cyan' : result.pivotCount <= 10 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Diagnosis confidence"
                value={`${result.diagnosisConfidence}%`}
                detail={`${result.visibleEvidence.length} of ${scenario.evidence.length} evidence stages linked`}
                icon={ShieldCheck}
                tone={result.diagnosisConfidence >= 80 ? 'emerald' : result.diagnosisConfidence >= 55 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Mitigation ready"
                value={result.canAct ? 'Yes' : 'No'}
                detail={result.canAct ? 'Cause and change are connected' : 'Ownership or change context is missing'}
                icon={GitCommitHorizontal}
                tone={result.canAct ? 'blue' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Incident evidence path" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence path</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Trace the symptom to a responsible change</h4>
              <div className="mt-5 grid gap-3 xl:grid-cols-4">
                {scenario.evidence.map((item, index) => {
                  const visible = result.visibleEvidence.some((evidence) => evidence.id === item.id);
                  return (
                    <EvidenceStep
                      key={item.id}
                      item={item}
                      number={index + 1}
                      visible={visible}
                      connected={visible && (index === 0 || result.visibleEvidence.some((evidence) => evidence.id === scenario.evidence[index - 1]?.id))}
                    />
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Root cause</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {result.diagnosisConfidence >= 55 ? scenario.rootCause : 'Not enough correlated evidence'}
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Safe next action</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {result.canAct ? scenario.action : 'Restore correlation context before changing production'}
                </p>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'rose' | 'blue' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function EvidenceStep({
  item,
  number,
  visible,
  connected,
}: {
  item: Scenario['evidence'][number];
  number: number;
  visible: boolean;
  connected: boolean;
}) {
  const Icon = signalIcon(item.signal);

  return (
    <div className={`relative min-w-0 rounded-md border p-4 ${visible ? 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30' : 'border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/50'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${visible ? 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{number}</span>
        <span className={`text-xs font-semibold uppercase ${connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-500 dark:text-neutral-400'}`}>
          {connected ? 'Linked' : 'Missing link'}
        </span>
      </div>
      <Icon aria-hidden="true" className={`mt-5 h-5 w-5 ${visible ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-400'}`} />
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{item.label}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {visible ? item.detail : `${item.signal} context was not preserved`}
      </p>
    </div>
  );
}

function signalIcon(signal: Scenario['evidence'][number]['signal']): LucideIcon {
  if (signal === 'metric') return Activity;
  if (signal === 'trace') return Network;
  if (signal === 'log') return FileText;
  return GitCommitHorizontal;
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      Loading incident correlation model...
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <p className="font-semibold">Incident correlation model unavailable</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
