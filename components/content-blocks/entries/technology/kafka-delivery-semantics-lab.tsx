'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Database,
  FileCheck2,
  LoaderCircle,
  MessageSquareMore,
  Repeat2,
  ServerCrash,
  ShieldCheck,
  ShieldOff,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ProducerContract = {
  id: string;
  label: string;
  detail: string;
  acks: '1' | 'all';
  idempotent: boolean;
  minimumIsr: number;
};
type ConsumerContract = {
  id: 'commit-before' | 'commit-after' | 'kafka-transaction';
  label: string;
  detail: string;
};
type FailureScenario = {
  id: 'lost-producer-response' | 'leader-before-replication' | 'consumer-after-side-effect';
  label: string;
  detail: string;
  failureStage: string;
  target: 'external' | 'kafka';
};
type DeliveryFailureData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    producerContractId: string;
    consumerContractId: string;
    idempotentHandler: boolean;
  };
  producerContracts: ProducerContract[];
  consumerContracts: ConsumerContract[];
  scenarios: FailureScenario[];
};

type TraceState = 'neutral' | 'good' | 'warning' | 'failed';
type TraceStage = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  state: TraceState;
  icon: LucideIcon;
};

const BLOCK_ID = 'technology/kafka-delivery-semantics-lab';

function isProducerContract(value: unknown): value is ProducerContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProducerContract>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && (candidate.acks === '1' || candidate.acks === 'all')
      && typeof candidate.idempotent === 'boolean'
      && typeof candidate.minimumIsr === 'number',
  );
}

function isConsumerContract(value: unknown): value is ConsumerContract {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConsumerContract>;
  return Boolean(
    candidate.id
      && ['commit-before', 'commit-after', 'kafka-transaction'].includes(candidate.id)
      && candidate.label
      && candidate.detail,
  );
}

function isFailureScenario(value: unknown): value is FailureScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureScenario>;
  return Boolean(
    candidate.id
      && ['lost-producer-response', 'leader-before-replication', 'consumer-after-side-effect'].includes(candidate.id)
      && candidate.label
      && candidate.detail
      && candidate.failureStage
      && (candidate.target === 'external' || candidate.target === 'kafka'),
  );
}

function isDeliveryFailureData(value: unknown): value is DeliveryFailureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeliveryFailureData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.producerContractId
      && candidate.defaults.consumerContractId
      && typeof candidate.defaults.idempotentHandler === 'boolean'
      && Array.isArray(candidate.producerContracts)
      && candidate.producerContracts.length >= 2
      && candidate.producerContracts.every(isProducerContract)
      && Array.isArray(candidate.consumerContracts)
      && candidate.consumerContracts.length >= 3
      && candidate.consumerContracts.every(isConsumerContract)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isFailureScenario),
  );
}

export default function KafkaDeliverySemanticsLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DeliveryFailureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No delivery-failure model was supplied.');
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
        if (!isDeliveryFailureData(payload)) {
          throw new Error('The delivery-failure model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the delivery lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <DeliveryWorkbench data={data} />;
}

function DeliveryWorkbench({ data }: { data: DeliveryFailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [producerContractId, setProducerContractId] = useState(data.defaults.producerContractId);
  const [consumerContractId, setConsumerContractId] = useState(data.defaults.consumerContractId);
  const [idempotentHandler, setIdempotentHandler] = useState(data.defaults.idempotentHandler);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const producer = data.producerContracts.find((item) => item.id === producerContractId)
    ?? data.producerContracts[0];
  const consumer = data.consumerContracts.find((item) => item.id === consumerContractId)
    ?? data.consumerContracts[0];

  const result = useMemo(() => {
    let logRecords = 1;
    let sideEffects = 1;
    let offsetState = 'Committed after completed work';
    let verdict = 'The failure is contained by explicit replay boundaries';
    let detail = 'Kafka may retry or replay, while stable identities keep the visible business result singular.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let guarantee = 'Replay-safe';
    let trace: TraceStage[] = [];

    if (scenario.id === 'lost-producer-response') {
      logRecords = producer.idempotent ? 1 : 2;
      sideEffects = idempotentHandler ? Math.min(1, logRecords) : logRecords;
      offsetState = consumer.id === 'commit-before'
        ? 'Advanced before handling'
        : consumer.id === 'kafka-transaction'
          ? 'Atomic with Kafka output'
          : 'Advanced after handling';

      if (!producer.idempotent && !idempotentHandler) {
        verdict = 'One lost response becomes duplicate business work';
        detail = 'The producer retry appends a second record and the destination accepts both operations.';
        tone = 'rose';
        guarantee = 'Duplicate effect';
      } else if (!producer.idempotent) {
        verdict = 'The log duplicates, but the destination contains the replay';
        detail = 'Both records are consumed, while the stable event identity prevents a second business mutation.';
        tone = 'amber';
        guarantee = 'Duplicate log record';
      } else {
        verdict = 'The producer retry resolves to one log record';
        detail = 'Protocol idempotence lets the broker recognize the retried batch; destination idempotence protects later consumer replays.';
      }

      trace = [
        { id: 'send', eyebrow: 'Producer', title: 'Batch sent', detail: producer.detail, state: 'good', icon: Activity },
        { id: 'append', eyebrow: 'Partition log', title: 'First append succeeds', detail: 'The leader stores the batch and assigns offsets.', state: 'good', icon: Database },
        { id: 'response', eyebrow: 'Network', title: 'Acknowledgement lost', detail: 'The producer cannot know whether the first attempt committed.', state: 'failed', icon: CloudOff },
        { id: 'retry', eyebrow: 'Retry', title: producer.idempotent ? 'Duplicate batch rejected' : 'Second append accepted', detail: `${logRecords} record ${logRecords === 1 ? 'copy remains' : 'copies remain'} in the log.`, state: producer.idempotent ? 'good' : 'warning', icon: Repeat2 },
        { id: 'effect', eyebrow: 'Destination', title: `${sideEffects} visible ${sideEffects === 1 ? 'effect' : 'effects'}`, detail: idempotentHandler ? 'The stable event ID returns the first result on replay.' : 'The handler does not recognize the same business operation.', state: sideEffects === 1 ? 'good' : 'failed', icon: FileCheck2 },
      ];
    } else if (scenario.id === 'leader-before-replication') {
      const durableContract = producer.acks === 'all' && producer.minimumIsr >= 2;
      logRecords = durableContract ? 1 : 0;
      sideEffects = logRecords;
      offsetState = durableContract ? 'Consumed after retry' : 'No record to consume';

      if (durableContract) {
        verdict = 'Durability becomes an explicit retry, not false success';
        detail = 'The first append cannot satisfy the minimum ISR, so it is not acknowledged. The producer retries after leadership recovers.';
        tone = 'amber';
        guarantee = 'Temporary unavailability';
      } else {
        verdict = 'The application receives success for a record that disappears';
        detail = 'Leader-only acknowledgement completed before a follower copied the record. The failed leader takes the only copy with it.';
        tone = 'rose';
        guarantee = 'Acknowledged loss';
      }

      trace = [
        { id: 'send', eyebrow: 'Producer', title: 'Batch sent', detail: producer.detail, state: 'good', icon: Activity },
        { id: 'append', eyebrow: 'Leader', title: 'Local append succeeds', detail: 'The follower has not copied the batch yet.', state: 'warning', icon: Database },
        { id: 'failure', eyebrow: 'Broker failure', title: 'Leader becomes unavailable', detail: scenario.failureStage, state: 'failed', icon: ServerCrash },
        { id: 'contract', eyebrow: 'Acknowledgement', title: durableContract ? 'No success returned' : 'Success was already returned', detail: durableContract ? 'Minimum ISR was not met; the send remains retryable.' : 'acks=1 did not wait for a follower.', state: durableContract ? 'warning' : 'failed', icon: durableContract ? ShieldCheck : ShieldOff },
        { id: 'recovery', eyebrow: 'Recovery', title: durableContract ? 'Retry creates one surviving record' : 'The record is absent', detail: durableContract ? 'A healthy leader accepts the idempotent retry.' : 'Downstream consumers cannot recover data Kafka no longer has.', state: durableContract ? 'good' : 'failed', icon: durableContract ? Repeat2 : CloudOff },
      ];
    } else {
      logRecords = 1;

      if (consumer.id === 'commit-before') {
        sideEffects = 0;
        offsetState = 'Committed before crash';
        verdict = 'Progress advances past work that never completed';
        detail = 'The crash occurs after the offset commit and before the external mutation. Kafka will not replay the skipped record.';
        tone = 'rose';
        guarantee = 'Lost business work';
      } else if (consumer.id === 'kafka-transaction') {
        sideEffects = idempotentHandler ? 1 : 2;
        offsetState = 'Kafka offset is transactional';
        verdict = idempotentHandler
          ? 'Destination idempotency closes the external transaction gap'
          : 'The Kafka transaction cannot contain the external database';
        detail = idempotentHandler
          ? 'Kafka retries the aborted read-process-write unit, while the database recognizes the previously committed operation.'
          : 'The database may commit before the Kafka transaction aborts. Retrying can apply the external mutation twice.';
        tone = idempotentHandler ? 'emerald' : 'rose';
        guarantee = idempotentHandler ? 'Replay-safe external effect' : 'Transaction scope mismatch';
      } else {
        sideEffects = idempotentHandler ? 1 : 2;
        offsetState = 'Replay required';
        verdict = idempotentHandler
          ? 'At-least-once delivery becomes one business effect'
          : 'Correct offset ordering still repeats a non-idempotent effect';
        detail = idempotentHandler
          ? 'The external write and event receipt commit together, so replay returns the first result before the offset advances.'
          : 'The replay is expected because the offset did not commit. The destination has no stable identity to suppress the second mutation.';
        tone = idempotentHandler ? 'emerald' : 'rose';
        guarantee = idempotentHandler ? 'Replay-safe' : 'Duplicate effect';
      }

      trace = [
        { id: 'read', eyebrow: 'Partition log', title: 'One record is polled', detail: 'The consumer owns this partition and offset.', state: 'good', icon: MessageSquareMore },
        { id: 'progress', eyebrow: 'Offset policy', title: consumer.id === 'commit-before' ? 'Offset commits first' : consumer.id === 'kafka-transaction' ? 'Offset joins Kafka transaction' : 'Offset waits', detail: consumer.detail, state: consumer.id === 'commit-before' ? 'warning' : 'good', icon: FileCheck2 },
        { id: 'effect', eyebrow: 'External system', title: consumer.id === 'commit-before' ? 'Mutation never starts' : 'Mutation commits', detail: idempotentHandler ? 'A unique event ID guards the business mutation.' : 'The destination accepts every attempt as new.', state: consumer.id === 'commit-before' ? 'failed' : idempotentHandler ? 'good' : 'warning', icon: Database },
        { id: 'crash', eyebrow: 'Process failure', title: 'Consumer stops', detail: scenario.failureStage, state: 'failed', icon: ServerCrash },
        { id: 'restart', eyebrow: 'Restart', title: consumer.id === 'commit-before' ? 'Kafka starts after the skipped record' : 'Kafka replays the record', detail: `${sideEffects} visible business ${sideEffects === 1 ? 'effect' : 'effects'} after recovery.`, state: sideEffects === 1 ? 'good' : 'failed', icon: Repeat2 },
      ];
    }

    return {
      guarantee,
      logRecords,
      offsetState,
      sideEffects,
      tone,
      trace,
      verdict,
      detail,
    } as const;
  }, [consumer, idempotentHandler, producer, scenario]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setProducerContractId(data.defaults.producerContractId);
    setConsumerContractId(data.defaults.consumerContractId);
    setIdempotentHandler(data.defaults.idempotentHandler);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Delivery failure lab"
          title={data.title}
          description={data.description}
          icon={Repeat2}
          accent="rose"
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
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'lost-producer-response' ? CloudOff : item.id === 'leader-before-replication' ? ServerCrash : Database}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Producer contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.producerContracts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === producer.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.idempotent ? ShieldCheck : ShieldOff}
                      accent={item.idempotent ? 'emerald' : 'amber'}
                      onClick={() => setProducerContractId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Consumer progress
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.consumerContracts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === consumer.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'kafka-transaction' ? ShieldCheck : FileCheck2}
                      accent={item.id === 'commit-before' ? 'amber' : item.id === 'kafka-transaction' ? 'violet' : 'blue'}
                      onClick={() => setConsumerContractId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                aria-pressed={idempotentHandler}
                onClick={() => setIdempotentHandler((value) => !value)}
                className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${idempotentHandler
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <span className="flex items-start gap-3">
                  {idempotentHandler
                    ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    : <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>
                    <span className="block text-sm font-semibold">
                      Idempotent destination handler: {idempotentHandler ? 'on' : 'off'}
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">
                      A stable event ID and the business mutation commit in one destination transaction.
                    </span>
                  </span>
                </span>
              </button>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Surviving log records"
                value={String(result.logRecords)}
                detail="Copies visible after recovery in this bounded trace"
                icon={Database}
                tone={result.logRecords === 1 ? 'blue' : result.logRecords === 0 ? 'rose' : 'amber'}
              />
              <LabMetric
                label="Business effects"
                value={String(result.sideEffects)}
                detail="User-visible destination mutations"
                icon={FileCheck2}
                tone={result.sideEffects === 1 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Offset outcome"
                value={result.offsetState}
                detail={scenario.id === 'leader-before-replication'
                  ? 'Consumer settings cannot recover data absent from the log'
                  : consumer.label}
                icon={Repeat2}
                tone={result.sideEffects === 1 ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Observed contract"
                value={result.guarantee}
                detail={scenario.failureStage}
                icon={result.tone === 'emerald' ? ShieldCheck : CircleAlert}
                tone={result.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Failure trace
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {scenario.label}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {scenario.target === 'external' ? 'External side-effect boundary' : 'Kafka durability boundary'}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-stretch">
                {result.trace.map((stage, index) => (
                  <div key={stage.id} className="contents">
                    <TraceStageView stage={stage} />
                    {index < result.trace.length - 1 ? <PathArrow /> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className={`rounded-md border p-4 ${result.tone === 'rose'
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
    </div>
  );
}

function TraceStageView({ stage }: { stage: TraceStage }) {
  const styles: Record<TraceState, string> = {
    neutral: 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100',
    failed: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100',
  };
  const Icon = stage.icon;

  return (
    <div className={`min-w-0 flex-1 rounded-md border p-3 ${styles[stage.state]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase opacity-70">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{stage.eyebrow}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{stage.title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{stage.detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-4 w-4 xl:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-4 w-4 xl:block" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
        {error ? (
          <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-500" />
        ) : (
          <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-rose-500 motion-reduce:animate-none" />
        )}
        <h3 className="mt-3 text-base font-semibold text-neutral-950 dark:text-white">
          {error ? 'Delivery model unavailable' : 'Loading delivery model'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing producer, broker, consumer, and side-effect states.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:bg-white dark:text-neutral-950"
          >
            Retry
          </button>
        ) : null}
      </div>
    </LearningLab>
  );
}
