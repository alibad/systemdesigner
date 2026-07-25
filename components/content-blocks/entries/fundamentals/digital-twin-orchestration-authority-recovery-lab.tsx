'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CircleAlert,
  Factory,
  KeyRound,
  Link2Off,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Send,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TimerOff,
  UserRoundCheck,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Intent = {
  id: string;
  label: string;
  detail: string;
  target: string;
  requiresFreshState: boolean;
  requiresApproval: boolean;
  emergency: boolean;
};

type Path = {
  id: string;
  label: string;
  detail: string;
  authenticatesCaller: boolean;
  checksPreconditions: boolean;
  enforcesInterlock: boolean;
  idempotent: boolean;
  supportedIntentIds: string[];
};

type Delivery = {
  id: string;
  label: string;
  detail: string;
  stateFresh: boolean;
  approvalPresent: boolean;
  link: 'up' | 'down';
  acknowledgement: 'confirmed' | 'unknown' | 'not-sent';
};

type AuthorityModel = {
  title: string;
  description: string;
  defaults: {
    intentId: string;
    pathId: string;
    deliveryId: string;
  };
  intents: Intent[];
  paths: Path[];
  deliveries: Delivery[];
};

const BLOCK_ID = 'fundamentals/digital-twin-orchestration-authority-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/digital-twin-orchestration/data/authority-recovery-scenarios.json';

function isAuthorityModel(value: unknown): value is AuthorityModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<AuthorityModel>;
  if (
    typeof model.title !== 'string'
    || typeof model.description !== 'string'
    || typeof model.defaults?.intentId !== 'string'
    || typeof model.defaults.pathId !== 'string'
    || typeof model.defaults.deliveryId !== 'string'
    || !Array.isArray(model.intents)
    || model.intents.length < 3
    || !Array.isArray(model.paths)
    || model.paths.length < 3
    || !Array.isArray(model.deliveries)
    || model.deliveries.length < 3
  ) return false;

  return model.intents.every((intent) => (
    typeof intent.id === 'string'
      && typeof intent.label === 'string'
      && typeof intent.detail === 'string'
      && typeof intent.target === 'string'
      && typeof intent.requiresFreshState === 'boolean'
      && typeof intent.requiresApproval === 'boolean'
      && typeof intent.emergency === 'boolean'
  )) && model.paths.every((path) => (
    typeof path.id === 'string'
      && typeof path.label === 'string'
      && typeof path.detail === 'string'
      && typeof path.authenticatesCaller === 'boolean'
      && typeof path.checksPreconditions === 'boolean'
      && typeof path.enforcesInterlock === 'boolean'
      && typeof path.idempotent === 'boolean'
      && Array.isArray(path.supportedIntentIds)
      && path.supportedIntentIds.every((id) => typeof id === 'string')
  )) && model.deliveries.every((delivery) => (
    typeof delivery.id === 'string'
      && typeof delivery.label === 'string'
      && typeof delivery.detail === 'string'
      && typeof delivery.stateFresh === 'boolean'
      && typeof delivery.approvalPresent === 'boolean'
      && ['up', 'down'].includes(delivery.link)
      && ['confirmed', 'unknown', 'not-sent'].includes(delivery.acknowledgement)
  ));
}

export default function DigitalTwinOrchestrationAuthorityRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<AuthorityModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAuthorityModel(payload)) throw new Error('The authority model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load authority data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Authority and recovery lab"
            title="Bound the path from recommendation to actuation"
            description="Loading command intents, enforcement paths, and ambiguous delivery outcomes."
            icon={ShieldCheck}
            accent="rose"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <AuthorityLab model={model} />
      )}
    </div>
  );
}

function AuthorityLab({ model }: { model: AuthorityModel }) {
  const [intentId, setIntentId] = useState(model.defaults.intentId);
  const [pathId, setPathId] = useState(model.defaults.pathId);
  const [deliveryId, setDeliveryId] = useState(model.defaults.deliveryId);

  const intent = model.intents.find((item) => item.id === intentId) ?? model.intents[0];
  const path = model.paths.find((item) => item.id === pathId) ?? model.paths[0];
  const delivery = model.deliveries.find((item) => item.id === deliveryId) ?? model.deliveries[0];

  const decision = useMemo(() => {
    const supported = path.supportedIntentIds.includes(intent.id);
    const identityReady = path.authenticatesCaller;
    const freshEnough = !intent.requiresFreshState || (delivery.stateFresh && path.checksPreconditions);
    const approvalReady = !intent.requiresApproval || delivery.approvalPresent;
    const interlockReady = path.enforcesInterlock;
    const authorized = supported && identityReady && freshEnough && approvalReady && interlockReady;
    const sent = authorized && delivery.link === 'up';
    const confirmed = sent && delivery.acknowledgement === 'confirmed';
    const ambiguous = sent && delivery.acknowledgement === 'unknown';

    const blockers = [
      !supported ? 'The selected path does not own this command.' : null,
      !identityReady ? 'The caller is not authenticated at the command boundary.' : null,
      !freshEnough ? 'The command precondition relies on stale or unchecked twin state.' : null,
      !approvalReady ? 'The required human approval is absent.' : null,
      !interlockReady ? 'No local interlock validates the final actuation.' : null,
      authorized && delivery.link === 'down' ? 'The site link is unavailable.' : null,
    ].filter((item): item is string => Boolean(item));

    let recovery = 'Record the denied intent and gather the missing evidence before retrying.';
    if (intent.emergency && delivery.link === 'down') {
      recovery = 'Keep the remote command denied; the independent local safety function must stop the asset.';
    } else if (ambiguous) {
      recovery = path.idempotent
        ? 'Query the actuator by command ID, then retry the same idempotency key only if the result is absent.'
        : 'Do not retry blindly. Quarantine the workflow and reconcile physical state with an operator.';
    } else if (confirmed) {
      recovery = 'Verify the observed physical response, append the acknowledgement, and close the command record.';
    } else if (authorized && delivery.link === 'down') {
      recovery = 'Expire the command, preserve intent, and require a fresh authorization decision after connectivity returns.';
    }

    return { authorized, sent, confirmed, ambiguous, blockers, recovery };
  }, [delivery, intent, path]);

  function reset() {
    setIntentId(model.defaults.intentId);
    setPathId(model.defaults.pathId);
    setDeliveryId(model.defaults.deliveryId);
  }

  const outcomeLabel = !decision.authorized
    ? 'Denied'
    : !decision.sent
      ? 'Contained'
      : decision.confirmed
        ? 'Confirmed'
        : 'Uncertain';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Authority and recovery lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Requested intervention
              </legend>
              <div className="mt-3 grid gap-2">
                {model.intents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === intent.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.emergency ? Siren : Workflow}
                    accent={item.emergency ? 'rose' : 'violet'}
                    onClick={() => setIntentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Authority path
              </legend>
              <div className="mt-3 grid gap-2">
                {model.paths.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === path.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'local-safety' ? Factory : LockKeyhole}
                    accent={item.id === 'direct-write' ? 'rose' : 'blue'}
                    onClick={() => setPathId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Evidence and delivery
              </legend>
              <div className="mt-3 grid gap-2">
                {model.deliveries.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === delivery.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.link === 'down' ? Link2Off : RadioTower}
                    accent={item.acknowledgement === 'confirmed' ? 'emerald' : 'amber'}
                    onClick={() => setDeliveryId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Authority decision"
              value={decision.authorized ? 'Authorized' : 'Denied'}
              detail={decision.authorized ? 'The selected boundary satisfies the command policy.' : decision.blockers[0]}
              icon={decision.authorized ? UserRoundCheck : Ban}
              tone={decision.authorized ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Delivery result"
              value={outcomeLabel}
              detail={decision.confirmed ? 'Actuator acknowledgement is durable.' : 'Authorization and execution are separate facts.'}
              icon={decision.confirmed ? BadgeCheck : TimerOff}
              tone={decision.confirmed ? 'emerald' : decision.ambiguous ? 'amber' : 'neutral'}
            />
            <LabMetric
              label="Recovery posture"
              value={decision.ambiguous ? 'Reconcile' : decision.confirmed ? 'Verify' : 'Bounded'}
              detail={path.idempotent ? 'Command IDs support safe result lookup.' : 'Blind retry can duplicate a physical action.'}
              icon={RotateCcw}
              tone={decision.ambiguous ? 'amber' : 'cyan'}
            />
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Command path
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  Target: <strong>{intent.target}</strong>
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                decision.confirmed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : decision.authorized
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
              }`}>
                {decision.confirmed ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {outcomeLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <BoundaryStage
                icon={Send}
                label="Intent"
                title={intent.label}
                detail="A desired change, not proof of execution"
                active
              />
              <BoundaryStage
                icon={ServerCog}
                label="Command boundary"
                title={path.label}
                detail={decision.authorized ? 'Policy passed' : 'Policy stopped the command'}
                active={decision.authorized}
              />
              <BoundaryStage
                icon={Factory}
                label="Physical boundary"
                title={delivery.link === 'up' ? 'Local controller reachable' : 'Site isolated'}
                detail={decision.confirmed ? 'Actuation acknowledged' : 'Observed result not confirmed'}
                active={decision.sent}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`rounded-md border p-4 ${
              decision.authorized
                ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {decision.authorized ? (
                  <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Ban aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {decision.authorized ? 'Authority is explicit and scoped' : 'The command remains contained'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {decision.authorized
                      ? 'Caller identity, preconditions, approval, path ownership, and the local interlock were evaluated separately.'
                      : decision.blockers.join(' ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
              <div className="flex items-start gap-3">
                <RotateCcw aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <p className="text-sm font-semibold">Recovery decision</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    {decision.recovery}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <ControlFact label="Caller identity" ready={path.authenticatesCaller} />
            <ControlFact label="Fresh precondition" ready={!intent.requiresFreshState || (delivery.stateFresh && path.checksPreconditions)} />
            <ControlFact label="Local interlock" ready={path.enforcesInterlock} />
            <ControlFact label="Safe retry" ready={path.idempotent} />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function BoundaryStage({
  icon: Icon,
  label,
  title,
  detail,
  active,
}: {
  icon: typeof Send;
  label: string;
  title: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-4 ${
      active
        ? 'border-cyan-300 bg-white text-neutral-950 shadow-sm dark:border-cyan-800 dark:bg-neutral-950 dark:text-white'
        : 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
    }`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function ControlFact({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
      ready
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'
    }`}>
      {ready ? <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" /> : <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />}
      {label}
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className="flex min-h-40 items-center justify-center">
        {error ? (
          <div className="max-w-md text-center">
            <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              Authority data could not be loaded
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 animate-pulse text-rose-500" />
            Loading authority model…
          </div>
        )}
      </div>
    </LearningLabBody>
  );
}
