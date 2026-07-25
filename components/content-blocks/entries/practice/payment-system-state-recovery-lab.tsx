'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  History,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ScenarioId = 'provider-timeout' | 'duplicate-confirm' | 'late-webhook' | 'refund-race';

type TraceStep = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

type ResponseOption = {
  id: string;
  label: string;
  detail: string;
  safe: boolean;
  paymentState: string;
  providerEffects: string;
  ledgerState: string;
  customerImpact: string;
  operatorAction: string;
  trace: TraceStep[];
};

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  injection: string;
  icon: LucideIcon;
  defaultResponseId: string;
  responses: ResponseOption[];
};

const scenarios: Scenario[] = [
  {
    id: 'provider-timeout',
    label: 'Provider times out after send',
    detail: 'The connection closes after the capture request leaves the adapter. The provider may have accepted it.',
    injection: 'No definitive decline or approval exists locally, but the provider request reference is durable.',
    icon: Clock3,
    defaultResponseId: 'reroute',
    responses: [
      {
        id: 'reroute',
        label: 'Mark failed and route to the backup provider',
        detail: 'Optimize for a fast answer by issuing a new capture elsewhere.',
        safe: false,
        paymentState: 'False finality',
        providerEffects: '0, 1, or 2',
        ledgerState: 'Cannot explain both',
        customerImpact: 'The customer can be charged twice if the first provider accepted the request.',
        operatorAction: 'Stop rerouting, query both references, reconcile the duplicate, and refund through an audited operation.',
        trace: [
          { label: 'Capture sent', detail: 'Provider A receives the stable request reference.', icon: CreditCard },
          { label: 'Timeout', detail: 'The local outcome remains unknown.', icon: Clock3 },
          { label: 'Blind reroute', detail: 'Provider B receives a second business effect.', icon: RefreshCw },
          { label: 'Divergence', detail: 'Two captures may exist for one intent.', icon: AlertTriangle },
        ],
      },
      {
        id: 'resolve-reference',
        label: 'Keep processing and resolve the same reference',
        detail: 'Query, await a verified webhook, and reconcile before any alternate route.',
        safe: true,
        paymentState: 'Processing',
        providerEffects: 'At most 1 intended',
        ledgerState: 'Posts with evidence',
        customerImpact: 'The answer may be delayed, but the platform does not create a second charge.',
        operatorAction: 'Escalate only after the provider-specific uncertainty window and reconciliation deadline expire.',
        trace: [
          { label: 'Capture sent', detail: 'Provider A receives one stable request reference.', icon: CreditCard },
          { label: 'Timeout', detail: 'Persist an ambiguous processing attempt.', icon: Clock3 },
          { label: 'Resolve', detail: 'Query or match a signed event to the same reference.', icon: Webhook },
          { label: 'Commit truth', detail: 'Advance state and post one journal with evidence.', icon: Database },
        ],
      },
    ],
  },
  {
    id: 'duplicate-confirm',
    label: 'Client repeats confirmation',
    detail: 'The first response was lost, so the client sends the same idempotency key again.',
    injection: 'The first command already committed an authorized result and provider reference.',
    icon: KeyRound,
    defaultResponseId: 'new-attempt',
    responses: [
      {
        id: 'return-stored',
        label: 'Return the stored result for the same fingerprint',
        detail: 'Read the merchant-scoped idempotency record and reuse its response.',
        safe: true,
        paymentState: 'Authorized',
        providerEffects: '1',
        ledgerState: 'Unchanged',
        customerImpact: 'The retry receives the original outcome without another provider call.',
        operatorAction: 'Alert only if the same key arrives with a different request fingerprint.',
        trace: [
          { label: 'Retry received', detail: 'The key and business fields match the first command.', icon: RefreshCw },
          { label: 'Deduplicate', detail: 'The unique idempotency record already owns the key.', icon: KeyRound },
          { label: 'Read result', detail: 'Load the committed intent version and response.', icon: Database },
          { label: 'Reply', detail: 'Return the same status and identifiers.', icon: CheckCircle2 },
        ],
      },
      {
        id: 'new-attempt',
        label: 'Create a new attempt because this is a new HTTP request',
        detail: 'Treat transport identity as business-operation identity.',
        safe: false,
        paymentState: 'Conflicting attempts',
        providerEffects: '1 or 2',
        ledgerState: 'Duplicate risk',
        customerImpact: 'A network retry can become a second authorization or capture.',
        operatorAction: 'Join attempts by merchant operation and provider reference, then reverse any duplicate financial effect.',
        trace: [
          { label: 'Retry received', detail: 'The same business command arrives on a new connection.', icon: RefreshCw },
          { label: 'Key ignored', detail: 'The handler allocates another attempt ID.', icon: AlertTriangle },
          { label: 'Provider called', detail: 'A second side effect may be created.', icon: CreditCard },
          { label: 'Ambiguity grows', detail: 'The client sees one result but two attempts exist.', icon: History },
        ],
      },
    ],
  },
  {
    id: 'late-webhook',
    label: 'Older webhook arrives last',
    detail: 'A captured event was applied before a delayed authorization event for the same provider object.',
    injection: 'Delivery order differs from event order, which is normal for retried webhooks.',
    icon: Webhook,
    defaultResponseId: 'arrival-order',
    responses: [
      {
        id: 'arrival-order',
        label: 'Overwrite state in webhook arrival order',
        detail: 'Treat the latest delivery as the latest business fact.',
        safe: false,
        paymentState: 'Regressed',
        providerEffects: '1',
        ledgerState: 'Status disagrees',
        customerImpact: 'A succeeded payment can appear authorized again and trigger repeated work.',
        operatorAction: 'Restore state from provider evidence and audit which side effects were repeated by the regressed transition.',
        trace: [
          { label: 'Capture applied', detail: 'The intent reaches succeeded with a journal.', icon: CheckCircle2 },
          { label: 'Old event arrives', detail: 'A delayed authorization delivery is validly signed.', icon: Webhook },
          { label: 'Blind overwrite', detail: 'Arrival time replaces lifecycle order.', icon: RefreshCw },
          { label: 'State regresses', detail: 'Workflow and accounting now disagree.', icon: AlertTriangle },
        ],
      },
      {
        id: 'monotonic-inbox',
        label: 'Deduplicate and apply a legal monotonic transition',
        detail: 'Verify the event, reserve its ID, and compare provider evidence with current state.',
        safe: true,
        paymentState: 'Succeeded',
        providerEffects: '1',
        ledgerState: 'Balanced once',
        customerImpact: 'The late event is acknowledged without regressing status or repeating side effects.',
        operatorAction: 'Retain the ignored event as evidence and investigate only if provider and internal terminal states disagree.',
        trace: [
          { label: 'Verify', detail: 'Check raw-body signature and timestamp.', icon: ShieldCheck },
          { label: 'Reserve event', detail: 'Insert the provider event ID once.', icon: KeyRound },
          { label: 'Compare state', detail: 'Succeeded is later than authorized.', icon: History },
          { label: 'Acknowledge', detail: 'Record the stale event without applying effects.', icon: CheckCircle2 },
        ],
      },
    ],
  },
  {
    id: 'refund-race',
    label: 'Two partial refunds race',
    detail: 'Two workers each read enough refundable value before either provider call completes.',
    injection: 'A payment captured 100 dollars; two concurrent requests each ask to refund 70 dollars.',
    icon: Undo2,
    defaultResponseId: 'read-then-refund',
    responses: [
      {
        id: 'read-then-refund',
        label: 'Read available value, then refund independently',
        detail: 'Each worker checks the same old balance before writing its result.',
        safe: false,
        paymentState: 'Over-refunded',
        providerEffects: '140 dollars',
        ledgerState: 'Negative exposure',
        customerImpact: 'The merchant can lose more than the captured amount.',
        operatorAction: 'Freeze further refunds, reconcile provider effects, and post controlled adjustment journals.',
        trace: [
          { label: 'Worker A reads', detail: '100 dollars appears refundable.', icon: Database },
          { label: 'Worker B reads', detail: 'The same 100 dollars appears refundable.', icon: Database },
          { label: 'Both refund', detail: 'Each sends a 70 dollar provider operation.', icon: Undo2 },
          { label: 'Limit broken', detail: 'Total refunds reach 140 dollars.', icon: AlertTriangle },
        ],
      },
      {
        id: 'atomic-reservation',
        label: 'Reserve refundable value atomically',
        detail: 'Use a version check or conditional update before any provider side effect.',
        safe: true,
        paymentState: 'One accepted, one rejected',
        providerEffects: '70 dollars',
        ledgerState: '30 dollars remains',
        customerImpact: 'One refund proceeds; the other receives a deterministic amount-exceeds-available error.',
        operatorAction: 'Reconcile the accepted refund if its provider result becomes ambiguous; do not release its reservation early.',
        trace: [
          { label: 'Worker A reserves', detail: 'Atomically reduce available value from 100 to 30 dollars.', icon: ShieldCheck },
          { label: 'Worker B checks', detail: 'Only 30 dollars remains refundable.', icon: Database },
          { label: 'Reject overflow', detail: 'The second 70 dollar command creates no provider call.', icon: AlertTriangle },
          { label: 'Post reversal', detail: 'One successful refund creates one balanced journal.', icon: Undo2 },
        ],
      },
    ],
  },
];

export default function PaymentSystemStateRecoveryLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('provider-timeout');
  const [responseId, setResponseId] = useState('reroute');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const response = scenario.responses.find((item) => item.id === responseId)
      ?? scenario.responses[0];
    return { scenario, response };
  }, [responseId, scenarioId]);

  const chooseScenario = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setResponseId(scenario.defaultResponseId);
  };

  const reset = () => {
    setScenarioId('provider-timeout');
    setResponseId('reroute');
  };

  return (
    <div data-content-block="practice/payment-system-state-recovery-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Payment state and recovery lab"
          title="Choose a recovery action when the timeline is unreliable"
          description="Inject a timeout, retry, late event, or concurrent refund. Then choose the next action and inspect its provider effect, ledger consequence, and customer-visible result."
          icon={ShieldCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Failure injection
              </legend>
              <div className="mt-3 space-y-2">
                {scenarios.map((scenario) => (
                  <LabChoice
                    key={scenario.id}
                    selected={model.scenario.id === scenario.id}
                    label={scenario.label}
                    detail={scenario.detail}
                    icon={scenario.icon}
                    accent="amber"
                    onClick={() => chooseScenario(scenario)}
                  />
                ))}
              </div>
            </fieldset>
          )}
        >
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
              Injected condition
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-100">
              {model.scenario.injection}
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Recovery action
            </legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {model.scenario.responses.map((response) => (
                <LabChoice
                  key={response.id}
                  selected={model.response.id === response.id}
                  label={response.label}
                  detail={response.detail}
                  icon={response.safe ? ShieldCheck : RefreshCw}
                  accent="violet"
                  onClick={() => setResponseId(response.id)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Payment state"
              value={model.response.paymentState}
              detail="Workflow result"
              icon={History}
              tone={model.response.safe ? 'blue' : 'rose'}
            />
            <LabMetric
              label="Provider effects"
              value={model.response.providerEffects}
              detail="External money-moving operations"
              icon={CreditCard}
              tone={model.response.safe ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Ledger"
              value={model.response.ledgerState}
              detail="Accounting consequence"
              icon={Database}
              tone={model.response.safe ? 'violet' : 'rose'}
            />
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Recovery trace
            </p>
            <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {model.response.trace.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={`${model.scenario.id}-${model.response.id}-${step.label}`}
                    className="relative min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                        {index + 1} / {model.response.trace.length}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                      {step.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {step.detail}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          <div
            className={`mt-5 rounded-md border p-4 ${
              model.response.safe
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {model.response.safe ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-neutral-950 dark:text-white">
                  {model.response.safe ? 'Invariant protected' : 'Invariant at risk'}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {model.response.customerImpact}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  <span className="font-semibold text-neutral-950 dark:text-white">Operator response:</span>{' '}
                  {model.response.operatorAction}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
