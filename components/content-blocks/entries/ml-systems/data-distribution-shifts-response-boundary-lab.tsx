'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Gauge,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-distribution-shifts/data/response-boundary-cases.json';
const BLOCK_ID = 'ml-systems/data-distribution-shifts-response-boundary-lab';

type ActionId = 'observe' | 'repair-source' | 'contain' | 'recalibrate' | 'retrain';
type ConditionalRelation = 'stable' | 'changed' | 'unknown';

type Action = {
  id: ActionId;
  label: string;
  detail: string;
  changes: string;
  exposure: string;
};

type IncidentCase = {
  id: string;
  label: string;
  context: string;
  pipelineHealthy: boolean;
  conditionalRelation: ConditionalRelation;
  prevalenceShift: boolean;
  defaultHarm: number;
  defaultEvidence: number;
  guardrail: string;
  validation: string;
};

type LabData = {
  title: string;
  description: string;
  defaultCase: string;
  defaultAction: ActionId;
  actions: Action[];
  cases: IncidentCase[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultCase === 'string' &&
      typeof data.defaultAction === 'string' &&
      Array.isArray(data.actions) &&
      data.actions.length === 5 &&
      data.actions.every(
        (action) =>
          typeof action.id === 'string' &&
          typeof action.label === 'string' &&
          typeof action.changes === 'string',
      ) &&
      Array.isArray(data.cases) &&
      data.cases.length > 0 &&
      data.cases.every(
        (incident) =>
          typeof incident.id === 'string' &&
          typeof incident.pipelineHealthy === 'boolean' &&
          typeof incident.defaultHarm === 'number' &&
          typeof incident.defaultEvidence === 'number',
      ),
  );
}

const actionIcons: Record<ActionId, LucideIcon> = {
  observe: Eye,
  'repair-source': Wrench,
  contain: ShieldAlert,
  recalibrate: SlidersHorizontal,
  retrain: RefreshCw,
};

function chooseRecommendedAction(
  incident: IncidentCase,
  harm: number,
  labeledEvidence: number,
): ActionId {
  if (!incident.pipelineHealthy) return 'repair-source';
  if (harm >= 80 && labeledEvidence < 60) return 'contain';
  if (incident.conditionalRelation === 'changed' && labeledEvidence >= 65) return 'retrain';
  if (
    incident.prevalenceShift &&
    incident.conditionalRelation === 'stable' &&
    labeledEvidence >= 40
  ) {
    return 'recalibrate';
  }
  return 'observe';
}

function recommendationReason(
  action: ActionId,
  incident: IncidentCase,
  harm: number,
  labeledEvidence: number,
) {
  if (action === 'repair-source') {
    return 'The input contract is broken. Any model update would learn from evidence the serving path should reject.';
  }
  if (action === 'contain') {
    return `Confirmed harm is ${harm}/100 while labeled evidence is only ${labeledEvidence}/100. Reduce exposure before making an irreversible diagnosis.`;
  }
  if (action === 'retrain') {
    return 'The pipeline is healthy and labeled evidence supports a changed input-to-outcome relationship, so a candidate model is justified.';
  }
  if (action === 'recalibrate') {
    return 'Outcome prevalence moved while labeled ranking remains stable, so adjust the decision policy before relearning the score.';
  }
  return 'Current evidence does not cross a repair, containment, recalibration, or retraining boundary. Improve labels and keep watching impact.';
}

function selectionConsequence(
  selected: ActionId,
  recommended: ActionId,
  incident: IncidentCase,
  harm: number,
  labeledEvidence: number,
) {
  if (selected === recommended) return incident.validation;
  if (!incident.pipelineHealthy) {
    return 'The broken source remains active, so malformed evidence can reach serving or the next training window.';
  }
  if (selected === 'retrain' && labeledEvidence < 65) {
    return 'The training boundary opens before labels are representative enough to prove what relationship changed.';
  }
  if (selected === 'observe' && harm >= 80) {
    return 'Severe exposure continues while the team waits for evidence; a reversible fallback is the safer immediate boundary.';
  }
  if (selected === 'recalibrate' && incident.conditionalRelation === 'changed') {
    return 'A threshold change can hide changed model validity without restoring the score-to-outcome relationship.';
  }
  if (selected === 'contain' && harm < 50) {
    return 'Traffic is disrupted before evidence demonstrates material harm; observation preserves optionality at lower cost.';
  }
  if (selected === 'repair-source' && incident.pipelineHealthy) {
    return 'The action changes a healthy pipeline and does not address the evidence behind this incident.';
  }
  return `This action is premature for harm ${harm}/100 and evidence ${labeledEvidence}/100; compare it with the recommended boundary.`;
}

export default function DataDistributionShiftsResponseBoundaryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState('changed-policy');
  const [actionId, setActionId] = useState<ActionId>('observe');
  const [harm, setHarm] = useState(73);
  const [labeledEvidence, setLabeledEvidence] = useState(82);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load response cases (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The response cases do not match the expected contract.');
        }
        const initialCase =
          value.cases.find((incident) => incident.id === value.defaultCase) ?? value.cases[0];
        setData(value);
        setCaseId(initialCase.id);
        setActionId(value.defaultAction);
        setHarm(initialCase.defaultHarm);
        setLabeledEvidence(initialCase.defaultEvidence);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load response cases.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const incident = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
    const selectedAction = data.actions.find((item) => item.id === actionId) ?? data.actions[0];
    const recommendedId = chooseRecommendedAction(incident, harm, labeledEvidence);
    const recommendedAction =
      data.actions.find((item) => item.id === recommendedId) ?? data.actions[0];
    return {
      incident,
      selectedAction,
      recommendedAction,
      aligned: selectedAction.id === recommendedAction.id,
      reason: recommendationReason(recommendedId, incident, harm, labeledEvidence),
      consequence: selectionConsequence(
        selectedAction.id,
        recommendedId,
        incident,
        harm,
        labeledEvidence,
      ),
    };
  }, [actionId, caseId, data, harm, labeledEvidence]);

  const chooseCase = (incident: IncidentCase) => {
    setCaseId(incident.id);
    setHarm(incident.defaultHarm);
    setLabeledEvidence(incident.defaultEvidence);
  };

  const reset = () => {
    if (!data) return;
    const initialCase = data.cases.find((incident) => incident.id === data.defaultCase) ?? data.cases[0];
    setCaseId(initialCase.id);
    setActionId(data.defaultAction);
    setHarm(initialCase.defaultHarm);
    setLabeledEvidence(initialCase.defaultEvidence);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading response boundary lab"
      />
    );
  }

  const SelectedIcon = actionIcons[result.selectedAction.id];

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Response boundary lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose an incident
                </legend>
                <div className="mt-3 space-y-2">
                  {data.cases.map((incident) => (
                    <LabChoice
                      key={incident.id}
                      selected={incident.id === result.incident.id}
                      label={incident.label}
                      detail={incident.context}
                      accent="violet"
                      onClick={() => chooseCase(incident)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-5 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <LabRange
                  label="Confirmed harm"
                  value={harm}
                  output={`${harm} / 100`}
                  min={0}
                  max={100}
                  step={1}
                  accent="rose"
                  lowLabel="Limited"
                  highLabel="Severe"
                  onChange={setHarm}
                />
                <LabRange
                  label="Labeled evidence"
                  value={labeledEvidence}
                  output={`${labeledEvidence}%`}
                  min={0}
                  max={100}
                  step={1}
                  accent="cyan"
                  lowLabel="Sparse"
                  highLabel="Representative"
                  onChange={setLabeledEvidence}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Authorize an action
                </legend>
                <div className="mt-3 space-y-2">
                  {data.actions.map((action) => (
                    <LabChoice
                      key={action.id}
                      selected={action.id === result.selectedAction.id}
                      label={action.label}
                      detail={action.detail}
                      icon={actionIcons[action.id]}
                      accent="cyan"
                      onClick={() => setActionId(action.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Pipeline contract"
              value={result.incident.pipelineHealthy ? 'Healthy' : 'Broken'}
              detail="A broken contract blocks model adaptation"
              icon={result.incident.pipelineHealthy ? CheckCircle2 : AlertTriangle}
              tone={result.incident.pipelineHealthy ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Conditional evidence"
              value={result.incident.conditionalRelation}
              detail="Does labeled P(Y|X) appear stable?"
              icon={Gauge}
              tone={result.incident.conditionalRelation === 'changed' ? 'violet' : 'neutral'}
            />
            <LabMetric
              label="Decision fit"
              value={result.aligned ? 'Aligned' : 'Risky'}
              detail="Compare the selected action with the evidence boundary"
              icon={result.aligned ? CheckCircle2 : AlertTriangle}
              tone={result.aligned ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evidence-supported boundary
            </p>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className="text-xl font-semibold text-neutral-950 dark:text-white">
                  {result.recommendedAction.label}
                </h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {result.reason}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                Recommended now
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3" aria-label="Selected response release path">
            <div className="relative rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                <SelectedIcon aria-hidden="true" className="h-4 w-4" />
              </span>
              <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Change
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {result.selectedAction.changes}
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                2
              </span>
              <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Exposure
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {result.selectedAction.exposure}
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                3
              </span>
              <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Validation
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {result.incident.validation}
              </p>
            </div>
          </div>

          <div
            className={`mt-4 rounded-md border p-5 ${
              result.aligned
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {result.aligned ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  {result.aligned ? 'Controlled boundary' : 'Selected-action risk'}
                </p>
                <h4 className="mt-1 text-lg font-semibold">{result.selectedAction.label}</h4>
                <p className="mt-2 text-sm leading-6">{result.consequence}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="text-xs font-semibold uppercase opacity-75">Non-negotiable guardrail</p>
            <p className="mt-2 text-sm leading-6">{result.incident.guardrail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
