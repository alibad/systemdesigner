'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  HeartPulse,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Repeat2,
  ShieldCheck,
  Timer,
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

type FailureKind = 'timeout-overlap' | 'crash-after-effect' | 'transient' | 'permanent';
type Bound = { min: number; max: number; step: number };
type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  processingSeconds: number;
  failureKind: FailureKind;
  businessEffect: string;
};
type FailureData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    visibilitySeconds: number;
    maxReceiveCount: number;
    heartbeat: boolean;
    idempotent: boolean;
  };
  bounds: {
    visibilitySeconds: Bound;
    maxReceiveCount: Bound;
  };
  scenarios: FailureScenario[];
};
type TraceStep = {
  label: string;
  time: string;
  detail: string;
  tone: 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
};

const BLOCK_ID = 'technology/sqs-visibility-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isScenario(value: unknown): value is FailureScenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureScenario>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.processingSeconds === 'number'
      && ['timeout-overlap', 'crash-after-effect', 'transient', 'permanent'].includes(candidate.failureKind ?? '')
      && candidate.businessEffect,
  );
}

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureData>;
  const defaults = candidate.defaults;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.scenarioId
      && typeof defaults.visibilitySeconds === 'number'
      && typeof defaults.maxReceiveCount === 'number'
      && typeof defaults.heartbeat === 'boolean'
      && typeof defaults.idempotent === 'boolean'
      && isBound(candidate.bounds?.visibilitySeconds)
      && isBound(candidate.bounds?.maxReceiveCount)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isScenario),
  );
}

export default function SQSVisibilityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
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
        if (!isFailureData(payload)) throw new Error('The delivery-failure model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the delivery lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex min-h-36 items-center justify-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Delivery model unavailable</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
              >
                Try again
              </button>
            </div>
          ) : (
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-violet-600" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Loading the delivery trace...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <FailureWorkbench data={data} />;
}

function FailureWorkbench({ data }: { data: FailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [visibilitySeconds, setVisibilitySeconds] = useState(data.defaults.visibilitySeconds);
  const [maxReceiveCount, setMaxReceiveCount] = useState(data.defaults.maxReceiveCount);
  const [heartbeat, setHeartbeat] = useState(data.defaults.heartbeat);
  const [idempotent, setIdempotent] = useState(data.defaults.idempotent);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const extendedVisibility = heartbeat && scenario.processingSeconds >= visibilitySeconds
      ? scenario.processingSeconds + 15
      : visibilitySeconds;
    let deliveries = 1;
    let businessEffects = scenario.businessEffect === 'none' ? 0 : 1;
    let resolutionSeconds = scenario.processingSeconds;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let headline = 'The message completes before another delivery can start';
    let explanation = 'The worker deletes the message after the durable side effect succeeds.';
    const trace: TraceStep[] = [
      {
        label: 'Delivery 1 starts',
        time: 't=0s',
        detail: `SQS hides the receipt for ${extendedVisibility} seconds.`,
        tone: 'blue',
      },
    ];

    if (scenario.failureKind === 'timeout-overlap') {
      const overlap = extendedVisibility < scenario.processingSeconds;
      if (overlap) {
        deliveries = 2;
        businessEffects = idempotent ? 1 : 2;
        resolutionSeconds = scenario.processingSeconds + extendedVisibility;
        status = idempotent ? 'warning' : 'critical';
        headline = idempotent ? 'The work overlaps, but the business effect is deduplicated' : 'Two workers can apply the same business effect';
        explanation = `The receipt reappears at ${extendedVisibility}s while the first ${scenario.processingSeconds}s handler is still running.`;
        trace.push({
          label: 'Visibility expires',
          time: `t=${extendedVisibility}s`,
          detail: 'A second worker can receive the same message before the first worker finishes.',
          tone: 'rose',
        });
        trace.push({
          label: 'Two attempts finish',
          time: `t~${resolutionSeconds}s`,
          detail: idempotent ? 'Both attempts use one operation key, so only one durable effect is accepted.' : 'Each attempt applies the side effect because no idempotency boundary exists.',
          tone: idempotent ? 'emerald' : 'rose',
        });
      } else {
        trace.push({
          label: heartbeat ? 'Visibility extended' : 'Handler finishes',
          time: `t=${scenario.processingSeconds}s`,
          detail: heartbeat ? 'The worker renews visibility before expiry, then deletes after success.' : 'Processing finishes and DeleteMessage uses the current receipt handle.',
          tone: 'emerald',
        });
      }
    }

    if (scenario.failureKind === 'crash-after-effect') {
      deliveries = 2;
      businessEffects = idempotent ? 1 : 2;
      resolutionSeconds = extendedVisibility + scenario.processingSeconds;
      status = idempotent ? 'warning' : 'critical';
      headline = idempotent ? 'The retry is safe because the operation key is durable' : 'The retry repeats an already committed effect';
      explanation = 'SQS never received DeleteMessage, so it cannot know that the external operation succeeded.';
      trace.push({
        label: 'Effect commits, worker crashes',
        time: `t=${scenario.processingSeconds}s`,
        detail: `The ${scenario.businessEffect} is durable, but the receipt is not deleted.`,
        tone: 'rose',
      });
      trace.push({
        label: 'Message is delivered again',
        time: `t=${extendedVisibility}s`,
        detail: idempotent ? 'The destination recognizes the operation key and returns the first result.' : 'The destination cannot distinguish a retry from a new command.',
        tone: idempotent ? 'emerald' : 'rose',
      });
    }

    if (scenario.failureKind === 'transient') {
      deliveries = 2;
      businessEffects = 1;
      resolutionSeconds = extendedVisibility + scenario.processingSeconds;
      status = extendedVisibility > scenario.processingSeconds * 4 ? 'warning' : 'healthy';
      headline = status === 'warning' ? 'The retry is safe but recovery is unnecessarily slow' : 'The second delivery recovers the transient failure';
      explanation = 'The first attempt fails before any business effect, then the message becomes visible for another worker.';
      trace.push({
        label: 'Dependency call fails',
        time: `t=${scenario.processingSeconds}s`,
        detail: 'The worker records the failure and leaves the message undeleted.',
        tone: 'amber',
      });
      trace.push({
        label: 'Retry succeeds',
        time: `t=${resolutionSeconds}s`,
        detail: `Delivery 2 applies the ${scenario.businessEffect} and deletes the receipt.`,
        tone: 'emerald',
      });
    }

    if (scenario.failureKind === 'permanent') {
      deliveries = maxReceiveCount;
      businessEffects = 0;
      resolutionSeconds = maxReceiveCount * extendedVisibility;
      status = maxReceiveCount === 1 ? 'warning' : maxReceiveCount > 6 ? 'critical' : 'warning';
      headline = maxReceiveCount === 1 ? 'One failure quarantines the message immediately' : `The poison message is quarantined after ${maxReceiveCount} receives`;
      explanation = maxReceiveCount > 6
        ? 'A permanent error consumes repeated work and blocks its FIFO message group for too long.'
        : 'A bounded receive count stops endless retries and preserves the original payload for diagnosis.';
      trace.push({
        label: 'Validation fails every time',
        time: `t=${scenario.processingSeconds}s`,
        detail: 'Backoff cannot repair an incompatible schema or malformed payload.',
        tone: 'amber',
      });
      trace.push({
        label: 'Move to the DLQ',
        time: `t~${resolutionSeconds}s`,
        detail: 'The source queue stops retrying. Operators can inspect and deliberately redrive after a fix.',
        tone: 'violet',
      });
    }

    return {
      businessEffects,
      deliveries,
      explanation,
      headline,
      resolutionSeconds,
      status,
      trace,
      visibilityApplied: extendedVisibility,
    } as const;
  }, [heartbeat, idempotent, maxReceiveCount, scenario, visibilitySeconds]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setVisibilitySeconds(data.defaults.visibilitySeconds);
    setMaxReceiveCount(data.defaults.maxReceiveCount);
    setHeartbeat(data.defaults.heartbeat);
    setIdempotent(data.defaults.idempotent);
  }

  const statusStyle = result.status === 'critical'
    ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    : result.status === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Delivery failure lab"
          title={data.title}
          description={data.description}
          icon={Repeat2}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a failure</legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={`${item.processingSeconds}s handler · ${item.detail}`}
                      icon={item.failureKind === 'permanent' ? TriangleAlert : item.failureKind === 'crash-after-effect' ? Repeat2 : Timer}
                      accent={item.failureKind === 'permanent' ? 'rose' : item.failureKind === 'crash-after-effect' ? 'amber' : 'violet'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Visibility timeout"
                  value={visibilitySeconds}
                  output={`${visibilitySeconds}s`}
                  {...data.bounds.visibilitySeconds}
                  lowLabel="Fast retry"
                  highLabel="Long lease"
                  accent="violet"
                  onChange={setVisibilitySeconds}
                />
                <LabRange
                  label="Max receives before DLQ"
                  value={maxReceiveCount}
                  output={`${maxReceiveCount} receives`}
                  {...data.bounds.maxReceiveCount}
                  lowLabel="Quarantine early"
                  highLabel="Retry longer"
                  accent="amber"
                  onChange={setMaxReceiveCount}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Consumer safeguards</legend>
                <div className="mt-3 grid gap-2">
                  <ToggleChoice
                    pressed={heartbeat}
                    label="Visibility heartbeat"
                    detail="Extend the receipt while legitimate long work is still alive."
                    icon={HeartPulse}
                    onClick={() => setHeartbeat((value) => !value)}
                  />
                  <ToggleChoice
                    pressed={idempotent}
                    label="Durable idempotency key"
                    detail="Accept one business effect for repeated deliveries of the same operation."
                    icon={LockKeyhole}
                    onClick={() => setIdempotent((value) => !value)}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Deliveries" value={String(result.deliveries)} detail="Receive attempts in this trace" icon={Repeat2} tone={result.deliveries > 1 ? 'amber' : 'blue'} />
            <LabMetric label="Business effects" value={String(result.businessEffects)} detail={scenario.businessEffect} icon={ShieldCheck} tone={result.businessEffects > 1 ? 'rose' : 'emerald'} />
            <LabMetric label="Resolution" value={`${result.resolutionSeconds}s`} detail="Approximate modeled time" icon={Clock} tone="violet" />
            <LabMetric label="Visibility applied" value={`${result.visibilityApplied}s`} detail={heartbeat && result.visibilityApplied > visibilitySeconds ? 'Extended by the worker' : 'Queue or receive setting'} icon={Timer} tone="cyan" />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {result.trace.map((step, index) => (
              <TraceCard key={`${step.label}-${index}`} step={step} number={index + 1} />
            ))}
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${statusStyle}`}>
            <div className="flex items-start gap-3">
              {result.status === 'healthy' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-base font-semibold">{result.headline}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <Layers3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
            <p className="text-sm leading-6">
              In a FIFO queue, an in-flight message also holds later messages in the same group. More workers do not unblock that group; deleting, retrying, or quarantining the current message does.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ToggleChoice({
  pressed,
  label,
  detail,
  icon: Icon,
  onClick,
}: {
  pressed: boolean;
  label: string;
  detail: string;
  icon: typeof HeartPulse;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
        pressed
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${pressed ? 'bg-emerald-600 text-white' : 'border border-neutral-400 dark:border-neutral-600'}`}>
          {pressed ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {label}
          </span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function TraceCard({ step, number }: { step: TraceStep; number: number }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    violet: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30',
  } as const;

  return (
    <div className={`min-w-0 rounded-lg border p-4 ${tones[step.tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{number}</span>
        <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">{step.time}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{step.label}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{step.detail}</p>
    </div>
  );
}
