'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  CloudCog,
  Code2,
  Database,
  Laptop,
  LoaderCircle,
  Settings2,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Fit = 'recommended' | 'conditional' | 'avoid';
type ComputeChoice = {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  fit: Fit;
  rationale: string;
  proof: string[];
};
type Workload = {
  id: string;
  label: string;
  detail: string;
  icon: 'notebook' | 'job' | 'sql' | 'pipeline';
  choices: ComputeChoice[];
};
type ComputeModel = {
  title: string;
  description: string;
  defaultWorkloadId: string;
  workloads: Workload[];
};

const BLOCK_ID = 'technology/databricks-calculator';
const DEFAULT_DATA_FILE = '/api/content/technology/databricks/data/compute-selection-model.json';

const workloadIcons: Record<Workload['icon'], LucideIcon> = {
  notebook: Laptop,
  job: Workflow,
  sql: BarChart3,
  pipeline: Database,
};

const fitMeta: Record<Fit, {
  label: string;
  heading: string;
  tone: 'emerald' | 'amber' | 'rose';
  icon: LucideIcon;
  className: string;
}> = {
  recommended: {
    label: 'Recommended default',
    heading: 'Start here, then validate with the real workload',
    tone: 'emerald',
    icon: CheckCircle2,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  conditional: {
    label: 'Use for a stated constraint',
    heading: 'Document the requirement that justifies this choice',
    tone: 'amber',
    icon: CircleAlert,
    className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  avoid: {
    label: 'Poor production default',
    heading: 'Choose a workload-specific compute boundary instead',
    tone: 'rose',
    icon: XCircle,
    className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
};

function isComputeModel(value: unknown): value is ComputeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ComputeModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultWorkloadId
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 4
      && candidate.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && ['notebook', 'job', 'sql', 'pipeline'].includes(workload.icon)
        && Array.isArray(workload.choices)
        && workload.choices.length >= 3
        && workload.choices.every((choice) => (
          typeof choice.id === 'string'
          && typeof choice.label === 'string'
          && typeof choice.eyebrow === 'string'
          && typeof choice.detail === 'string'
          && ['recommended', 'conditional', 'avoid'].includes(choice.fit)
          && typeof choice.rationale === 'string'
          && Array.isArray(choice.proof)
          && choice.proof.length >= 2
        ))
      )),
  );
}

export default function DatabricksComputePlanner({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ComputeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isComputeModel(payload)) throw new Error('The compute-selection model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setModel(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the compute model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Compute boundary planner"
            title="Choose compute from the workload contract"
            description="Loading current workload and compute choices."
            icon={CloudCog}
            accent="blue"
          />
          <div className="flex min-h-48 items-center justify-center p-6">
            {error ? (
              <div className="text-center">
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading compute choices
              </div>
            )}
          </div>
        </LearningLab>
      ) : (
        <ComputeWorkbench model={model} />
      )}
    </div>
  );
}

function ComputeWorkbench({ model }: { model: ComputeModel }) {
  const defaultWorkload = model.workloads.find((item) => item.id === model.defaultWorkloadId)
    ?? model.workloads[0];
  const [workloadId, setWorkloadId] = useState(defaultWorkload.id);
  const [choiceId, setChoiceId] = useState(defaultWorkload.choices[0].id);
  const workload = model.workloads.find((item) => item.id === workloadId) ?? defaultWorkload;
  const choice = workload.choices.find((item) => item.id === choiceId) ?? workload.choices[0];
  const meta = fitMeta[choice.fit];
  const VerdictIcon = meta.icon;

  function selectWorkload(next: Workload) {
    setWorkloadId(next.id);
    setChoiceId(next.choices[0].id);
  }

  function reset() {
    setWorkloadId(defaultWorkload.id);
    setChoiceId(defaultWorkload.choices[0].id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Compute boundary planner"
        title={model.title}
        description={model.description}
        icon={CloudCog}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload contract
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workloads.map((item) => {
                  const Icon = workloadIcons[item.icon];
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent="blue"
                      onClick={() => selectWorkload(item)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Candidate compute
              </legend>
              <div className="mt-3 grid gap-2">
                {workload.choices.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === choice.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.fit === 'recommended' ? CheckCircle2 : item.fit === 'conditional' ? Settings2 : CircleHelp}
                    accent={item.fit === 'recommended' ? 'emerald' : item.fit === 'conditional' ? 'amber' : 'rose'}
                    onClick={() => setChoiceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className={`rounded-md border p-5 ${meta.className}`}>
            <div className="flex items-start gap-3">
              <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">{meta.label}</p>
                <h4 className="mt-1 text-lg font-semibold">{meta.heading}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{choice.rationale}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Workload"
              value={workload.label}
              detail="Choose from the task that must run, not from a familiar cluster name"
              icon={workloadIcons[workload.icon]}
              tone="blue"
            />
            <LabMetric
              label="Candidate"
              value={choice.label}
              detail={choice.eyebrow}
              icon={Code2}
              tone={meta.tone}
            />
            <LabMetric
              label="Decision"
              value={meta.label}
              detail="Availability and supported features vary by cloud, region, and workspace"
              icon={VerdictIcon}
              tone={meta.tone}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence to collect before committing
              </p>
            </header>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {choice.proof.map((item, index) => (
                <li key={item} className="flex gap-3 px-4 py-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            This planner encodes documented selection guidance, not prices or performance guarantees. Verify current regional availability, feature support, startup behavior, policy, and measured workload cost before standardizing a compute type.
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
