'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Gauge,
  HardDrive,
  History,
  RotateCcw,
  ServerCog,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OutcomeStatus = 'effective' | 'partial' | 'harmful';

type Outcome = {
  status: OutcomeStatus;
  headline: string;
  consequence: string;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  signal: string;
  dataRisk: string;
  evidence: string[];
  requiredSequence: string[];
  outcomes: Record<string, Outcome>;
};

type Action = {
  id: string;
  label: string;
  detail: string;
  category: string;
};

type OperationsModel = {
  kind: 'etcd-operations-recovery';
  blockId: string;
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    actionId: string;
  };
  incidents: Incident[];
  actions: Action[];
};

const BLOCK_ID = 'technology/etcd-operations-recovery-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOperationsModel(value: unknown): value is OperationsModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'etcd-operations-recovery'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.incidents)
      && value.incidents.length >= 4
      && Array.isArray(value.actions)
      && value.actions.length >= 4,
  );
}

const actionIcons = {
  'relist-watch': History,
  'recover-space': HardDrive,
  'fix-storage': Gauge,
  'replace-member': ServerCog,
  'restore-cluster': DatabaseBackup,
};

export default function EtcdOperationsRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<OperationsModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No operations model was supplied.');
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
        if (!isOperationsModel(payload)) {
          throw new Error('The operations model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the operations lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Recovery decision lab"
            title="Choose the repair that matches the failure"
            description="Loading incidents, evidence gates, and recovery consequences."
            icon={Wrench}
            accent="amber"
          />
          <div className="flex min-h-48 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Loading recovery model...'}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <OperationsWorkbench model={model} />;
}

function OperationsWorkbench({ model }: { model: OperationsModel }) {
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);
  const [actionId, setActionId] = useState(model.defaults.actionId);

  const incident =
    model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];
  const action = model.actions.find((item) => item.id === actionId) ?? model.actions[0];
  const outcome = incident.outcomes[action.id] ?? {
    status: 'harmful' as const,
    headline: 'No reviewed outcome exists for this response.',
    consequence: 'Stop and use the incident runbook before changing cluster state.',
  };

  const status = {
    effective: {
      label: 'Matches the failure',
      icon: CheckCircle2,
      tone: 'emerald' as const,
      panel:
        'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
      iconClass: 'text-emerald-700 dark:text-emerald-300',
    },
    partial: {
      label: 'Incomplete response',
      icon: AlertTriangle,
      tone: 'amber' as const,
      panel: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
      iconClass: 'text-amber-700 dark:text-amber-300',
    },
    harmful: {
      label: 'Wrong recovery boundary',
      icon: XCircle,
      tone: 'rose' as const,
      panel: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
      iconClass: 'text-rose-700 dark:text-rose-300',
    },
  }[outcome.status];

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setActionId(model.defaults.actionId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Recovery decision lab"
          title={model.title}
          description={model.description}
          icon={Wrench}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Observed incident
              </legend>
              <div className="mt-3 space-y-2">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'slow-fsync' ? Activity : ShieldAlert}
                    accent={item.id === 'majority-lost' ? 'rose' : 'amber'}
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Primary signal"
                value={incident.signal}
                detail="Confirm with endpoint and member-level evidence"
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Data risk"
                value={incident.dataRisk}
                detail="Risk before the selected response runs"
                icon={ShieldAlert}
                tone={incident.id === 'majority-lost' ? 'rose' : 'amber'}
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Operator response
              </legend>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {model.actions.map((item) => {
                  const Icon =
                    actionIcons[item.id as keyof typeof actionIcons] ?? RotateCcw;
                  const selected = item.id === action.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setActionId(item.id)}
                      className={`min-h-28 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        selected
                          ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-400 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-xs font-semibold uppercase opacity-70">
                            {item.category}
                          </span>
                          <span className="mt-1 block text-sm font-semibold">{item.label}</span>
                          <span className="mt-2 block text-xs leading-5 opacity-80">
                            {item.detail}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <section className={`rounded-md border p-5 ${status.panel}`}>
              <div className="flex items-start gap-3">
                <status.icon
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 ${status.iconClass}`}
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    {status.label}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {outcome.headline}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {outcome.consequence}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Evidence gate
                </p>
                <ul className="mt-3 space-y-2">
                  {incident.evidence.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200"
                    >
                      <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Correct sequence
                </p>
                <ol className="mt-3 space-y-2">
                  {incident.requiredSequence.map((item, index) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
