'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/rabbitmq-delivery-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/rabbitmq/data/delivery-recovery-model.json';

type FailurePoint = 'none' | 'before-effect' | 'after-effect' | 'poison';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  failurePoint: FailurePoint;
};

type AckMode = {
  id: string;
  label: string;
  detail: string;
  idempotent: boolean;
};

type DeliveryModel = {
  kind: 'rabbitmq-delivery-recovery';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    ackModeId: string;
    maxDeliveries: number;
    deadLettering: boolean;
  };
  scenarios: Scenario[];
  ackModes: AckMode[];
};

type Verdict = 'safe' | 'warning' | 'danger';

const failurePoints: FailurePoint[] = [
  'none',
  'before-effect',
  'after-effect',
  'poison',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isScenario(value: unknown): value is Scenario {
  if (!isRecord(value)) return false;
  return isText(value.id)
    && isText(value.label)
    && isText(value.detail)
    && failurePoints.includes(value.failurePoint as FailurePoint);
}

function isAckMode(value: unknown): value is AckMode {
  if (!isRecord(value)) return false;
  return isText(value.id)
    && isText(value.label)
    && isText(value.detail)
    && typeof value.idempotent === 'boolean';
}

function isDeliveryModel(value: unknown): value is DeliveryModel {
  if (!isRecord(value)
    || value.kind !== 'rabbitmq-delivery-recovery'
    || value.blockId !== BLOCK_ID
    || !isText(value.title)
    || !isText(value.description)
    || !isRecord(value.defaults)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 4
    || !value.scenarios.every(isScenario)
    || !hasUniqueIds(value.scenarios)
    || !Array.isArray(value.ackModes)
    || value.ackModes.length < 3
    || !value.ackModes.every(isAckMode)
    || !hasUniqueIds(value.ackModes)
  ) {
    return false;
  }

  const defaults = value.defaults as Record<string, unknown>;
  const scenarios = value.scenarios as Scenario[];
  const ackModes = value.ackModes as AckMode[];

  return isText(defaults.scenarioId)
    && isText(defaults.ackModeId)
    && Number.isInteger(defaults.maxDeliveries)
    && Number(defaults.maxDeliveries) >= 1
    && Number(defaults.maxDeliveries) <= 5
    && typeof defaults.deadLettering === 'boolean'
    && scenarios.some((item) => item.id === defaults.scenarioId)
    && ackModes.some((item) => item.id === defaults.ackModeId);
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

export default function RabbitMQDeliveryRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<DeliveryModel | null>(null);
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
        if (!isDeliveryModel(payload)) {
          throw new Error('The RabbitMQ delivery contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the delivery recovery lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Delivery recovery lab"
            title="Separate delivery attempts from business effects"
            description="Loading failures, acknowledgment points, and retry budgets."
            icon={ShieldCheck}
            accent="amber"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      </div>
    );
  }

  return <DeliveryWorkbench model={model} />;
}

function DeliveryWorkbench({ model }: { model: DeliveryModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [ackModeId, setAckModeId] = useState(model.defaults.ackModeId);
  const [maxDeliveries, setMaxDeliveries] = useState(
    model.defaults.maxDeliveries,
  );
  const [deadLettering, setDeadLettering] = useState(
    model.defaults.deadLettering,
  );

  const scenario = findById(model.scenarios, scenarioId);
  const ackMode = findById(model.ackModes, ackModeId);

  const result = useMemo(() => {
    let deliveries = 1;
    let sideEffects = 1;
    let finalState = 'Acknowledged';
    let verdict: Verdict = 'safe';
    let title = 'One delivery produces one business effect';
    let explanation =
      'The handler finishes, acknowledges, and releases the broker from responsibility.';

    if (scenario.failurePoint === 'before-effect') {
      sideEffects = 0;
      if (ackMode.id === 'early') {
        finalState = 'Lost';
        verdict = 'danger';
        title = 'The acknowledgment erased unfinished work';
        explanation =
          'RabbitMQ has no unacknowledged delivery to recover after the consumer exits.';
      } else if (maxDeliveries >= 2) {
        deliveries = 2;
        sideEffects = 1;
        finalState = 'Acknowledged on retry';
        title = 'Redelivery recovers the interrupted attempt';
        explanation =
          'The first unacknowledged delivery returns to the queue; the next consumer completes it.';
      } else {
        finalState = deadLettering ? 'Dead-lettered' : 'Discarded';
        verdict = deadLettering ? 'warning' : 'danger';
        title = deadLettering
          ? 'The delivery budget preserved the message for repair'
          : 'The delivery budget ended without a recovery queue';
        explanation = deadLettering
          ? 'No business effect occurred, but operators can inspect and replay the exhausted message.'
          : 'No business effect occurred and the exhausted message has no retained recovery path.';
      }
    }

    if (scenario.failurePoint === 'after-effect') {
      if (ackMode.id === 'early') {
        finalState = 'Acknowledged early';
        verdict = 'warning';
        title = 'This attempt succeeded, but the contract is fragile';
        explanation =
          'The selected crash happened after the effect. A crash moments earlier would lose the message because the broker was already released.';
      } else if (maxDeliveries >= 2) {
        deliveries = 2;
        finalState = 'Acknowledged on retry';
        if (ackMode.idempotent) {
          sideEffects = 1;
          title = 'Redelivery is absorbed by the idempotency record';
          explanation =
            'The second attempt sees the committed message ID, skips the repeated effect, and acknowledges safely.';
        } else {
          sideEffects = 2;
          verdict = 'danger';
          title = 'One logical message created two business effects';
          explanation =
            'RabbitMQ correctly redelivered an ambiguous attempt, but the handler repeated the non-idempotent mutation.';
        }
      } else {
        finalState = deadLettering ? 'Dead-lettered' : 'Discarded';
        verdict = 'warning';
        title = 'The effect committed but delivery completion is unresolved';
        explanation = deadLettering
          ? 'The retained message needs reconciliation before replay because the first effect may already exist.'
          : 'The message disappeared after an ambiguous effect; an operator has no broker record to reconcile.';
      }
    }

    if (scenario.failurePoint === 'poison') {
      deliveries = maxDeliveries;
      sideEffects = 0;
      finalState = deadLettering ? 'Dead-lettered' : 'Discarded';
      verdict = deadLettering ? 'warning' : 'danger';
      title = deadLettering
        ? 'The poison message is contained after bounded attempts'
        : 'The poison message leaves no evidence after exhaustion';
      explanation = deadLettering
        ? 'Healthy traffic can continue while operators inspect the schema error and choose a controlled replay.'
        : 'Retries stop, but the invalid payload is not retained for diagnosis or repair.';
    }

    return {
      deliveries,
      explanation,
      finalState,
      sideEffects,
      title,
      verdict,
    };
  }, [ackMode, deadLettering, maxDeliveries, scenario.failurePoint]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setAckModeId(model.defaults.ackModeId);
    setMaxDeliveries(model.defaults.maxDeliveries);
    setDeadLettering(model.defaults.deadLettering);
  }

  const statusClass = result.verdict === 'safe'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.verdict === 'danger'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50';
  const StatusIcon = result.verdict === 'safe'
    ? CheckCircle2
    : result.verdict === 'danger'
      ? XCircle
      : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Delivery recovery lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Inject a consumer outcome">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.failurePoint === 'none'
                      ? CheckCircle2
                      : AlertTriangle}
                    accent={item.failurePoint === 'none' ? 'emerald' : 'rose'}
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="2. Choose the completion contract">
                {model.ackModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === ackMode.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.idempotent ? ShieldCheck : Inbox}
                    accent={item.idempotent ? 'emerald' : 'amber'}
                    onClick={() => setAckModeId(item.id)}
                  />
                ))}
              </ChoiceGroup>

              <LabRange
                label="Maximum deliveries"
                value={maxDeliveries}
                output={String(maxDeliveries)}
                min={1}
                max={5}
                accent="amber"
                lowLabel="Fail once"
                highLabel="More retry pressure"
                onChange={setMaxDeliveries}
              />

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
                <input
                  type="checkbox"
                  checked={deadLettering}
                  onChange={(event) => setDeadLettering(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Retain exhausted messages
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Send the final rejected delivery to a dead-letter queue.
                  </span>
                </span>
              </label>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Delivery attempts"
              value={String(result.deliveries)}
              detail="Broker-to-consumer deliveries."
              icon={RotateCcw}
              tone={result.deliveries > 1 ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Business effects"
              value={String(result.sideEffects)}
              detail="Committed domain mutations."
              icon={ShieldCheck}
              tone={result.sideEffects === 1 ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Final broker state"
              value={result.finalState}
              detail={`Budget: ${maxDeliveries} deliver${maxDeliveries === 1 ? 'y' : 'ies'}.`}
              icon={Inbox}
              tone={result.verdict === 'safe'
                ? 'emerald'
                : result.verdict === 'danger'
                  ? 'rose'
                  : 'amber'}
            />
          </div>

          <div
            className="mt-6 grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
            aria-label="Delivery completion path"
          >
            <PathStep
              label="Queue"
              detail="Message ready"
              active
              icon={<Inbox aria-hidden="true" className="h-5 w-5" />}
            />
            <PathArrow />
            <PathStep
              label="Consumer"
              detail={scenario.label}
              active
              icon={<Clock3 aria-hidden="true" className="h-5 w-5" />}
            />
            <PathArrow />
            <PathStep
              label="Business state"
              detail={`${result.sideEffects} effect${result.sideEffects === 1 ? '' : 's'}`}
              active={result.sideEffects > 0}
              icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
            />
            <PathArrow />
            <PathStep
              label="Completion"
              detail={result.finalState}
              active={result.finalState.includes('Acknowledged')}
              icon={<CheckCircle2 aria-hidden="true" className="h-5 w-5" />}
            />
          </div>

          <div className={`mt-5 rounded-md border p-5 ${statusClass}`} aria-live="polite">
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{result.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  {result.explanation}
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-5 space-y-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-semibold text-neutral-400">•</span>
              Publisher confirms cover the publisher-to-broker handoff, not this consumer transaction.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-semibold text-neutral-400">•</span>
              A finite delivery limit contains poison messages and protects healthy queue traffic.
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="font-semibold text-neutral-400">•</span>
              Replays from a dead-letter queue must preserve the original message ID.
            </li>
          </ul>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function PathStep({
  label,
  detail,
  active,
  icon,
}: {
  label: string;
  detail: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${
      active
        ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50'
        : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400'
    }`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <span
      aria-hidden="true"
      className="hidden self-center text-center text-neutral-400 md:block"
    >
      →
    </span>
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
    <div className="flex min-h-44 items-center justify-center p-6">
      {error ? (
        <div className="max-w-lg text-center">
          <AlertTriangle aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
            Delivery data could not load
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading delivery contracts
        </div>
      )}
    </div>
  );
}
