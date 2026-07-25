'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Eye,
  Fence,
  KeyRound,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldAlert,
  TriangleAlert,
  Unplug,
  XCircle,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Pattern = {
  id: string;
  label: string;
  detail: string;
  ownedState: string;
  expiredEffect: string;
  burstEffect: string;
};

type SessionEvent = {
  id: string;
  label: string;
  detail: string;
  sessionState: string;
  serverState: string;
  watchState: string;
  safeResponseIds: string[];
  reviewResponseIds: string[];
};

type Response = {
  id: string;
  label: string;
  detail: string;
  action: string;
};

type SessionOwnershipModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    patternId: string;
    eventId: string;
    responseId: string;
  };
  patterns: Pattern[];
  events: SessionEvent[];
  responses: Response[];
};

type Decision = 'safe' | 'review' | 'unsafe';

const BLOCK_ID = 'technology/zookeeper-session-ownership-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/zookeeper/data/session-ownership-model.json';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isPattern(value: unknown): value is Pattern {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Pattern>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isNonEmptyString(candidate.ownedState)
    && isNonEmptyString(candidate.expiredEffect)
    && isNonEmptyString(candidate.burstEffect);
}

function isSessionEvent(value: unknown): value is SessionEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionEvent>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isNonEmptyString(candidate.sessionState)
    && isNonEmptyString(candidate.serverState)
    && isNonEmptyString(candidate.watchState)
    && isStringArray(candidate.safeResponseIds)
    && isStringArray(candidate.reviewResponseIds);
}

function isResponse(value: unknown): value is Response {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Response>;
  return isNonEmptyString(candidate.id)
    && isNonEmptyString(candidate.label)
    && isNonEmptyString(candidate.detail)
    && isNonEmptyString(candidate.action);
}

function isSessionOwnershipModel(value: unknown): value is SessionOwnershipModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionOwnershipModel>;
  if (
    candidate.blockId !== BLOCK_ID
    || !isNonEmptyString(candidate.title)
    || !isNonEmptyString(candidate.description)
    || !isNonEmptyString(candidate.defaults?.patternId)
    || !isNonEmptyString(candidate.defaults.eventId)
    || !isNonEmptyString(candidate.defaults.responseId)
    || !Array.isArray(candidate.patterns)
    || candidate.patterns.length < 3
    || !candidate.patterns.every(isPattern)
    || !hasUniqueIds(candidate.patterns)
    || !Array.isArray(candidate.events)
    || candidate.events.length < 3
    || !candidate.events.every(isSessionEvent)
    || !hasUniqueIds(candidate.events)
    || !Array.isArray(candidate.responses)
    || candidate.responses.length < 3
    || !candidate.responses.every(isResponse)
    || !hasUniqueIds(candidate.responses)
  ) {
    return false;
  }

  const responseIds = new Set(candidate.responses.map((item) => item.id));
  const referencesExist = candidate.events.every((event) =>
    [...event.safeResponseIds, ...event.reviewResponseIds].every((id) =>
      responseIds.has(id)));

  return referencesExist
    && candidate.patterns.some(
      (item) => item.id === candidate.defaults?.patternId,
    )
    && candidate.events.some(
      (item) => item.id === candidate.defaults?.eventId,
    )
    && candidate.responses.some(
      (item) => item.id === candidate.defaults?.responseId,
    );
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function ZookeeperSessionOwnershipLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SessionOwnershipModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSessionOwnershipModel(payload)) {
          throw new Error('The session ownership contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the session ownership lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Session and ownership lab"
            title="Treat disconnection as uncertainty, not authority"
            description="Loading session events, watch semantics, and recovery choices."
            icon={KeyRound}
            accent="violet"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <SessionWorkbench model={model} />;
}

function SessionWorkbench({ model }: { model: SessionOwnershipModel }) {
  const [patternId, setPatternId] = useState(model.defaults.patternId);
  const [eventId, setEventId] = useState(model.defaults.eventId);
  const [responseId, setResponseId] = useState(model.defaults.responseId);

  const pattern = findById(model.patterns, patternId);
  const event = findById(model.events, eventId);
  const response = findById(model.responses, responseId);
  const decision: Decision = event.safeResponseIds.includes(response.id)
    ? 'safe'
    : event.reviewResponseIds.includes(response.id)
      ? 'review'
      : 'unsafe';

  function reset() {
    setPatternId(model.defaults.patternId);
    setEventId(model.defaults.eventId);
    setResponseId(model.defaults.responseId);
  }

  const decisionConfig = {
    safe: {
      label: 'Safe recovery',
      icon: CheckCircle2,
      tone: 'emerald' as const,
      className:
        'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    },
    review: {
      label: 'Reconcile first',
      icon: TriangleAlert,
      tone: 'amber' as const,
      className:
        'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    },
    unsafe: {
      label: 'Stale-state risk',
      icon: XCircle,
      tone: 'rose' as const,
      className:
        'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    },
  }[decision];
  const DecisionIcon = decisionConfig.icon;

  const ephemeralValue = pattern.id === 'configuration-cache'
    ? 'Not the source of truth'
    : event.id === 'session-expired'
      ? 'Removed'
      : 'Still present';
  const eventEffect = event.id === 'session-expired'
    ? pattern.expiredEffect
    : event.id === 'mutation-burst'
      ? pattern.burstEffect
      : 'The client must verify the current version before resuming coordination work.';

  const responseExplanation = decision === 'safe'
    ? `${response.action} ${eventEffect}`
    : decision === 'review'
      ? `${response.action} The old session may still be alive, so creating overlapping ownership before reconciliation can introduce churn or duplicate claims.`
      : `${response.action} Local state cannot prove that ${pattern.ownedState.toLowerCase()} is still current after this event.`;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Session and ownership lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                legend="1. Coordination pattern"
                items={model.patterns}
                selectedId={pattern.id}
                icon={ServerCog}
                accent="blue"
                onSelect={setPatternId}
              />
              <ChoiceGroup
                legend="2. Inject an event"
                items={model.events}
                selectedId={event.id}
                icon={Zap}
                accent="rose"
                onSelect={setEventId}
              />
              <ChoiceGroup
                legend="3. Choose the client response"
                items={model.responses}
                selectedId={response.id}
                icon={RotateCcw}
                accent="violet"
                onSelect={setResponseId}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Session"
              value={event.id === 'session-expired' ? 'Expired' : 'Alive'}
              detail={event.sessionState}
              icon={event.id === 'session-expired' ? Unplug : Activity}
              tone={event.id === 'session-expired' ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Owned state"
              value={ephemeralValue}
              detail={pattern.ownedState}
              icon={Fence}
              tone={event.id === 'session-expired' ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Decision"
              value={decisionConfig.label}
              detail="Evaluate the response against ensemble state."
              icon={DecisionIcon}
              tone={decisionConfig.tone}
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Recovery trace
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-4">
              <TraceStep
                number="1"
                label="Client belief"
                title={pattern.ownedState}
                detail={pattern.detail}
                icon={KeyRound}
              />
              <TraceStep
                number="2"
                label="Connection event"
                title={event.label}
                detail={event.detail}
                icon={Clock3}
              />
              <TraceStep
                number="3"
                label="Ensemble truth"
                title={event.serverState}
                detail={event.watchState}
                icon={RadioTower}
              />
              <TraceStep
                number="4"
                label="Client action"
                title={response.label}
                detail={response.action}
                icon={RotateCcw}
              />
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-5 ${decisionConfig.className}`}>
            <div className="flex items-start gap-3">
              <DecisionIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{decisionConfig.label}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {responseExplanation}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <Eye aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              <strong>Watch invariant:</strong> {event.watchState}. Handle the
              notification by reading the current value and version; do not infer
              every intermediate mutation from callback count.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends { id: string; label: string; detail: string }>({
  legend,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  legend: string;
  items: T[];
  selectedId: string;
  icon: typeof ServerCog;
  accent: 'blue' | 'violet' | 'rose';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {legend}
      </legend>
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

function TraceStep({
  number,
  label,
  title,
  detail,
  icon: Icon,
}: {
  number: string;
  label: string;
  title: string;
  detail: string;
  icon: typeof KeyRound;
}) {
  return (
    <div className="relative min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
          {number}
        </span>
        <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
      </div>
      <Icon
        aria-hidden="true"
        className="mt-4 h-5 w-5 text-violet-600 dark:text-violet-300"
      />
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
        {detail}
      </p>
    </div>
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
    <div className="flex min-h-52 items-center justify-center p-6">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <ShieldAlert
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300"
            />
            <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
              Session data could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </>
        ) : (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="mx-auto h-7 w-7 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300"
            />
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
              Loading session scenarios...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
