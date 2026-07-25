'use client';

import { useEffect, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  CircleOff,
  CloudCog,
  Database,
  Inbox,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  Repeat2,
  ShieldAlert,
  ShieldCheck,
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

type ScenarioId = 'consumer-crash' | 'lost-ack' | 'poison-message';
type Acknowledgement = 'on-receive' | 'after-effect';
type Bound = { min: number; max: number; step: number };

type FailureScenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  transient: boolean;
};

type DeliveryFailureModel = {
  defaults: {
    scenario: ScenarioId;
    acknowledgement: Acknowledgement;
    idempotent: boolean;
    maxAttempts: number;
  };
  bounds: { maxAttempts: Bound };
  scenarios: FailureScenario[];
};

const scenarioIcons = {
  'consumer-crash': CloudCog,
  'lost-ack': ReceiptText,
  'poison-message': ShieldAlert,
} as const;

function evaluateDelivery({
  scenario,
  acknowledgement,
  idempotent,
  maxAttempts,
}: {
  scenario: ScenarioId;
  acknowledgement: Acknowledgement;
  idempotent: boolean;
  maxAttempts: number;
}) {
  const ackBeforeEffect = acknowledgement === 'on-receive';

  if (scenario === 'poison-message') {
    if (ackBeforeEffect) {
      return {
        attempts: 1,
        businessEffects: 0,
        finalState: 'Lost after acknowledgement',
        contract: 'At-most-once delivery',
        redelivery: 'No redelivery',
        safe: false,
        explanation: 'The broker deletes the message before validation. The permanent failure becomes silent lost work instead of an owned recovery item.',
        recovery: 'No broker copy remains. Reconstruct the work from another source of truth.',
      };
    }

    return {
      attempts: maxAttempts,
      businessEffects: 0,
      finalState: 'Dead-lettered',
      contract: 'At-least-once delivery',
      redelivery: `${Math.max(0, maxAttempts - 1)} retries`,
      safe: true,
      explanation: `The invalid message receives ${maxAttempts} bounded attempts, then leaves the main path so healthy work can continue.`,
      recovery: 'Preserve payload reference, schema version, error, attempts, and correlation ID for repair and controlled replay.',
    };
  }

  if (scenario === 'consumer-crash') {
    if (ackBeforeEffect) {
      return {
        attempts: 1,
        businessEffects: 0,
        finalState: 'Lost after crash',
        contract: 'At-most-once delivery',
        redelivery: 'No redelivery',
        safe: false,
        explanation: 'The broker observed an acknowledgement before the effect. The crash leaves no delivery eligible for retry.',
        recovery: 'Repair requires a separate source of truth because the broker considers the message complete.',
      };
    }

    return {
      attempts: 2,
      businessEffects: 1,
      finalState: 'Processed on retry',
      contract: 'At-least-once delivery',
      redelivery: 'One redelivery',
      safe: true,
      explanation: 'The first attempt made no effect and no acknowledgement. The broker redelivers, and the second attempt commits one result.',
      recovery: 'Retry is appropriate because the modeled crash is transient and the first attempt made no durable effect.',
    };
  }

  if (ackBeforeEffect) {
    return {
      attempts: 1,
      businessEffects: 1,
      finalState: 'Processed without replay',
      contract: 'At-most-once delivery',
      redelivery: 'No redelivery',
      safe: false,
      explanation: 'This exact effect completed once, but acknowledging before the effect still creates a separate crash window where accepted work can be lost.',
      recovery: 'The broker cannot help after early acknowledgement. Reconciliation must compare business state with the producer source of truth.',
    };
  }

  return {
    attempts: 2,
    businessEffects: idempotent ? 1 : 2,
    finalState: idempotent ? 'One effect, duplicate suppressed' : 'Duplicate business effect',
    contract: idempotent ? 'Effectively-once result' : 'At-least-once delivery',
    redelivery: 'One redelivery',
    safe: idempotent,
    explanation: idempotent
      ? 'The acknowledgement is uncertain, so delivery repeats. The stored message ID turns the second attempt into a no-op with the original result.'
      : 'The acknowledgement is uncertain, so delivery repeats. Without a stable message identity, the handler applies the business operation twice.',
    recovery: idempotent
      ? 'Acknowledge the replay after reading the existing result associated with this message ID.'
      : 'Stop replay, reconcile the duplicate effect, and add a durable idempotency boundary before resuming.',
  };
}

export default function MessageQueuesDeliveryFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DeliveryFailureModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>('lost-ack');
  const [acknowledgement, setAcknowledgement] = useState<Acknowledgement>('after-effect');
  const [idempotent, setIdempotent] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(4);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The delivery-failure model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<DeliveryFailureModel>;
      })
      .then((model) => {
        setData(model);
        setScenario(model.defaults.scenario);
        setAcknowledgement(model.defaults.acknowledgement);
        setIdempotent(model.defaults.idempotent);
        setMaxAttempts(model.defaults.maxAttempts);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the delivery-failure model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) {
    return (
      <div data-content-block="fundamentals/message-queues-delivery-contract-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Delivery-failure model unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div data-content-block="fundamentals/message-queues-delivery-contract-lab">
        <div className="min-h-[640px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading delivery-failure model" />
      </div>
    );
  }

  const selectedScenario = data.scenarios.find((item) => item.id === scenario) ?? data.scenarios[0];
  const result = evaluateDelivery({ scenario, acknowledgement, idempotent, maxAttempts });
  const statusTone = result.safe
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';

  return (
    <div data-content-block="fundamentals/message-queues-delivery-contract-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Acknowledgement and replay lab"
          title="Choose what a failure is allowed to cost"
          description="Inject one failure, place the acknowledgement, and decide whether a repeated delivery can repeat the business effect."
          icon={Repeat2}
          accent="rose"
          onReset={() => {
            setScenario(data.defaults.scenario);
            setAcknowledgement(data.defaults.acknowledgement);
            setIdempotent(data.defaults.idempotent);
            setMaxAttempts(data.defaults.maxAttempts);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject a failure</legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((option) => {
                    const Icon = scenarioIcons[option.id];
                    return <LabChoice key={option.id} selected={scenario === option.id} label={option.label} detail={option.detail} icon={Icon} accent={option.id === 'poison-message' ? 'rose' : option.id === 'lost-ack' ? 'violet' : 'amber'} onClick={() => setScenario(option.id)} />;
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Acknowledgement point</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={acknowledgement === 'on-receive'} label="On receipt" detail="The broker may delete the message before the business effect exists." icon={CircleOff} accent="amber" onClick={() => setAcknowledgement('on-receive')} />
                  <LabChoice selected={acknowledgement === 'after-effect'} label="After durable effect" detail="An uncertain acknowledgement may redeliver, so the effect needs replay protection." icon={PackageCheck} accent="emerald" onClick={() => setAcknowledgement('after-effect')} />
                </div>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <input type="checkbox" checked={idempotent} onChange={(event) => setIdempotent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600" />
                <span><span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white"><LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" />Store a processed-message identity</span><span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Commit the stable message ID with the business effect so a replay can return the existing result.</span></span>
              </label>

              <LabRange label="Maximum attempts" value={maxAttempts} output={`${maxAttempts}`} {...data.bounds.maxAttempts} accent="rose" lowLabel="fail fast" highLabel="more retry load" onChange={setMaxAttempts} />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Observed contract" value={result.contract} detail={acknowledgement === 'on-receive' ? 'Acknowledgement precedes the effect' : 'Acknowledgement follows the effect'} icon={ShieldCheck} tone={result.safe ? 'emerald' : 'amber'} />
            <LabMetric label="Attempts" value={`${result.attempts}`} detail={result.redelivery} icon={Repeat2} tone={result.attempts > 1 ? 'violet' : 'neutral'} />
            <LabMetric label="Business effects" value={`${result.businessEffects}`} detail={result.businessEffects > 1 ? 'User-visible duplicate' : result.businessEffects === 1 ? 'One durable result' : 'No completed effect'} icon={Database} tone={result.businessEffects > 1 ? 'rose' : result.businessEffects === 1 ? 'emerald' : 'amber'} />
            <LabMetric label="Final state" value={result.finalState} detail={selectedScenario.label} icon={result.safe ? CheckCircle2 : TriangleAlert} tone={result.safe ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Trace one message through the selected failure</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Delivery can repeat without repeating the effect. The acknowledgement and stable message identity decide which one occurs.</p>
            </div>
            <ol className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <li className="relative rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50"><Inbox aria-hidden="true" className="h-4 w-4" /><p className="mt-2 text-xs font-semibold uppercase opacity-70">1. Deliver</p><p className="mt-1 text-sm font-semibold">Broker exposes message</p><p className="mt-1 text-xs leading-5 opacity-75">The message remains recoverable until the chosen acknowledgement point.</p></li>
              <li className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50"><CloudCog aria-hidden="true" className="h-4 w-4" /><p className="mt-2 text-xs font-semibold uppercase opacity-70">2. Inject</p><p className="mt-1 text-sm font-semibold">{selectedScenario.label}</p><p className="mt-1 text-xs leading-5 opacity-75">{selectedScenario.detail}</p></li>
              <li className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-50"><Repeat2 aria-hidden="true" className="h-4 w-4" /><p className="mt-2 text-xs font-semibold uppercase opacity-70">3. Recover</p><p className="mt-1 text-sm font-semibold">{result.redelivery}</p><p className="mt-1 text-xs leading-5 opacity-75">{scenario === 'poison-message' && acknowledgement === 'after-effect' ? `Stop after ${maxAttempts} attempts and isolate the payload.` : result.recovery}</p></li>
              <li className={`rounded-md border p-3 ${result.safe ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}>{scenario === 'poison-message' && result.safe ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : result.safe ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}<p className="mt-2 text-xs font-semibold uppercase opacity-70">4. Outcome</p><p className="mt-1 text-sm font-semibold">{result.finalState}</p><p className="mt-1 text-xs leading-5 opacity-75">{result.businessEffects} durable business effect{result.businessEffects === 1 ? '' : 's'}.</p></li>
            </ol>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${statusTone}`} role="status">
            <div className="flex items-start gap-3">
              {result.safe ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div><p className="text-sm font-semibold">Delivery consequence</p><p className="mt-1 text-xs leading-5 opacity-80">{result.explanation}</p></div>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400"><ArchiveRestore aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{result.recovery}</p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
