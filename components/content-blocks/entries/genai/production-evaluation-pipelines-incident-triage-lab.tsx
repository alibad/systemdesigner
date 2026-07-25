'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Eye,
  GitCompareArrows,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type LensId = 'aggregate' | 'slice' | 'trace';
type ActionId = 'continue' | 'pause' | 'rollback';
type Tone = 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';

interface Finding {
  headline: string;
  detail: string;
  confidence: number;
  suspect: string;
}

interface IncidentScenario {
  id: string;
  label: string;
  detail: string;
  sliceLabel: string;
  globalQualityDeltaPct: number;
  sliceQualityDeltaPct: number;
  p95LatencyDeltaPct: number;
  errorRatePct: number;
  complaintRatePct: number;
  exposedUsersPerHour: number;
  recommendedAction: ActionId;
  recommendation: string;
  rootStageId: string;
  rollbackTarget: string;
  findings: Record<LensId, Finding>;
}

interface IncidentData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    lensId: LensId;
    actionId: ActionId;
  };
  stages: Array<{ id: string; label: string; responsibility: string }>;
  scenarios: IncidentScenario[];
}

const BLOCK_ID = 'genai/production-evaluation-pipelines-incident-triage-lab';

const lenses: Array<{ id: LensId; label: string; detail: string }> = [
  { id: 'aggregate', label: 'Fleet aggregate', detail: 'Fast signal, but mixed traffic can hide a damaged cohort.' },
  { id: 'slice', label: 'Product and cohort slices', detail: 'Compare versions, tasks, languages, tenants, and risk classes.' },
  { id: 'trace', label: 'Versioned trace join', detail: 'Join output quality to prompt, model, retrieval, tool, and route identity.' },
];

const actions: Array<{ id: ActionId; label: string; detail: string; icon: typeof PlayCircle }> = [
  { id: 'continue', label: 'Continue rollout', detail: 'Keep exposure unchanged while collecting evidence.', icon: PlayCircle },
  { id: 'pause', label: 'Pause and investigate', detail: 'Stop expansion while preserving the current canary.', icon: PauseCircle },
  { id: 'rollback', label: 'Rollback candidate', detail: 'Route new traffic to the last known-good release.', icon: RotateCcw },
];

function isIncidentData(value: unknown): value is IncidentData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IncidentData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.stages)
      && candidate.stages.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export default function ProductionEvaluationPipelinesIncidentTriageLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<IncidentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No production incident model was supplied.');
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
        if (!isIncidentData(payload)) throw new Error('Production incident data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load production incident data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <IncidentTriageLab data={data} />;
}

function IncidentTriageLab({ data }: { data: IncidentData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [lensId, setLensId] = useState<LensId>(data.defaults.lensId);
  const [actionId, setActionId] = useState<ActionId>(data.defaults.actionId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const finding = scenario.findings[lensId];

  const result = useMemo(() => {
    const matchesRecommendation = actionId === scenario.recommendedAction;
    const evidenceStrong = finding.confidence >= 0.75;
    const unsafeContinue = actionId === 'continue' && scenario.recommendedAction !== 'continue';
    const unnecessaryRollback = actionId === 'rollback' && scenario.recommendedAction === 'continue';

    let verdict = 'Decision conflicts with the observed failure mode';
    let tone: Tone = 'amber';
    if (matchesRecommendation && evidenceStrong) {
      verdict = 'Defensible response with traceable evidence';
      tone = 'emerald';
    } else if (matchesRecommendation) {
      verdict = 'Likely response, but evidence is too weak to defend';
      tone = 'amber';
    } else if (unsafeContinue) {
      verdict = 'Unsafe continuation keeps the regression exposed';
      tone = 'rose';
    } else if (unnecessaryRollback) {
      verdict = 'Rollback is faster than the evidence justifies';
      tone = 'violet';
    }

    const exposure = actionId === 'continue'
      ? scenario.exposedUsersPerHour
      : actionId === 'pause'
        ? Math.round(scenario.exposedUsersPerHour * 0.08)
        : 0;
    const recovery = actionId === 'rollback' ? 8 : actionId === 'pause' ? 35 : 120;
    const evidencePreserved = lensId === 'trace'
      ? 'Version-complete'
      : lensId === 'slice'
        ? 'Cohort-complete'
        : 'Aggregate only';

    return {
      evidencePreserved,
      evidenceStrong,
      exposure,
      recovery,
      tone,
      verdict,
    };
  }, [actionId, finding.confidence, lensId, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setLensId(data.defaults.lensId);
    setActionId(data.defaults.actionId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Production incident lab"
          title={data.title}
          description={data.description}
          icon={SearchCheck}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Observed incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldAlert}
                      accent={item.recommendedAction === 'rollback' ? 'rose' : item.recommendedAction === 'pause' ? 'amber' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Investigation lens
                </legend>
                <div className="mt-3 grid gap-2">
                  {lenses.map((lens) => (
                    <LabChoice
                      key={lens.id}
                      selected={lensId === lens.id}
                      label={lens.label}
                      detail={lens.detail}
                      icon={lens.id === 'trace' ? GitCompareArrows : Eye}
                      accent={lens.id === 'trace' ? 'emerald' : lens.id === 'slice' ? 'violet' : 'blue'}
                      onClick={() => setLensId(lens.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Operational response
                </legend>
                <div className="mt-3 grid gap-2">
                  {actions.map((action) => (
                    <LabChoice
                      key={action.id}
                      selected={actionId === action.id}
                      label={action.label}
                      detail={action.detail}
                      icon={action.icon}
                      accent={action.id === 'rollback' ? 'rose' : action.id === 'pause' ? 'amber' : 'emerald'}
                      onClick={() => setActionId(action.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[660px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Fleet quality delta"
                value={signedPct(scenario.globalQualityDeltaPct)}
                detail="Aggregate across all routed traffic"
                icon={Activity}
                tone={Math.abs(scenario.globalQualityDeltaPct) < 2 ? 'blue' : 'rose'}
              />
              <LabMetric
                label={`${scenario.sliceLabel} quality delta`}
                value={signedPct(scenario.sliceQualityDeltaPct)}
                detail="Critical cohort compared with its baseline"
                icon={GitCompareArrows}
                tone={scenario.sliceQualityDeltaPct <= -3 ? 'rose' : 'violet'}
              />
              <LabMetric
                label="P95 latency delta"
                value={signedPct(scenario.p95LatencyDeltaPct)}
                detail={`Error rate: ${scenario.errorRatePct.toFixed(1)}%`}
                icon={TimerReset}
                tone={scenario.p95LatencyDeltaPct >= 20 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Complaint rate"
                value={`${scenario.complaintRatePct.toFixed(1)}%`}
                detail="Delayed and selection-biased signal"
                icon={CircleAlert}
                tone={scenario.complaintRatePct >= 2 ? 'amber' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    {lenses.find((lens) => lens.id === lensId)?.label} finding
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{finding.headline}</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{finding.detail}</p>
                </div>
                <div className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-2 text-right dark:border-neutral-700 dark:bg-neutral-950">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence confidence</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                    {(finding.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Versioned signal path
              </p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.stages.map((stage, index) => {
                  const isRoot = lensId === 'trace' && stage.id === scenario.rootStageId;
                  return (
                    <li
                      key={stage.id}
                      className={`min-w-0 rounded-md border p-4 ${isRoot
                        ? 'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-300 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-900'
                        : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100'}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-70">
                        <span>Stage {index + 1}</span>
                        <span>{isRoot ? 'Root cause' : 'Observed'}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{stage.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">
                        {isRoot ? finding.suspect : stage.responsibility}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${outcomeClasses[result.tone]}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Response consequence</p>
              <p className="mt-1 text-lg font-semibold">{result.verdict}</p>
              <p className="mt-2 text-sm leading-6 opacity-80">{scenario.recommendation}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Consequence label="Users exposed next hour" value={result.exposure.toLocaleString()} />
                <Consequence label="Estimated containment" value={`${result.recovery} min`} />
                <Consequence label="Evidence retained" value={result.evidencePreserved} />
              </div>
              <p className="mt-4 rounded-md border border-current/20 bg-white/40 px-3 py-2 text-sm dark:bg-black/10">
                Rollback target: <span className="font-semibold">{scenario.rollbackTarget}</span>
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Consequence({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-current/20 bg-white/50 p-3 dark:bg-black/10">
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 break-words text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const outcomeClasses: Record<Tone, string> = {
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
  violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
};

function LabLoading() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[760px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading production incident lab"
    />
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Production incident lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
