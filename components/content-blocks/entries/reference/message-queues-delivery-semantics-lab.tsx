'use client';

import { useEffect, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  CircleOff,
  GitBranch,
  Inbox,
  Layers3,
  LockKeyhole,
  PackageCheck,
  Repeat2,
  ShieldAlert,
  Split,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ContractId = 'at-most-once' | 'at-least-once' | 'effectively-once';
type AckPoint = 'on-receive' | 'after-effect';
type RedrivePolicyId = 'hold' | 'retry-dlq' | 'skip';
type Option = { id: string; label: string; detail: string };

type DeliveryModel = {
  defaults: {
    contract: ContractId;
    ackPoint: AckPoint;
    idempotency: boolean;
    poisonPercent: number;
    partitions: number;
    redrivePolicy: RedrivePolicyId;
  };
  bounds: {
    poisonPercent: { min: number; max: number; step: number };
    partitions: { min: number; max: number; step: number };
  };
  contracts: Option[];
  redrivePolicies: Option[];
};

const contractIcons = {
  'at-most-once': CircleOff,
  'at-least-once': Repeat2,
  'effectively-once': PackageCheck,
} as const;

function deliveryResult({
  contract,
  ackPoint,
  idempotency,
  poisonPercent,
  partitions,
  redrivePolicy,
}: {
  contract: ContractId;
  ackPoint: AckPoint;
  idempotency: boolean;
  poisonPercent: number;
  partitions: number;
  redrivePolicy: RedrivePolicyId;
}) {
  const acknowledgementBeforeEffect = ackPoint === 'on-receive' || contract === 'at-most-once';
  const redeliveryPossible = !acknowledgementBeforeEffect;
  const effectivelyOnce = contract === 'effectively-once' && !acknowledgementBeforeEffect && idempotency;
  const duplicateOutcome = !redeliveryPossible
    ? 'No broker redelivery; an acknowledged crash can lose work.'
    : effectivelyOnce
      ? 'Delivery can repeat, but a stable idempotency record suppresses the second business effect.'
      : idempotency
        ? 'Delivery can repeat; the idempotency record makes the modeled side effect safe to replay.'
        : 'A lost acknowledgement can replay the message and repeat the business effect.';
  const lossOutcome = acknowledgementBeforeEffect
    ? 'Possible: a crash after acknowledgement and before the effect loses the message.'
    : redrivePolicy === 'skip' && poisonPercent > 0
      ? 'Intentional for poison messages: retries eventually discard them.'
      : 'No intentional loss: unacknowledged work remains eligible for retry or repair.';
  const orderingOutcome = partitions === 1
    ? redrivePolicy === 'hold' && poisonPercent > 0
      ? 'One partition preserves sequence, but poison retries halt all later work.'
      : redrivePolicy === 'retry-dlq' && poisonPercent > 0
        ? 'Main-path order continues after dead-lettering, but repaired work can be observed later than following messages.'
        : 'One partition can preserve source sequence while one consumer processes it in order.'
    : redrivePolicy === 'hold' && poisonPercent > 0
      ? `Order exists only within each of ${partitions} partitions; a poison message blocks its own partition.`
      : `Order exists only within each of ${partitions} partitions. There is no global event order across keys.`;
  const recovery = poisonPercent === 0
    ? 'No poison messages are modeled. Keep bounded retry and alerting ready for when failures appear.'
    : redrivePolicy === 'hold'
      ? 'Inspect the failing payload and dependency, then resume the blocked partition. This protects sequence but delays all later messages on it.'
      : redrivePolicy === 'retry-dlq'
        ? 'Retry with delay and a fixed attempt budget, then send the payload, error, attempts, and correlation ID to a dead-letter queue for repair and controlled replay.'
        : 'Record the discard with a stable message ID and alert an operator. A skip policy needs a separate source of truth or compensating repair path.';
  const contractLabel = effectivelyOnce
    ? 'Effectively-once business effect'
    : acknowledgementBeforeEffect
      ? 'At-most-once delivery behavior'
      : 'At-least-once delivery behavior';

  return { acknowledgementBeforeEffect, redeliveryPossible, effectivelyOnce, duplicateOutcome, lossOutcome, orderingOutcome, recovery, contractLabel };
}

export default function MessageQueuesDeliverySemanticsLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DeliveryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractId>('at-least-once');
  const [ackPoint, setAckPoint] = useState<AckPoint>('after-effect');
  const [idempotency, setIdempotency] = useState(true);
  const [poisonPercent, setPoisonPercent] = useState(4);
  const [partitions, setPartitions] = useState(3);
  const [redrivePolicy, setRedrivePolicy] = useState<RedrivePolicyId>('retry-dlq');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The delivery-semantics model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<DeliveryModel>;
      })
      .then((model) => {
        setData(model);
        const defaults = model.defaults;
        setContract(defaults.contract);
        setAckPoint(defaults.ackPoint);
        setIdempotency(defaults.idempotency);
        setPoisonPercent(defaults.poisonPercent);
        setPartitions(defaults.partitions);
        setRedrivePolicy(defaults.redrivePolicy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the delivery-semantics model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="reference/message-queues-delivery-semantics-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Delivery-semantics model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="reference/message-queues-delivery-semantics-lab">
        <div className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading delivery-semantics model" />
      </div>
    );
  }

  const selectedContract = data.contracts.find((item) => item.id === contract) ?? data.contracts[0];
  const selectedRedrive = data.redrivePolicies.find((item) => item.id === redrivePolicy) ?? data.redrivePolicies[0];
  const result = deliveryResult({ contract, ackPoint, idempotency, poisonPercent, partitions, redrivePolicy });
  const warning = result.acknowledgementBeforeEffect || (!idempotency && result.redeliveryPossible) || (redrivePolicy === 'skip' && poisonPercent > 0);
  const warningCopy = result.acknowledgementBeforeEffect
    ? 'The acknowledgement is before the side effect. A crash in the gap becomes lost work, even if the chosen label says at-least-once or effectively-once.'
    : !idempotency && result.redeliveryPossible
      ? 'The broker can redeliver after an uncertain acknowledgement, but this consumer has no duplicate-safe business effect.'
      : redrivePolicy === 'skip' && poisonPercent > 0
        ? 'The redrive policy deliberately discards poisoned messages after retry. Document the repair source before adopting this behavior.'
        : 'The selected path makes its remaining risk explicit: delivery can repeat, ordering has a bounded scope, and poison recovery has an owner.';
  const statusTone = warning
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50';

  return (
    <div data-content-block="reference/message-queues-delivery-semantics-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Acknowledgement, replay, and poison-message lab"
          title="Choose what a crash is allowed to cost"
          description="Change the named contract, acknowledgement point, idempotency protection, poison rate, partition count, and redrive policy. The visible result distinguishes repeated delivery from repeated business effects."
          icon={GitBranch}
          accent="violet"
          onReset={() => {
            const defaults = data.defaults;
            setContract(defaults.contract);
            setAckPoint(defaults.ackPoint);
            setIdempotency(defaults.idempotency);
            setPoisonPercent(defaults.poisonPercent);
            setPartitions(defaults.partitions);
            setRedrivePolicy(defaults.redrivePolicy);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Named contract</legend>
                <div className="mt-3 space-y-2">
                  {data.contracts.map((option) => {
                    const optionId = option.id as ContractId;
                    const Icon = contractIcons[optionId];
                    return <LabChoice key={option.id} selected={contract === optionId} label={option.label} detail={option.detail} icon={Icon} accent={optionId === 'at-most-once' ? 'amber' : optionId === 'at-least-once' ? 'blue' : 'violet'} onClick={() => setContract(optionId)} />;
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Acknowledgement point</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={ackPoint === 'on-receive'} label="Acknowledge on receipt" detail="The broker may delete the message before the consumer makes a durable business effect." icon={Inbox} accent="amber" onClick={() => setAckPoint('on-receive')} />
                  <LabChoice selected={ackPoint === 'after-effect'} label="Acknowledge after durable effect" detail="A crash before acknowledgement can redeliver, so the consumer must make a replay safe." icon={CheckCircle2} accent="emerald" onClick={() => setAckPoint('after-effect')} />
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <input type="checkbox" checked={idempotency} onChange={(event) => setIdempotency(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600" />
                <span><span className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100"><LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" />Store a stable processed-message identity</span><span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Model the business effect and message ID as one durable decision before the acknowledgement.</span></span>
              </label>

              <LabRange label="Poison messages" value={poisonPercent} output={`${poisonPercent}%`} {...data.bounds.poisonPercent} accent="rose" lowLabel="none modeled" highLabel="frequent failures" onChange={setPoisonPercent} />
              <LabRange label="Partitions" value={partitions} output={`${partitions}`} {...data.bounds.partitions} accent="blue" lowLabel="one sequence" highLabel="parallel keys" onChange={setPartitions} />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Redrive policy</legend>
                <div className="mt-3 space-y-2">
                  {data.redrivePolicies.map((option) => {
                    const optionId = option.id as RedrivePolicyId;
                    const Icon = optionId === 'hold' ? ShieldAlert : optionId === 'retry-dlq' ? ArchiveRestore : TriangleAlert;
                    return <LabChoice key={option.id} selected={redrivePolicy === optionId} label={option.label} detail={option.detail} icon={Icon} accent={optionId === 'hold' ? 'amber' : optionId === 'retry-dlq' ? 'violet' : 'rose'} onClick={() => setRedrivePolicy(optionId)} />;
                  })}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Observed contract" value={result.contractLabel} detail={`Selected: ${selectedContract.label}`} icon={PackageCheck} tone={result.effectivelyOnce ? 'violet' : result.acknowledgementBeforeEffect ? 'amber' : 'blue'} />
            <LabMetric label="Duplicates" value={result.redeliveryPossible ? result.effectivelyOnce || idempotency ? 'Delivery only' : 'Business effect risk' : 'No redelivery'} detail={result.duplicateOutcome} icon={Repeat2} tone={!idempotency && result.redeliveryPossible ? 'rose' : 'emerald'} />
            <LabMetric label="Loss" value={result.acknowledgementBeforeEffect || (redrivePolicy === 'skip' && poisonPercent > 0) ? 'Possible' : 'Avoided by retry'} detail={result.lossOutcome} icon={TriangleAlert} tone={result.acknowledgementBeforeEffect || (redrivePolicy === 'skip' && poisonPercent > 0) ? 'rose' : 'emerald'} />
            <LabMetric label="Ordering" value={partitions === 1 ? 'One sequence' : `Per partition x ${partitions}`} detail={result.orderingOutcome} icon={Layers3} tone="blue" />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">One message through the selected failure topology</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The broker can only reason about delivery. Idempotency makes a repeated delivery produce one business result.</p></div>
            <ol className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <li className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Durable message</span><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Broker stores message ID</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Retention and a partition key determine replay availability and ordering scope.</p></li>
              <li className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Consumer delivery</span><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">Consumer receives work</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.redeliveryPossible ? 'An uncertain acknowledgement leaves this message eligible for redelivery.' : 'The receipt acknowledgement removes broker retry before the effect.'}</p></li>
              <li className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Business effect</span><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{idempotency ? 'Message ID gates the effect' : 'Effect has no replay guard'}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{idempotency ? 'A duplicate delivery finds the stored identity and becomes a no-op.' : 'A replay can create a second charge, email, or state transition.'}</p></li>
              <li className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"><span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Recovery path</span><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{selectedRedrive.label}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.recovery}</p></li>
            </ol>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${statusTone}`} role="status"><div className="flex items-start gap-3">{warning ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-sm font-semibold">Delivery consequence</p><p className="mt-1 text-xs leading-5 opacity-80">{warningCopy}</p></div></div></div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400"><Split aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />A partition key should group only events that need one ordered sequence. Expanding partitions improves parallelism but does not create a global order.</p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
