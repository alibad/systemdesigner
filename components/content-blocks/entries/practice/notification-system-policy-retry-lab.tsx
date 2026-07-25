'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Hourglass,
  KeyRound,
  ListRestart,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ScenarioId = 'opt-out' | 'quiet-hours' | 'rate-limit' | 'unknown-timeout' | 'provider-outage';
type ResponseId = 'suppress' | 'schedule' | 'throttle' | 'reconcile' | 'failover';

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
  recommended: ResponseId;
  trace: TraceStep[];
  safeResult: string;
  unsafeResult: string;
  safeMetrics: {
    policy: string;
    providerCalls: string;
    copies: string;
    nextState: string;
  };
};

type Response = {
  id: ResponseId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const BLOCK_ID = 'practice/notification-system-policy-retry-lab';

const scenarios: Scenario[] = [
  {
    id: 'opt-out',
    label: 'User opts out after enqueue',
    detail: 'The intent is durable, but the latest marketing preference now denies email and SMS.',
    icon: Ban,
    recommended: 'suppress',
    trace: [
      { label: 'Load current policy', detail: 'Read the latest preference version before external send.', icon: RefreshCw },
      { label: 'Deny the channel', detail: 'Consent overrides the plan captured at ingestion.', icon: ShieldCheck },
      { label: 'Mark suppressed', detail: 'Persist a terminal reason instead of treating it as failure.', icon: Ban },
      { label: 'Emit audit event', detail: 'Record policy version and reason with no provider call.', icon: Route },
    ],
    safeResult: 'The durable intent remains auditable, but no external send bypasses the newest opt-out.',
    unsafeResult: 'Sending or retrying from a stale enqueue-time plan violates the latest user preference.',
    safeMetrics: { policy: 'Current', providerCalls: '0', copies: '0', nextState: 'Suppressed' },
  },
  {
    id: 'quiet-hours',
    label: 'Marketing send enters quiet hours',
    detail: 'The message is eligible, but the recipient-local delivery window is closed for six hours.',
    icon: CalendarClock,
    recommended: 'schedule',
    trace: [
      { label: 'Evaluate local time', detail: 'Resolve timezone and the applicable quiet-hours rule.', icon: CalendarClock },
      { label: 'Compute send_after', detail: 'Choose the next legal instant and keep it durable.', icon: Hourglass },
      { label: 'Wake the intent', detail: 'A scheduler moves due work back to the channel queue.', icon: TimerReset },
      { label: 'Revalidate policy', detail: 'Check consent and caps again immediately before send.', icon: ShieldCheck },
    ],
    safeResult: 'Scheduling delays delivery without losing the intent, and policy is checked again when it becomes due.',
    unsafeResult: 'Sending immediately breaks quiet hours; repeatedly requeueing without send_after creates churn and unfairness.',
    safeMetrics: { policy: 'Rechecked', providerCalls: '0 now', copies: '0 now', nextState: 'Scheduled' },
  },
  {
    id: 'rate-limit',
    label: 'Provider returns HTTP 429',
    detail: 'The provider reports that this account or destination has exhausted its current quota.',
    icon: Hourglass,
    recommended: 'throttle',
    trace: [
      { label: 'Classify 429', detail: 'The adapter maps the vendor response to a retryable quota error.', icon: Route },
      { label: 'Honor Retry-After', detail: 'Delay the provider partition instead of busy-looping.', icon: Hourglass },
      { label: 'Preserve lane health', detail: 'Other providers and channels continue draining.', icon: ShieldCheck },
      { label: 'Retry with same key', detail: 'Reuse the stable attempt identity when capacity returns.', icon: KeyRound },
    ],
    safeResult: 'The adapter respects provider feedback, contains the backlog, and keeps retries idempotent.',
    unsafeResult: 'Immediate retries amplify the rate limit, consume workers, and can delay unrelated traffic.',
    safeMetrics: { policy: 'Current', providerCalls: 'Deferred', copies: 'At most 1', nextState: 'Retry due' },
  },
  {
    id: 'unknown-timeout',
    label: 'Timeout after provider acceptance',
    detail: 'The worker sent the request but lost the response, so delivery may already have happened.',
    icon: ListRestart,
    recommended: 'reconcile',
    trace: [
      { label: 'Keep attempt identity', detail: 'Do not mint a new key for an ambiguous result.', icon: KeyRound },
      { label: 'Query or retry safely', detail: 'Use provider status or retry with the same dedupe key.', icon: RefreshCw },
      { label: 'Merge callbacks', detail: 'Apply webhook events by provider message ID and monotonic state.', icon: Route },
      { label: 'Finalize once', detail: 'Expose one logical channel attempt to downstream consumers.', icon: ShieldCheck },
    ],
    safeResult: 'A stable attempt key turns an ambiguous timeout into reconciliation instead of a duplicate user-visible send.',
    unsafeResult: 'A new attempt key may create a second provider send even though the first request succeeded.',
    safeMetrics: { policy: 'Current', providerCalls: '1 logical', copies: 'At most 1', nextState: 'Reconcile' },
  },
  {
    id: 'provider-outage',
    label: 'Primary provider circuit opens',
    detail: 'Recent timeouts cross the breaker threshold while an approved secondary provider has capacity.',
    icon: CloudOff,
    recommended: 'failover',
    trace: [
      { label: 'Stop primary calls', detail: 'The circuit breaker prevents more timeout pressure.', icon: CloudOff },
      { label: 'Check failover policy', detail: 'Verify channel, region, sender identity, and cost allow backup use.', icon: ShieldCheck },
      { label: 'Create next attempt', detail: 'Use a new sequence under the same logical channel delivery.', icon: KeyRound },
      { label: 'Route to backup', detail: 'The adapter records provider ownership for callbacks.', icon: Send },
    ],
    safeResult: 'Failover is policy-controlled, observable, and isolated from the unavailable provider.',
    unsafeResult: 'Uncontrolled rerouting can break sender identity, regional policy, cost limits, or callback correlation.',
    safeMetrics: { policy: 'Failover allowed', providerCalls: '1 backup', copies: 'At most 1', nextState: 'Dispatched' },
  },
];

const responses: Response[] = [
  {
    id: 'suppress',
    label: 'Suppress with a policy reason',
    detail: 'Persist a terminal non-delivery state without calling a provider.',
    icon: Ban,
  },
  {
    id: 'schedule',
    label: 'Set a durable send_after time',
    detail: 'Move the intent to scheduled state and revalidate when due.',
    icon: CalendarClock,
  },
  {
    id: 'throttle',
    label: 'Honor quota and Retry-After',
    detail: 'Pause the affected provider partition with jitter and bounded attempts.',
    icon: Hourglass,
  },
  {
    id: 'reconcile',
    label: 'Reconcile the same attempt key',
    detail: 'Query status or repeat safely without creating a second logical attempt.',
    icon: KeyRound,
  },
  {
    id: 'failover',
    label: 'Use an approved backup provider',
    detail: 'Open the primary circuit and route a sequenced attempt through a valid adapter.',
    icon: RefreshCw,
  },
];

export default function NotificationSystemPolicyRetryLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('unknown-timeout');
  const [responseId, setResponseId] = useState<ResponseId>('reconcile');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const response = responses.find((item) => item.id === responseId) ?? responses[0];
    const safe = scenario.recommended === response.id;
    const metrics = safe
      ? scenario.safeMetrics
      : {
          policy: scenario.id === 'opt-out' || scenario.id === 'quiet-hours' ? 'Violated' : 'Unclear',
          providerCalls: response.id === 'suppress' ? '0' : 'Unbounded',
          copies: scenario.id === 'unknown-timeout' ? '0 or 2' : 'Uncertain',
          nextState: 'Incorrect',
        };

    return { scenario, response, safe, metrics };
  }, [responseId, scenarioId]);

  const reset = () => {
    setScenarioId('unknown-timeout');
    setResponseId('reconcile');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Policy and retry lab"
          title="Choose the next safe delivery action"
          description="Inject a state change or provider failure, then choose a response. A production path must preserve current policy, bounded queue behavior, and at most one logical send."
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject a scenario
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
              2. Choose the delivery response
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {responses.map((response) => (
                <LabChoice
                  key={response.id}
                  selected={response.id === responseId}
                  label={response.label}
                  detail={response.detail}
                  icon={response.icon}
                  accent="blue"
                  onClick={() => setResponseId(response.id)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Policy state"
              value={model.metrics.policy}
              detail="Consent, schedule, and failover rules"
              icon={ShieldCheck}
              tone={model.safe ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Provider calls"
              value={model.metrics.providerCalls}
              detail="External work for this decision"
              icon={Send}
              tone={model.safe ? 'blue' : 'amber'}
            />
            <LabMetric
              label="Visible copies"
              value={model.metrics.copies}
              detail="User-visible logical sends"
              icon={KeyRound}
              tone={model.safe ? 'violet' : 'rose'}
            />
            <LabMetric
              label="Next state"
              value={model.metrics.nextState}
              detail="Durable delivery state machine"
              icon={Route}
              tone={model.safe ? 'cyan' : 'rose'}
            />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Safe reference trace
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                  {model.scenario.label}
                </p>
              </div>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Selected: {model.response.label}
              </span>
            </div>

            <ol className="mt-4 grid gap-3 md:grid-cols-4">
              {model.scenario.trace.map((step, index) => {
                const StepIcon = step.icon;
                const isMismatch = !model.safe && index === 1;

                return (
                  <li
                    key={step.label}
                    className={`rounded-md border p-3 ${
                      isMismatch
                        ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                        : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StepIcon
                        aria-hidden="true"
                        className={`h-5 w-5 ${
                          isMismatch ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300'
                        }`}
                      />
                      <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                        {index + 1}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{step.detail}</p>
                    {isMismatch ? (
                      <p className="mt-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                        The selected response breaks this boundary.
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
                  {model.safe ? 'Delivery invariant preserved' : 'Response does not fit the failure'}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.safe ? model.scenario.safeResult : model.scenario.unsafeResult}
                </p>
                {!model.safe ? (
                  <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    Use: {responses.find((item) => item.id === model.scenario.recommended)?.label}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
