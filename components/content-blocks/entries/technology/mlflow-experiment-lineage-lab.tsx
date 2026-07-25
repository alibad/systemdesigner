'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  FileClock,
  GitBranch,
  Link2,
  ListChecks,
  Network,
  SearchCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/mlflow-experiment-lineage-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/mlflow/data/experiment-lineage-model.json';

type Workflow = {
  id: string;
  label: string;
  detail: string;
  requiredFieldIds: string[];
  runCount: number;
};
type Organization = {
  id: string;
  label: string;
  detail: string;
  comparisonPenaltyPct: number;
  supportsParentage: boolean;
};
type EvidenceField = {
  id: string;
  label: string;
  detail: string;
  question: string;
};
type ExperimentLineageData = {
  title: string;
  description: string;
  defaults: {
    workflowId: string;
    organizationId: string;
    capturedFieldIds: string[];
  };
  workflows: Workflow[];
  organizations: Organization[];
  fields: EvidenceField[];
};

const fieldIcons: Record<string, LucideIcon> = {
  parameters: Boxes,
  metrics: SearchCheck,
  'dataset-reference': Database,
  'code-version': GitBranch,
  environment: FileClock,
  'model-signature': Link2,
  'parent-run': Network,
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isExperimentLineageData(value: unknown): value is ExperimentLineageData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ExperimentLineageData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.workflowId === 'string'
      && typeof data.defaults.organizationId === 'string'
      && isStringArray(data.defaults.capturedFieldIds)
      && Array.isArray(data.workflows)
      && data.workflows.length > 0
      && data.workflows.every((workflow) => (
        typeof workflow.id === 'string'
        && typeof workflow.label === 'string'
        && typeof workflow.detail === 'string'
        && isStringArray(workflow.requiredFieldIds)
        && typeof workflow.runCount === 'number'
      ))
      && Array.isArray(data.organizations)
      && data.organizations.length > 0
      && data.organizations.every((organization) => (
        typeof organization.id === 'string'
        && typeof organization.label === 'string'
        && typeof organization.detail === 'string'
        && typeof organization.comparisonPenaltyPct === 'number'
        && typeof organization.supportsParentage === 'boolean'
      ))
      && Array.isArray(data.fields)
      && data.fields.length > 0
      && data.fields.every((field) => (
        typeof field.id === 'string'
        && typeof field.label === 'string'
        && typeof field.detail === 'string'
        && typeof field.question === 'string'
      )),
  );
}

export default function MlflowExperimentLineageLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ExperimentLineageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lineage data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isExperimentLineageData(value)) {
          throw new Error('The lineage model does not match the expected contract.');
        }
        setData(value);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load lineage data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ExperimentLineageWorkbench data={data} />;
}

function ExperimentLineageWorkbench({ data }: { data: ExperimentLineageData }) {
  const [workflowId, setWorkflowId] = useState(data.defaults.workflowId);
  const [organizationId, setOrganizationId] = useState(data.defaults.organizationId);
  const [capturedFieldIds, setCapturedFieldIds] = useState(data.defaults.capturedFieldIds);

  const workflow = data.workflows.find((item) => item.id === workflowId) ?? data.workflows[0];
  const organization = data.organizations.find((item) => item.id === organizationId)
    ?? data.organizations[0];
  const result = useMemo(() => {
    const captured = new Set(capturedFieldIds);
    const missing = workflow.requiredFieldIds.filter((id) => !captured.has(id));
    const required = new Set(workflow.requiredFieldIds);
    const answered = data.fields.filter((field) => required.has(field.id) && captured.has(field.id));
    const parentageRisk = workflow.id === 'distributed-search' && !organization.supportsParentage;
    const completeness = Math.round(
      (workflow.requiredFieldIds.length - missing.length) / workflow.requiredFieldIds.length * 100,
    );
    const comparisonScore = Math.max(0, completeness - organization.comparisonPenaltyPct);
    const releasable = missing.length === 0 && !parentageRisk && organization.comparisonPenaltyPct === 0;
    return { answered, comparisonScore, completeness, missing, parentageRisk, releasable };
  }, [capturedFieldIds, data.fields, organization, workflow]);

  function toggleField(fieldId: string) {
    setCapturedFieldIds((current) => current.includes(fieldId)
      ? current.filter((id) => id !== fieldId)
      : [...current, fieldId]);
  }

  function reset() {
    setWorkflowId(data.defaults.workflowId);
    setOrganizationId(data.defaults.organizationId);
    setCapturedFieldIds(data.defaults.capturedFieldIds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Experiment lineage lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Training workflow
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workflows.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={workflow.id === item.id}
                      label={item.label}
                      detail={`${item.detail} ${item.runCount} modeled runs.`}
                      icon={Network}
                      accent="cyan"
                      onClick={() => setWorkflowId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Experiment organization
                </legend>
                <div className="mt-3 space-y-2">
                  {data.organizations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={organization.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Boxes}
                      accent="violet"
                      onClick={() => setOrganizationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Evidence captured on every run
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Toggle evidence to see which production questions remain answerable.
              </p>
            </div>
            <span className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold ${
              result.releasable
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
            }`}>
              {result.releasable ? 'Answerable record' : 'Evidence incomplete'}
            </span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {data.fields.map((field) => {
              const selected = capturedFieldIds.includes(field.id);
              const required = workflow.requiredFieldIds.includes(field.id);
              const Icon = fieldIcons[field.id] ?? ListChecks;
              return (
                <button
                  key={field.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleField(field.id)}
                  className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                      selected
                        ? 'border-cyan-500 bg-cyan-600 text-white'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}>
                      {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {field.label}
                        {required ? <span className="text-[11px] uppercase opacity-70">Required</span> : null}
                      </span>
                      <span className="mt-1 block text-xs leading-5 opacity-75">{field.detail}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric label="Required evidence" value={`${result.completeness}%`} detail={`${result.missing.length} missing fields`} icon={ListChecks} tone={result.completeness === 100 ? 'emerald' : 'amber'} />
            <LabMetric label="Comparison score" value={`${result.comparisonScore}%`} detail="After organization penalty" icon={SearchCheck} tone={result.comparisonScore >= 90 ? 'emerald' : 'violet'} />
            <LabMetric label="Answerable questions" value={`${result.answered.length}/${workflow.requiredFieldIds.length}`} detail={`${workflow.runCount} modeled runs`} icon={CircleAlert} tone={result.releasable ? 'emerald' : 'rose'} />
          </div>

          <div aria-live="polite" className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence review</p>
            </div>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.fields.filter((field) => workflow.requiredFieldIds.includes(field.id)).map((field) => {
                const answered = capturedFieldIds.includes(field.id);
                return (
                  <li key={field.id} className="flex items-start gap-3 px-4 py-3">
                    {answered
                      ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{field.question}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                        {answered ? `${field.label} is captured on this run.` : `Missing ${field.label.toLowerCase()}; the record cannot answer this reliably.`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {result.parentageRisk ? (
            <p className="mt-5 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
              Distributed search needs parent-child run relationships. This organization loses the boundary between the search and its trials.
            </p>
          ) : null}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return <div data-content-block={BLOCK_ID} aria-label="Loading MLflow lineage lab" className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />;
}

function LoadError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{detail}</div>;
}
