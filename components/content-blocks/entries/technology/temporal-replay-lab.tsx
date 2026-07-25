'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Code2,
  Database,
  History,
  LoaderCircle,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  ShieldOff,
  Workflow,
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

type EventKind = 'history' | 'external' | 'failure' | 'replay';

type ReplayEvent = {
  id: string;
  number: number;
  kind: EventKind;
  label: string;
  detail: string;
  state: string;
  attempt: number;
  guardedEffects?: number;
  unguardedEffects?: number;
};

type CodeContract = {
  id: 'compatible' | 'unversioned-change';
  label: string;
  detail: string;
};

type ReplayIncident = {
  id: string;
  label: string;
  detail: string;
  failureBoundary: string;
  mismatchAtStep: number;
  events: ReplayEvent[];
};

type ReplayData = {
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    codeContractId: CodeContract['id'];
    idempotencyGuard: boolean;
  };
  codeContracts: CodeContract[];
  incidents: ReplayIncident[];
};

const BLOCK_ID = 'technology/temporal-replay-lab';

function isEventKind(value: unknown): value is EventKind {
  return ['history', 'external', 'failure', 'replay'].includes(String(value));
}

function isReplayEvent(value: unknown): value is ReplayEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplayEvent>;
  return Boolean(
    candidate.id
      && typeof candidate.number === 'number'
      && isEventKind(candidate.kind)
      && candidate.label
      && candidate.detail
      && candidate.state
      && typeof candidate.attempt === 'number'
      && (candidate.guardedEffects === undefined
        || typeof candidate.guardedEffects === 'number')
      && (candidate.unguardedEffects === undefined
        || typeof candidate.unguardedEffects === 'number'),
  );
}

function isCodeContract(value: unknown): value is CodeContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CodeContract>;
  return Boolean(
    (candidate.id === 'compatible' || candidate.id === 'unversioned-change')
      && candidate.label
      && candidate.detail,
  );
}

function isReplayIncident(value: unknown): value is ReplayIncident {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplayIncident>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.failureBoundary
      && typeof candidate.mismatchAtStep === 'number'
      && Array.isArray(candidate.events)
      && candidate.events.length >= 4
      && candidate.events.every(isReplayEvent),
  );
}

function isReplayData(value: unknown): value is ReplayData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplayData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && (candidate.defaults.codeContractId === 'compatible'
        || candidate.defaults.codeContractId === 'unversioned-change')
      && typeof candidate.defaults.idempotencyGuard === 'boolean'
      && Array.isArray(candidate.codeContracts)
      && candidate.codeContracts.length === 2
      && candidate.codeContracts.every(isCodeContract)
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 3
      && candidate.incidents.every(isReplayIncident),
  );
}

export default function TemporalReplayLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No replay model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReplayData(payload)) {
          throw new Error('The replay model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the replay model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {data
        ? <ReplayWorkbench data={data} />
        : <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />}
    </div>
  );
}

function ReplayWorkbench({ data }: { data: ReplayData }) {
  const defaultIncident = data.incidents.find(
    (item) => item.id === data.defaults.incidentId,
  ) ?? data.incidents[0];
  const [incidentId, setIncidentId] = useState(defaultIncident.id);
  const [codeContractId, setCodeContractId] = useState(data.defaults.codeContractId);
  const [idempotencyGuard, setIdempotencyGuard] = useState(
    data.defaults.idempotencyGuard,
  );
  const [replayStep, setReplayStep] = useState(defaultIncident.events.length);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? defaultIncident;
  const codeContract = data.codeContracts.find((item) => item.id === codeContractId)
    ?? data.codeContracts[0];
  const visibleEvents = incident.events.slice(0, replayStep);
  const activeEvent = visibleEvents[visibleEvents.length - 1] ?? incident.events[0];

  const result = useMemo(() => {
    const mismatch = codeContract.id === 'unversioned-change'
      && replayStep >= incident.mismatchAtStep;
    const effectState = [...visibleEvents].reverse().find(
      (event) => event.guardedEffects !== undefined,
    );
    const businessEffects = idempotencyGuard
      ? effectState?.guardedEffects ?? 0
      : effectState?.unguardedEffects ?? 0;
    const activityAttempts = Math.max(0, ...visibleEvents.map((event) => event.attempt));
    const duplicateEffect = businessEffects > 1;
    const complete = replayStep === incident.events.length;

    if (mismatch) {
      return {
        activityAttempts,
        businessEffects,
        durableEvents: visibleEvents.filter((event) => event.kind === 'history').length,
        detail: 'The new Workflow code emits a command that is incompatible with the recorded history. Keep this execution on compatible code or use a recorded version branch.',
        state: 'Replay blocked',
        tone: 'rose' as const,
        verdict: 'Non-determinism stops forward progress',
      };
    }

    if (duplicateEffect) {
      return {
        activityAttempts,
        businessEffects,
        durableEvents: visibleEvents.filter((event) => event.kind === 'history').length,
        detail: 'Temporal recovers the logical Activity, but the destination accepts the retried business operation as new. Durable orchestration alone cannot remove this duplicate.',
        state: activeEvent.state,
        tone: 'rose' as const,
        verdict: 'Workflow recovery repeats the external effect',
      };
    }

    if (!complete) {
      return {
        activityAttempts,
        businessEffects,
        durableEvents: visibleEvents.filter((event) => event.kind === 'history').length,
        detail: 'Advance the replay cursor to see which state is reconstructed from the history available at this point.',
        state: activeEvent.state,
        tone: 'amber' as const,
        verdict: 'Replay is rebuilding durable state',
      };
    }

    return {
      activityAttempts,
      businessEffects,
      durableEvents: visibleEvents.filter((event) => event.kind === 'history').length,
      detail: incident.id === 'activity-completion-lost'
        ? 'A second Activity attempt runs, while the stable operation ID makes the provider return the first charge result.'
        : 'The Worker reconstructs state from compatible history and continues from the next unrecorded decision.',
      state: activeEvent.state,
      tone: 'emerald' as const,
      verdict: businessEffects > 0
        ? 'Orchestration and the business effect agree'
        : 'Replay remains compatible with recorded history',
    };
  }, [
    activeEvent.state,
    codeContract.id,
    idempotencyGuard,
    incident,
    replayStep,
    visibleEvents,
  ]);

  function selectIncident(nextIncident: ReplayIncident) {
    setIncidentId(nextIncident.id);
    setReplayStep(nextIncident.events.length);
  }

  function reset() {
    setIncidentId(defaultIncident.id);
    setCodeContractId(data.defaults.codeContractId);
    setIdempotencyGuard(data.defaults.idempotencyGuard);
    setReplayStep(defaultIncident.events.length);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Event History replay lab"
        title={data.title}
        description={data.description}
        icon={History}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a failure
              </legend>
              <div className="mt-3 grid gap-2">
                {data.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'workflow-worker-crash'
                      ? ServerCrash
                      : item.id === 'activity-completion-lost'
                        ? Activity
                        : Code2}
                    accent="rose"
                    onClick={() => selectIncident(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose the code contract
              </legend>
              <div className="mt-3 grid gap-2">
                {data.codeContracts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === codeContract.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'compatible' ? ShieldCheck : ShieldOff}
                    accent={item.id === 'compatible' ? 'emerald' : 'amber'}
                    onClick={() => setCodeContractId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              aria-pressed={idempotencyGuard}
              onClick={() => setIdempotencyGuard((value) => !value)}
              className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                idempotencyGuard
                  ? 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-600 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
              }`}
            >
              <span className="flex items-start gap-3">
                {idempotencyGuard
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  : <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>
                  <span className="block text-sm font-semibold">
                    External idempotency key: {idempotencyGuard ? 'enforced' : 'missing'}
                  </span>
                  <span className="mt-1 block text-xs leading-5 opacity-75">
                    The provider recognizes the same durable business operation across attempts.
                  </span>
                </span>
              </span>
            </button>

            <LabRange
              label="Replay cursor"
              value={replayStep}
              output={`${replayStep} / ${incident.events.length}`}
              min={1}
              max={incident.events.length}
              accent="violet"
              lowLabel="Start"
              highLabel="Latest event"
              onChange={setReplayStep}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Rebuilt state"
              value={result.state}
              detail="State visible at the selected replay step"
              icon={Workflow}
              tone={result.tone}
            />
            <LabMetric
              label="Durable Events"
              value={String(result.durableEvents)}
              detail={`${visibleEvents.length} trace steps are currently visible`}
              icon={Database}
              tone="blue"
            />
            <LabMetric
              label="Activity attempts"
              value={String(result.activityAttempts)}
              detail="Attempts are not the same as business outcomes"
              icon={RotateCcw}
              tone={result.activityAttempts > 1 ? 'amber' : 'cyan'}
            />
            <LabMetric
              label="Business effects"
              value={String(result.businessEffects)}
              detail="Mutations committed outside Temporal"
              icon={Activity}
              tone={result.businessEffects > 1 ? 'rose' : 'emerald'}
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Recorded timeline
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  {incident.label}
                </h4>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Failure boundary: {incident.failureBoundary}
              </p>
            </div>

            <ol className="mt-4 grid gap-2">
              {incident.events.map((event) => (
                <ReplayEventRow
                  key={event.id}
                  event={event}
                  active={event.number === replayStep}
                  visible={event.number <= replayStep}
                />
              ))}
            </ol>
          </section>

          <section className={`rounded-md border p-4 ${
            result.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
          }`}>
            <div className="flex items-start gap-3">
              {result.tone === 'emerald'
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <h4 className="font-semibold">{result.verdict}</h4>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

const eventStyles: Record<EventKind, {
  icon: LucideIcon;
  active: string;
  badge: string;
  label: string;
}> = {
  history: {
    icon: Database,
    active: 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    label: 'History',
  },
  external: {
    icon: Activity,
    active: 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'External',
  },
  failure: {
    icon: ServerCrash,
    active: 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    label: 'Failure',
  },
  replay: {
    icon: RotateCcw,
    active: 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    label: 'Replay',
  },
};

function ReplayEventRow({
  event,
  active,
  visible,
}: {
  event: ReplayEvent;
  active: boolean;
  visible: boolean;
}) {
  const style = eventStyles[event.kind];
  const Icon = style.icon;

  return (
    <li
      aria-current={active ? 'step' : undefined}
      className={`grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-md border p-3 transition-colors ${
        active
          ? style.active
          : visible
            ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
            : 'border-neutral-200 bg-neutral-100 opacity-45 dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current text-xs font-semibold">
        {event.number}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <p className="break-words text-sm font-semibold text-neutral-950 dark:text-white">
            {event.label}
          </p>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}>
            {style.label}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
          {event.detail}
        </p>
      </div>
    </li>
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
    <LearningLab>
      <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
        {error ? (
          <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
        ) : (
          <LoaderCircle
            aria-hidden="true"
            className="h-7 w-7 animate-spin text-violet-500 motion-reduce:animate-none"
          />
        )}
        <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
          {error ? 'Replay model unavailable' : 'Loading replay model'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing Event History, Worker, Activity, and external-effect states.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
          >
            Retry
          </button>
        ) : null}
      </div>
    </LearningLab>
  );
}
