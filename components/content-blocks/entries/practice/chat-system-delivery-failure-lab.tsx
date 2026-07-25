'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Database,
  History,
  KeyRound,
  MessageSquareWarning,
  RadioTower,
  RefreshCw,
  Route,
  ShieldCheck,
  Unplug,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ScenarioId = 'ack-lost' | 'fanout-crash' | 'owner-failover' | 'presence-stale';
type RecoveryId = 'dedupe' | 'replay' | 'fence' | 'durable-sync';

type TraceStep = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  icon: LucideIcon;
  recommended: RecoveryId;
  failureStep: number;
  safeTrace: TraceStep[];
  safeResult: string;
  unsafeResult: string;
};

type Recovery = {
  id: RecoveryId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const scenarios: Scenario[] = [
  {
    id: 'ack-lost',
    label: 'Sender acknowledgement is lost',
    detail: 'The message commit succeeded, but the connection closed before the sender received `accepted`.',
    icon: Unplug,
    recommended: 'dedupe',
    failureStep: 1,
    safeTrace: [
      { label: 'Client retry', detail: 'Resend the unchanged client message ID.', icon: RefreshCw },
      { label: 'Dedup lookup', detail: 'Find the committed message and original sequence.', icon: KeyRound },
      { label: 'Stable response', detail: 'Return the same message ID and sequence.', icon: Database },
      { label: 'Recipient view', detail: 'Apply one logical message.', icon: CheckCircle2 },
    ],
    safeResult: 'The uncertain acknowledgement becomes a lookup, not a second append.',
    unsafeResult: 'A retry that receives a new identity can append a duplicate logical message.',
  },
  {
    id: 'fanout-crash',
    label: 'Fanout worker crashes after socket send',
    detail: 'A device may have applied sequence 418, but the worker did not checkpoint that delivery.',
    icon: MessageSquareWarning,
    recommended: 'replay',
    failureStep: 2,
    safeTrace: [
      { label: 'Durable source', detail: 'Sequence 418 remains in the conversation log.', icon: Database },
      { label: 'Worker replay', detail: 'Resume from the last durable consumer checkpoint.', icon: History },
      { label: 'Duplicate envelope', detail: 'The gateway may send sequence 418 again.', icon: RadioTower },
      { label: 'Client apply', detail: 'Ignore the duplicate and advance contiguously.', icon: ShieldCheck },
    ],
    safeResult: 'At-least-once fanout is safe because the device applies the stable message ID and sequence idempotently.',
    unsafeResult: 'Skipping replay can lose delivery; replay without client deduplication can show two copies.',
  },
  {
    id: 'owner-failover',
    label: 'Conversation owner loses its lease',
    detail: 'The old region is isolated while another region is ready to accept sends for the same conversation.',
    icon: CloudOff,
    recommended: 'fence',
    failureStep: 1,
    safeTrace: [
      { label: 'Pause writes', detail: 'Reject or queue sends during ambiguous ownership.', icon: ShieldCheck },
      { label: 'Acquire lease', detail: 'The new owner obtains a higher fencing token.', icon: KeyRound },
      { label: 'Fence stale owner', detail: 'Storage rejects writes carrying the old token.', icon: Database },
      { label: 'Resume order', detail: 'Sequence assignment continues under one owner.', icon: Route },
    ],
    safeResult: 'Temporary write unavailability prevents two owners from producing conflicting conversation order.',
    unsafeResult: 'Failing over without storage-enforced fencing can create duplicate or conflicting sequence assignments.',
  },
  {
    id: 'presence-stale',
    label: 'Presence says online after disconnect',
    detail: 'The routing lease has not expired, but the recipient socket no longer exists on the recorded gateway.',
    icon: RadioTower,
    recommended: 'durable-sync',
    failureStep: 2,
    safeTrace: [
      { label: 'Commit message', detail: 'Store the message without consulting presence.', icon: Database },
      { label: 'Live attempt', detail: 'The stale gateway route misses the device.', icon: RadioTower },
      { label: 'Keep history', detail: 'Do not convert a routing miss into message loss.', icon: History },
      { label: 'Reconnect sync', detail: 'Fetch after the device cursor and deliver.', icon: RefreshCw },
    ],
    safeResult: 'Presence can be wrong because durable history and cursor replay remain the delivery backstop.',
    unsafeResult: 'Treating presence as proof of delivery can strand the message after a failed socket attempt.',
  },
];

const recoveries: Recovery[] = [
  {
    id: 'dedupe',
    label: 'Retry through the idempotency index',
    detail: 'Reuse `(sender_id, client_message_id)` and return the existing committed result.',
    icon: KeyRound,
  },
  {
    id: 'replay',
    label: 'Replay and deduplicate at the device',
    detail: 'Resume from a durable checkpoint and make repeated message envelopes harmless.',
    icon: History,
  },
  {
    id: 'fence',
    label: 'Fence the old sequencing owner',
    detail: 'Require a higher lease token before a replacement owner can write.',
    icon: ShieldCheck,
  },
  {
    id: 'durable-sync',
    label: 'Fall back to cursor-based history',
    detail: 'Keep the message durable and let reconnect fill the missing sequence range.',
    icon: RefreshCw,
  },
];

export default function ChatSystemDeliveryFailureLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('ack-lost');
  const [recoveryId, setRecoveryId] = useState<RecoveryId>('dedupe');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const recovery = recoveries.find((item) => item.id === recoveryId) ?? recoveries[0];
    const safe = scenario.recommended === recovery.id;

    const metrics = safe
      ? {
          durableRows: '1',
          visibleCopies: '1',
          order: 'Stable',
          recovery: 'Bounded',
        }
      : {
          durableRows: scenario.id === 'ack-lost' ? '1 or 2' : scenario.id === 'owner-failover' ? 'Conflicting' : '1',
          visibleCopies: scenario.id === 'presence-stale' ? '0 until sync' : '0 or 2',
          order: scenario.id === 'owner-failover' ? 'Ambiguous' : 'At risk',
          recovery: 'Incomplete',
        };

    return { scenario, recovery, safe, metrics };
  }, [recoveryId, scenarioId]);

  const reset = () => {
    setScenarioId('ack-lost');
    setRecoveryId('dedupe');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Delivery failure lab"
        title="Recover without changing the logical conversation"
        description="Inject a failure at an ambiguous boundary, then choose the recovery contract. A safe response preserves one durable row, one visible copy, and one conversation order."
        icon={MessageSquareWarning}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Inject a failure
            </legend>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <LabChoice
                  key={scenario.id}
                  selected={scenario.id === scenarioId}
                  label={scenario.label}
                  detail={scenario.detail}
                  icon={scenario.icon}
                  accent="rose"
                  onClick={() => setScenarioId(scenario.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
      >
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            2. Choose the recovery contract
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recoveries.map((recovery) => (
              <LabChoice
                key={recovery.id}
                selected={recovery.id === recoveryId}
                label={recovery.label}
                detail={recovery.detail}
                icon={recovery.icon}
                accent="blue"
                onClick={() => setRecoveryId(recovery.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Durable rows"
            value={model.metrics.durableRows}
            detail="Logical records for the send"
            icon={Database}
            tone={model.safe ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Visible copies"
            value={model.metrics.visibleCopies}
            detail="What a recipient may observe"
            icon={RadioTower}
            tone={model.safe ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Conversation order"
            value={model.metrics.order}
            detail="Sequence remains authoritative"
            icon={Route}
            tone={model.safe ? 'violet' : 'amber'}
          />
          <LabMetric
            label="Recovery"
            value={model.metrics.recovery}
            detail="Failure has a terminating path"
            icon={RefreshCw}
            tone={model.safe ? 'blue' : 'rose'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Protocol trace
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {model.scenario.label}
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Selected: {model.recovery.label}
            </span>
          </div>

          <ol className="mt-4 grid gap-3 md:grid-cols-4">
            {model.scenario.safeTrace.map((step, index) => {
              const StepIcon = step.icon;
              const isViolation = !model.safe && index === model.scenario.failureStep;

              return (
                <li
                  key={step.label}
                  className={`relative rounded-md border p-3 ${
                    isViolation
                      ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                      : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StepIcon
                      aria-hidden="true"
                      className={`h-5 w-5 ${
                        isViolation
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}
                    />
                    <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                      {index + 1}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                  {isViolation ? (
                    <p className="mt-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                      Selected recovery does not protect this boundary.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.safe
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.safe ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-950 dark:text-white">
                {model.safe ? 'Invariant preserved' : 'Recovery contract is incomplete'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {model.safe ? model.scenario.safeResult : model.scenario.unsafeResult}
              </p>
              {!model.safe ? (
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  Use: {recoveries.find((item) => item.id === model.scenario.recommended)?.label}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
