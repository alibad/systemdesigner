'use client';

import { useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  ListRestart,
  RefreshCcw,
  Route,
  ScanSearch,
  Tags,
  UsersRound,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type IncidentId = 'topic-skew' | 'template-loop' | 'metadata-gap' | 'taxonomy-drift';
type ActionId = 'targeted-collection' | 'template-cleanup' | 'metadata-repair' | 'taxonomy-review';

type Incident = {
  id: IncidentId;
  label: string;
  signal: string;
  cause: string;
  metric: string;
  before: number;
  bestAction: ActionId;
  recovery: number;
  rerun: string;
};

type Action = {
  id: ActionId;
  label: string;
  detail: string;
  icon: typeof Route;
};

const incidents: Incident[] = [
  {
    id: 'topic-skew',
    label: 'Support-domain collapse',
    signal: 'Billing is 54% of examples; accessibility is only 3%.',
    cause: 'The collection brief rewarded total volume without domain quotas.',
    metric: 'Topic coverage',
    before: 52,
    bestAction: 'targeted-collection',
    recovery: 28,
    rerun: 'Ingest, topic assignment, and dependent aggregates',
  },
  {
    id: 'template-loop',
    label: 'Prompt-template repetition',
    signal: '63% of prompts begin with the same instruction pattern.',
    cause: 'One generation template produced many superficial topic variants.',
    metric: 'Linguistic variety',
    before: 41,
    bestAction: 'template-cleanup',
    recovery: 37,
    rerun: 'Duplicate detection, linguistic features, and aggregates',
  },
  {
    id: 'metadata-gap',
    label: 'Unknown locale evidence',
    signal: 'Locale is missing for 39% of the project snapshot.',
    cause: 'A source connector dropped consented locale metadata during export.',
    metric: 'Evidence completeness',
    before: 61,
    bestAction: 'metadata-repair',
    recovery: 34,
    rerun: 'Metadata validation, representation slices, and aggregates',
  },
  {
    id: 'taxonomy-drift',
    label: 'Unclassified launch topics',
    signal: 'The other/unknown topic bucket grew from 7% to 28%.',
    cause: 'A product launch introduced themes absent from the frozen taxonomy.',
    metric: 'Topic assignment',
    before: 58,
    bestAction: 'taxonomy-review',
    recovery: 25,
    rerun: 'Topic assignment and dependent aggregates',
  },
];

const actions: Action[] = [
  {
    id: 'targeted-collection',
    label: 'Collect against slice quotas',
    detail: 'Add examples only for measured domain and difficulty gaps.',
    icon: UsersRound,
  },
  {
    id: 'template-cleanup',
    label: 'Remove template families',
    detail: 'Cluster repeated forms, remove excess copies, and rewrite prompts.',
    icon: ArchiveRestore,
  },
  {
    id: 'metadata-repair',
    label: 'Restore source metadata',
    detail: 'Repair the approved source field and preserve unknowns when unavailable.',
    icon: FileWarning,
  },
  {
    id: 'taxonomy-review',
    label: 'Review the topic taxonomy',
    detail: 'Name, merge, or reject emerging clusters before rescoring.',
    icon: Tags,
  },
];

const weakEffects: Record<ActionId, string> = {
  'targeted-collection': 'More examples increase volume, but the diagnosed signal remains largely unchanged.',
  'template-cleanup': 'Removing examples can shrink the dataset without repairing the missing evidence or target gap.',
  'metadata-repair': 'Metadata work does not change content imbalance when the source examples themselves are skewed.',
  'taxonomy-review': 'Renaming clusters improves interpretation but cannot repair repetition or absent populations.',
};

export default function DatasetDiversityDashboardRemediationLab() {
  const [incidentId, setIncidentId] = useState<IncidentId>('template-loop');
  const [actionId, setActionId] = useState<ActionId>('targeted-collection');

  const model = useMemo(() => {
    const incident = incidents.find((item) => item.id === incidentId) ?? incidents[1];
    const action = actions.find((item) => item.id === actionId) ?? actions[0];
    const correct = incident.bestAction === action.id;
    const gain = correct ? incident.recovery : action.id === 'taxonomy-review' ? 5 : 3;
    const after = Math.min(96, incident.before + gain);
    const reportState = correct ? 'Targeted rerun' : 'Gap remains';

    return { incident, action, correct, after, gain, reportState };
  }, [actionId, incidentId]);

  const reset = () => {
    setIncidentId('template-loop');
    setActionId('targeted-collection');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Coverage repair lab"
        title="Choose remediation that fixes the evidence"
        description="Inject a failed report, inspect its signal, and choose the smallest corrective action. The model shows whether the gap closes and which stages need a rerun."
        icon={RefreshCcw}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a report failure
              </legend>
              <div className="mt-3 space-y-2">
                {incidents.map((incident) => (
                  <LabChoice
                    key={incident.id}
                    selected={incident.id === incidentId}
                    label={incident.label}
                    detail={incident.signal}
                    icon={ScanSearch}
                    accent="rose"
                    onClick={() => setIncidentId(incident.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose one remediation
              </legend>
              <div className="mt-3 space-y-2">
                {actions.map((action) => (
                  <LabChoice
                    key={action.id}
                    selected={action.id === actionId}
                    label={action.label}
                    detail={action.detail}
                    icon={action.icon}
                    accent="emerald"
                    onClick={() => setActionId(action.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Before"
            value={`${model.incident.before}/100`}
            detail={model.incident.metric}
            icon={CircleAlert}
            tone="rose"
          />
          <LabMetric
            label="After action"
            value={`${model.after}/100`}
            detail={`Projected +${model.gain} points`}
            icon={model.correct ? CheckCircle2 : CircleAlert}
            tone={model.correct ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Rerun scope"
            value={model.correct ? 'Bounded' : 'Unclear'}
            detail={model.correct ? 'Only dependent stages' : 'Diagnosis is unresolved'}
            icon={ListRestart}
            tone={model.correct ? 'blue' : 'neutral'}
          />
          <LabMetric
            label="Report state"
            value={model.reportState}
            detail="Never overwrite the prior complete report"
            icon={FileWarning}
            tone={model.correct ? 'violet' : 'amber'}
          />
        </div>

        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Diagnosis</p>
          <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{model.incident.label}</h4>
          <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.incident.signal}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Likely cause</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.incident.cause}</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Selected action</p>
              <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-white">{model.action.label}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{model.action.detail}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold">Before</span>
                <span className="font-semibold tabular-nums">{model.incident.before}/100</span>
              </div>
              <div
                className="mt-1.5 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label={`${model.incident.metric} before remediation`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={model.incident.before}
              >
                <div className="h-full bg-rose-500" style={{ width: `${model.incident.before}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-300">
                <span className="font-semibold">Projected after action</span>
                <span className="font-semibold tabular-nums">{model.after}/100</span>
              </div>
              <div
                className="relative mt-1.5 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label={`${model.incident.metric} after remediation`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={model.after}
              >
                <div
                  className={`h-full ${model.correct ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${model.after}%` }}
                />
                <span aria-hidden="true" className="absolute inset-y-0 left-[75%] w-0.5 bg-neutral-950 dark:bg-white" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>{model.incident.metric}</span>
              <span>75-point review threshold</span>
            </div>
          </div>
        </div>

        <div
          className={`mt-5 rounded-lg border p-5 ${model.correct ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'}`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.correct ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                {model.correct ? 'Remediation matches the diagnosis' : 'Remediation misses the cause'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {model.correct
                  ? `Preserve the old report, apply this change, then rerun: ${model.incident.rerun}.`
                  : weakEffects[model.action.id]}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
