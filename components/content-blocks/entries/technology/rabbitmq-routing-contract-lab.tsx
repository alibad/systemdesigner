'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Inbox,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  Route,
  Send,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/rabbitmq-routing-contract-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/rabbitmq/data/routing-contract-model.json';

type ExchangeRule = 'exact' | 'topic' | 'all';

type Exchange = {
  id: string;
  label: string;
  detail: string;
  rule: ExchangeRule;
};

type Event = {
  id: string;
  label: string;
  routingKey: string;
  payload: string;
};

type Queue = {
  id: string;
  label: string;
  responsibility: string;
  bindings: Record<string, string[]>;
};

type RoutingModel = {
  kind: 'rabbitmq-routing-contract';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    exchangeId: string;
    eventId: string;
  };
  exchanges: Exchange[];
  events: Event[];
  queues: Queue[];
};

const exchangeRules: ExchangeRule[] = ['exact', 'topic', 'all'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isExchange(value: unknown): value is Exchange {
  if (!isRecord(value)) return false;
  return isText(value.id)
    && isText(value.label)
    && isText(value.detail)
    && exchangeRules.includes(value.rule as ExchangeRule);
}

function isEvent(value: unknown): value is Event {
  if (!isRecord(value)) return false;
  return isText(value.id)
    && isText(value.label)
    && isText(value.routingKey)
    && isText(value.payload);
}

function isQueue(value: unknown): value is Queue {
  if (!isRecord(value)
    || !isText(value.id)
    || !isText(value.label)
    || !isText(value.responsibility)
    || !isRecord(value.bindings)
  ) {
    return false;
  }

  return Object.values(value.bindings).every(
    (bindings) =>
      Array.isArray(bindings)
      && bindings.length > 0
      && bindings.every(isText),
  );
}

function isRoutingModel(value: unknown): value is RoutingModel {
  if (!isRecord(value)
    || value.kind !== 'rabbitmq-routing-contract'
    || value.blockId !== BLOCK_ID
    || !isText(value.title)
    || !isText(value.description)
    || !isRecord(value.defaults)
    || !Array.isArray(value.exchanges)
    || value.exchanges.length < 3
    || !value.exchanges.every(isExchange)
    || !hasUniqueIds(value.exchanges)
    || !Array.isArray(value.events)
    || value.events.length < 3
    || !value.events.every(isEvent)
    || !hasUniqueIds(value.events)
    || !Array.isArray(value.queues)
    || value.queues.length < 3
    || !value.queues.every(isQueue)
    || !hasUniqueIds(value.queues)
  ) {
    return false;
  }

  const defaults = value.defaults as Record<string, unknown>;
  const exchanges = value.exchanges as Exchange[];
  const events = value.events as Event[];
  const queues = value.queues as Queue[];

  return isText(defaults.exchangeId)
    && isText(defaults.eventId)
    && exchanges.some((item) => item.id === defaults.exchangeId)
    && events.some((item) => item.id === defaults.eventId)
    && queues.every((queue) =>
      exchanges.every((exchange) =>
        Array.isArray(queue.bindings[exchange.id])));
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

function topicMatches(pattern: string, routingKey: string): boolean {
  const patternWords = pattern.split('.');
  const keyWords = routingKey.split('.');

  function match(patternIndex: number, keyIndex: number): boolean {
    if (patternIndex === patternWords.length) {
      return keyIndex === keyWords.length;
    }

    const word = patternWords[patternIndex];
    if (word === '#') {
      return match(patternIndex + 1, keyIndex)
        || (keyIndex < keyWords.length && match(patternIndex, keyIndex + 1));
    }

    if (keyIndex >= keyWords.length) return false;
    if (word !== '*' && word !== keyWords[keyIndex]) return false;
    return match(patternIndex + 1, keyIndex + 1);
  }

  return match(0, 0);
}

function bindingMatches(
  exchange: Exchange,
  binding: string,
  routingKey: string,
): boolean {
  if (exchange.rule === 'all') return true;
  if (exchange.rule === 'exact') return binding === routingKey;
  return topicMatches(binding, routingKey);
}

export default function RabbitMQRoutingContractLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RoutingModel | null>(null);
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
        if (!isRoutingModel(payload)) {
          throw new Error('The RabbitMQ routing contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the routing contract lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Routing contract lab"
            title="Trace a publish before trusting the bindings"
            description="Loading exchange rules, routing keys, and queue bindings."
            icon={Route}
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

  return <RoutingWorkbench model={model} />;
}

function RoutingWorkbench({ model }: { model: RoutingModel }) {
  const [exchangeId, setExchangeId] = useState(model.defaults.exchangeId);
  const [eventId, setEventId] = useState(model.defaults.eventId);

  const exchange = findById(model.exchanges, exchangeId);
  const event = findById(model.events, eventId);
  const matches = useMemo(
    () => model.queues.map((queue) => {
      const bindings = queue.bindings[exchange.id] ?? [];
      const matchedBinding = bindings.find((binding) =>
        bindingMatches(exchange, binding, event.routingKey));
      return { queue, bindings, matchedBinding };
    }),
    [event.routingKey, exchange, model.queues],
  );
  const routed = matches.filter((item) => item.matchedBinding);
  const unroutable = routed.length === 0;

  function reset() {
    setExchangeId(model.defaults.exchangeId);
    setEventId(model.defaults.eventId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Routing contract lab"
          title={model.title}
          description={model.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup label="1. Choose the exchange contract">
                {model.exchanges.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === exchange.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.rule === 'all' ? RadioTower : GitBranch}
                    accent="violet"
                    onClick={() => setExchangeId(item.id)}
                  />
                ))}
              </ChoiceGroup>
              <ChoiceGroup label="2. Publish one event">
                {model.events.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === event.id}
                    label={item.label}
                    detail={item.routingKey}
                    icon={Send}
                    accent="blue"
                    onClick={() => setEventId(item.id)}
                  />
                ))}
              </ChoiceGroup>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Routing key"
              value={event.routingKey}
              detail={event.payload}
              icon={Send}
              tone="blue"
            />
            <LabMetric
              label="Queue copies"
              value={String(routed.length)}
              detail="One independent copy per matched queue."
              icon={Inbox}
              tone={unroutable ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Publish status"
              value={unroutable ? 'Returned' : 'Routed'}
              detail={unroutable
                ? 'A mandatory publish must enter recovery.'
                : 'At least one binding accepted the key.'}
              icon={unroutable ? XCircle : CheckCircle2}
              tone={unroutable ? 'rose' : 'emerald'}
            />
          </div>

          <div className="mt-6" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                Publisher
              </span>
              <span aria-hidden="true" className="text-neutral-400">→</span>
              <span className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50">
                {exchange.label}
              </span>
              <span aria-hidden="true" className="text-neutral-400">→</span>
              <span>{routed.length} queue{routed.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {matches.map(({ queue, bindings, matchedBinding }) => (
                <div
                  key={queue.id}
                  className={`min-w-0 rounded-md border p-4 ${
                    matchedBinding
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {matchedBinding
                      ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                      : <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold">{queue.label}</p>
                      <p className="mt-1 text-sm leading-6 opacity-80">
                        {queue.responsibility}
                      </p>
                      <p className="mt-3 break-words font-mono text-xs opacity-75">
                        {matchedBinding
                          ? `Matched ${matchedBinding}`
                          : `Bindings: ${bindings.join(', ')}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`mt-5 rounded-md border p-4 ${
              unroutable
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
                : 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {unroutable
                ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                : <Route aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="font-semibold">
                  {unroutable
                    ? 'The routing contract has a hole'
                    : 'The binding contract is explicit'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  {unroutable
                    ? `No ${exchange.label.toLowerCase()} binding accepts ${event.routingKey}. Use mandatory publishing, observe returned messages, and repair the binding or event contract.`
                    : `${routed.map((item) => item.queue.label).join(', ')} receive independent copies. Acknowledging one queue never removes another queue's copy.`}
                </p>
              </div>
            </div>
          </div>
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
            Routing data could not load
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading routing contracts
        </div>
      )}
    </div>
  );
}
