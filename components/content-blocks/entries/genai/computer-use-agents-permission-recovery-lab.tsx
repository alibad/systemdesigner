'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Clock3,
  FileWarning,
  KeyRound,
  LoaderCircle,
  MessageSquare,
  Repeat2,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type OutcomeStatus = 'unsafe' | 'resolved' | 'paused';

interface RecoveryResponse {
  id: string;
  label: string;
  detail: string;
}

interface RecoveryOutcome {
  status: OutcomeStatus;
  verdict: string;
  permission: string;
  sideEffects: string;
  nextStep: string;
}

interface Incident {
  id: string;
  label: string;
  intentSource: string;
  approvalScope: string;
  proposedAction: string;
  observedResult: string;
  authoritativeCheck: string;
  reversible: boolean;
  outcomes: Record<string, RecoveryOutcome>;
}

interface PermissionRecoveryData {
  title: string;
  description: string;
  defaultIncidentId: string;
  defaultResponseId: string;
  responses: RecoveryResponse[];
  incidents: Incident[];
}

const BLOCK_ID = 'genai/computer-use-agents-permission-recovery-lab';

const responseIcons: Record<string, LucideIcon> = {
  retry: Repeat2,
  reconcile: SearchCheck,
  'ask-user': MessageSquare,
  compensate: RotateCcw,
};

function isOutcomeStatus(value: unknown): value is OutcomeStatus {
  return value === 'unsafe' || value === 'resolved' || value === 'paused';
}

function isRecoveryOutcome(value: unknown): value is RecoveryOutcome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecoveryOutcome>;
  return Boolean(
    isOutcomeStatus(candidate.status)
      && candidate.verdict
      && candidate.permission
      && candidate.sideEffects
      && candidate.nextStep,
  );
}

function isPermissionRecoveryData(value: unknown): value is PermissionRecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PermissionRecoveryData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultIncidentId
      && candidate.defaultResponseId
      && Array.isArray(candidate.responses)
      && candidate.responses.length > 0
      && candidate.responses.every((response) => (
        typeof response.id === 'string'
        && typeof response.label === 'string'
        && typeof response.detail === 'string'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.intentSource === 'string'
        && typeof incident.approvalScope === 'string'
        && typeof incident.proposedAction === 'string'
        && typeof incident.observedResult === 'string'
        && typeof incident.authoritativeCheck === 'string'
        && typeof incident.reversible === 'boolean'
        && incident.outcomes
        && typeof incident.outcomes === 'object'
        && candidate.responses?.every((response) => isRecoveryOutcome(incident.outcomes[response.id]))
      )),
  );
}

export default function ComputerUseAgentsPermissionRecoveryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PermissionRecoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No permission and recovery model was supplied.');
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
        if (!isPermissionRecoveryData(payload)) {
          throw new Error('Permission and recovery data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <PermissionRecoveryLab data={data} />;
}

function PermissionRecoveryLab({ data }: { data: PermissionRecoveryData }) {
  const initialIncident = data.incidents.find((item) => item.id === data.defaultIncidentId)
    ?? data.incidents[0];
  const initialResponse = data.responses.find((item) => item.id === data.defaultResponseId)
    ?? data.responses[0];
  const [incidentId, setIncidentId] = useState(initialIncident.id);
  const [responseId, setResponseId] = useState(initialResponse.id);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const response = data.responses.find((item) => item.id === responseId) ?? data.responses[0];
  const outcome = incident.outcomes[response.id];

  function reset() {
    setIncidentId(initialIncident.id);
    setResponseId(initialResponse.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Permission and recovery ledger"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Incident">
                {data.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.observedResult}
                    icon={incidentIcon(item.id)}
                    accent={item.reversible ? 'amber' : 'rose'}
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Recovery response">
                {data.responses.map((item) => {
                  const Icon = responseIcons[item.id] ?? ShieldCheck;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === response.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'retry' ? 'rose' : item.id === 'reconcile' ? 'blue' : item.id === 'ask-user' ? 'violet' : 'amber'}
                      onClick={() => setResponseId(item.id)}
                    />
                  );
                })}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Decision state"
                value={outcome.status}
                detail={outcome.verdict}
                icon={outcome.status === 'resolved' ? BadgeCheck : outcome.status === 'paused' ? Clock3 : XCircle}
                tone={outcome.status === 'resolved' ? 'emerald' : outcome.status === 'paused' ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Intent source"
                value={incident.intentSource.includes('Direct') ? 'Direct' : 'Untrusted'}
                detail={incident.intentSource}
                icon={incident.intentSource.includes('Direct') ? Users : FileWarning}
                tone={incident.intentSource.includes('Direct') ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Reversibility"
                value={incident.reversible ? 'Reversible' : 'Not assured'}
                detail="Determines whether compensation is meaningful"
                icon={incident.reversible ? RotateCcw : ShieldAlert}
                tone={incident.reversible ? 'amber' : 'rose'}
              />
              <LabMetric
                label="External effects"
                value={outcome.sideEffects}
                detail="Consequence of the selected response"
                icon={Repeat2}
                tone={outcome.status === 'resolved' ? 'emerald' : outcome.status === 'paused' ? 'amber' : 'rose'}
              />
            </div>

            <ApprovalReceipt incident={incident} />

            <IncidentTimeline incident={incident} response={response} outcome={outcome} />

            <section className={`rounded-md border p-5 ${outcomeStyle(outcome.status)}`}>
              <div className="flex items-start gap-3">
                {outcome.status === 'resolved' ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : outcome.status === 'paused' ? (
                  <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Recovery verdict</p>
                  <h4 className="mt-1 text-lg font-semibold">{outcome.verdict}</h4>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase opacity-70">Permission</dt>
                      <dd className="mt-1 text-sm leading-6">{outcome.permission}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase opacity-70">Next controlled step</dt>
                      <dd className="mt-1 text-sm leading-6">{outcome.nextStep}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">{children}</div>
    </fieldset>
  );
}

function ApprovalReceipt({ incident }: { incident: Incident }) {
  const directIntent = incident.intentSource.includes('Direct');

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <KeyRound aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Approval receipt</h4>
        </div>
        <span className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase ${directIntent ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'}`}>
          {directIntent ? 'user-authored' : 'third-party content'}
        </span>
      </div>
      <dl className="grid gap-px bg-neutral-200 sm:grid-cols-2 dark:bg-neutral-800">
        <ReceiptField label="Intent source" value={incident.intentSource} />
        <ReceiptField label="Approved scope" value={incident.approvalScope} />
        <ReceiptField label="Proposed action" value={incident.proposedAction} />
        <ReceiptField label="Authoritative check" value={incident.authoritativeCheck} />
      </dl>
    </section>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-white p-4 dark:bg-neutral-950">
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{value}</dd>
    </div>
  );
}

function IncidentTimeline({
  incident,
  response,
  outcome,
}: {
  incident: Incident;
  response: RecoveryResponse;
  outcome: RecoveryOutcome;
}) {
  const stages = [
    {
      label: 'Permission boundary',
      title: incident.approvalScope,
      icon: Users,
      tone: 'blue',
    },
    {
      label: 'Attempted action',
      title: incident.proposedAction,
      icon: ShieldCheck,
      tone: 'violet',
    },
    {
      label: 'Observed result',
      title: incident.observedResult,
      icon: CircleAlert,
      tone: 'amber',
    },
    {
      label: 'Selected recovery',
      title: response.label,
      icon: responseIcons[response.id] ?? RotateCcw,
      tone: outcome.status === 'resolved' ? 'emerald' : outcome.status === 'paused' ? 'amber' : 'rose',
    },
  ];

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Evidence ledger
      </p>
      <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-stretch">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="flex min-w-0 flex-1 items-center gap-2">
              {index > 0 ? (
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 rotate-90 text-neutral-400 xl:rotate-0" />
              ) : null}
              <article className={`min-h-32 min-w-0 flex-1 rounded-md border p-4 ${timelineStyle(stage.tone)}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
                <p className="mt-3 text-[11px] font-semibold uppercase opacity-70">{stage.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5">{stage.title}</p>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function incidentIcon(id: string): LucideIcon {
  if (id === 'lost-send-response') return Repeat2;
  if (id === 'page-asks-for-secret') return FileWarning;
  if (id === 'wrong-draft-attachment') return RotateCcw;
  return KeyRound;
}

function outcomeStyle(status: OutcomeStatus) {
  if (status === 'resolved') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  }
  if (status === 'paused') {
    return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
}

function timelineStyle(tone: string) {
  if (tone === 'blue') {
    return 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100';
  }
  if (tone === 'violet') {
    return 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100';
  }
  if (tone === 'emerald') return outcomeStyle('resolved');
  if (tone === 'rose') return outcomeStyle('unsafe');
  return outcomeStyle('paused');
}

function LabLoading() {
  return (
    <LearningLab>
      <div className="flex min-h-56 items-center justify-center gap-3 p-6 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading permission and recovery ledger...
      </div>
    </LearningLab>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <div className="flex min-h-48 items-start gap-3 p-6 text-rose-800 dark:text-rose-200">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Permission and recovery ledger unavailable</p>
          <p className="mt-1 text-sm leading-6">{detail}</p>
        </div>
      </div>
    </LearningLab>
  );
}
