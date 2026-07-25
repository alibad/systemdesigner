'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  CopyCheck,
  Database,
  History,
  RotateCcw,
  ShieldCheck,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Arrival = {
  delaySeconds: number;
  count: number;
  label: string;
};
type Scenario = {
  id: string;
  label: string;
  detail: string;
  windowSeconds: number;
  requiredCompletenessPct: number;
  decisionTargetSeconds: number;
  failureEvents: number;
  retryEvents: number;
  arrivals: Arrival[];
};
type Mode = {
  id: string;
  label: string;
  detail: string;
};
type EventTimeData = {
  title: string;
  description: string;
  bounds: {
    allowedLatenessSeconds: Bound;
  };
  defaults: {
    scenarioId: string;
    allowedLatenessSeconds: number;
    deliveryId: string;
    sinkId: string;
  };
  scenarios: Scenario[];
  deliveryModes: Mode[];
  sinkModes: Mode[];
};

const BLOCK_ID = 'technology/streaming-event-time-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/streaming/data/event-time-delivery.json';

function isEventTimeData(value: unknown): value is EventTimeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EventTimeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.bounds?.allowedLatenessSeconds
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.deliveryModes)
      && candidate.deliveryModes.length > 0
      && Array.isArray(candidate.sinkModes)
      && candidate.sinkModes.length > 0,
  );
}

export default function StreamingEventTimeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EventTimeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [allowedLatenessSeconds, setAllowedLatenessSeconds] = useState(25);
  const [deliveryId, setDeliveryId] = useState('at-least-once');
  const [sinkId, setSinkId] = useState('idempotent');

  function reset(model: EventTimeData) {
    setScenarioId(model.defaults.scenarioId);
    setAllowedLatenessSeconds(model.defaults.allowedLatenessSeconds);
    setDeliveryId(model.defaults.deliveryId);
    setSinkId(model.defaults.sinkId);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEventTimeData(payload)) throw new Error('The event-time model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load event-time data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((candidate) => candidate.id === scenarioId)
    ?? data?.scenarios[0]
    ?? null;

  const result = useMemo(() => {
    if (!data || !scenario) return null;
    const uniqueEvents = scenario.arrivals.reduce((sum, arrival) => sum + arrival.count, 0);
    const acceptedEvents = scenario.arrivals
      .filter((arrival) => arrival.delaySeconds <= allowedLatenessSeconds)
      .reduce((sum, arrival) => sum + arrival.count, 0);
    const lateEvents = uniqueEvents - acceptedEvents;
    const lostEvents = deliveryId === 'at-most-once'
      ? Math.min(scenario.failureEvents, acceptedEvents)
      : 0;
    const duplicateEffects = deliveryId === 'at-least-once' && sinkId === 'append'
      ? scenario.retryEvents
      : 0;
    const correctUniqueEvents = acceptedEvents - lostEvents;
    const sinkEffects = correctUniqueEvents + duplicateEffects;
    const completenessPct = (correctUniqueEvents / uniqueEvents) * 100;
    const readyAtSeconds = scenario.windowSeconds + allowedLatenessSeconds;

    if (duplicateEffects > 0) {
      return {
        uniqueEvents,
        acceptedEvents,
        lateEvents,
        lostEvents,
        duplicateEffects,
        correctUniqueEvents,
        sinkEffects,
        completenessPct,
        readyAtSeconds,
        status: 'Duplicate effects escape',
        tone: 'rose' as const,
        verdict: `${scenario.retryEvents} replayed events become additional sink effects. At-least-once delivery needs an idempotent business key or a coordinated transactional sink.`,
      };
    }

    if (lostEvents > 0) {
      return {
        uniqueEvents,
        acceptedEvents,
        lateEvents,
        lostEvents,
        duplicateEffects,
        correctUniqueEvents,
        sinkEffects,
        completenessPct,
        readyAtSeconds,
        status: 'Failure loses accepted facts',
        tone: 'rose' as const,
        verdict: `${lostEvents} accepted events are not replayed after failure. This at-most-once contract is valid only when the product explicitly accepts that loss.`,
      };
    }

    if (completenessPct < scenario.requiredCompletenessPct) {
      return {
        uniqueEvents,
        acceptedEvents,
        lateEvents,
        lostEvents,
        duplicateEffects,
        correctUniqueEvents,
        sinkEffects,
        completenessPct,
        readyAtSeconds,
        status: 'First result is incomplete',
        tone: 'amber' as const,
        verdict: `${lateEvents} unique events miss the initial result, leaving ${completenessPct.toFixed(1)}% completeness against a ${scenario.requiredCompletenessPct}% requirement. Add lateness budget or a visible correction path.`,
      };
    }

    if (allowedLatenessSeconds > scenario.decisionTargetSeconds) {
      return {
        uniqueEvents,
        acceptedEvents,
        lateEvents,
        lostEvents,
        duplicateEffects,
        correctUniqueEvents,
        sinkEffects,
        completenessPct,
        readyAtSeconds,
        status: 'Correct but too slow',
        tone: 'amber' as const,
        verdict: `The result reaches ${completenessPct.toFixed(1)}% completeness, but the ${allowedLatenessSeconds}-second lateness budget exceeds the ${scenario.decisionTargetSeconds}-second decision target. Publish a provisional result or narrow the source delay.`,
      };
    }

    return {
      uniqueEvents,
      acceptedEvents,
      lateEvents,
      lostEvents,
      duplicateEffects,
      correctUniqueEvents,
      sinkEffects,
      completenessPct,
      readyAtSeconds,
      status: 'Contract holds',
      tone: 'emerald' as const,
      verdict: `${correctUniqueEvents} unique events reach the first result, replay creates no extra effect, and the lateness budget stays inside the ${scenario.decisionTargetSeconds}-second decision target.`,
    };
  }, [allowedLatenessSeconds, data, deliveryId, scenario, sinkId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Event time and delivery lab"
          title={data?.title ?? 'How complete and correct is the first result?'}
          description={data?.description ?? 'Loading the event-time model.'}
          icon={History}
          accent="amber"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !scenario || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Arrival pattern
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === scenario.id}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={Clock3}
                        accent="amber"
                        onClick={() => setScenarioId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Allowed lateness"
                  value={allowedLatenessSeconds}
                  output={`${allowedLatenessSeconds} sec`}
                  {...data.bounds.allowedLatenessSeconds}
                  accent="amber"
                  lowLabel="Fast first result"
                  highLabel="More complete first result"
                  onChange={setAllowedLatenessSeconds}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Failure delivery
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.deliveryModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === deliveryId}
                        label={mode.label}
                        detail={mode.detail}
                        icon={mode.id === 'at-least-once' ? RotateCcw : Timer}
                        accent="violet"
                        onClick={() => setDeliveryId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Sink behavior
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.sinkModes.map((mode) => (
                      <LabChoice
                        key={mode.id}
                        selected={mode.id === sinkId}
                        label={mode.label}
                        detail={mode.detail}
                        icon={mode.id === 'idempotent' ? ShieldCheck : Database}
                        accent="emerald"
                        onClick={() => setSinkId(mode.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0" aria-live="polite">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <LabMetric
                  label="First-result completeness"
                  value={`${result.completenessPct.toFixed(1)}%`}
                  detail={`${result.correctUniqueEvents} of ${result.uniqueEvents} unique facts`}
                  icon={CheckCircle2}
                  tone={result.completenessPct >= scenario.requiredCompletenessPct ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Late facts"
                  value={`${result.lateEvents}`}
                  detail={`Arrive after the ${allowedLatenessSeconds}-second watermark delay`}
                  icon={Clock3}
                  tone={result.lateEvents > 0 ? 'amber' : 'neutral'}
                />
                <LabMetric
                  label="Lost on failure"
                  value={`${result.lostEvents}`}
                  detail={deliveryId === 'at-most-once' ? 'Uncertain work is not replayed' : 'Replay protects delivery'}
                  icon={CircleAlert}
                  tone={result.lostEvents > 0 ? 'rose' : 'blue'}
                />
                <LabMetric
                  label="Duplicate effects"
                  value={`${result.duplicateEffects}`}
                  detail={`${result.sinkEffects} total sink effects`}
                  icon={CopyCheck}
                  tone={result.duplicateEffects > 0 ? 'rose' : 'emerald'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Arrival timeline
                    </p>
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      Window closes at {scenario.windowSeconds}s; first result publishes at {result.readyAtSeconds}s.
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Required completeness: {scenario.requiredCompletenessPct}%
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {scenario.arrivals.map((arrival) => {
                    const accepted = arrival.delaySeconds <= allowedLatenessSeconds;
                    const maxCount = Math.max(...scenario.arrivals.map((item) => item.count));
                    return (
                      <div key={`${scenario.id}-${arrival.delaySeconds}`} className="grid min-w-0 gap-2 sm:grid-cols-[110px_minmax(0,1fr)_88px] sm:items-center">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{arrival.label}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">+{arrival.delaySeconds}s</p>
                        </div>
                        <div
                          className="h-7 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
                          role="img"
                          aria-label={`${arrival.count} events arriving ${arrival.delaySeconds} seconds late are ${accepted ? 'accepted' : 'late'}`}
                        >
                          <div
                            className={`flex h-full min-w-10 items-center px-2 text-xs font-semibold transition-[width] motion-reduce:transition-none ${accepted ? 'bg-emerald-500 text-emerald-950' : 'bg-amber-400 text-amber-950'}`}
                            style={{ width: `${Math.max(12, (arrival.count / maxCount) * 100)}%` }}
                          >
                            {arrival.count}
                          </div>
                        </div>
                        <span className={`justify-self-start rounded px-2 py-1 text-xs font-semibold sm:justify-self-end ${accepted ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'}`}>
                          {accepted ? 'Accepted' : 'Late path'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <OutcomeNode label="Unique facts" value={result.uniqueEvents} detail="Ground truth in the window" />
                <OutcomeNode label="Accepted and preserved" value={result.correctUniqueEvents} detail={`${result.lateEvents} late, ${result.lostEvents} lost`} />
                <OutcomeNode label="Sink effects" value={result.sinkEffects} detail={`${result.duplicateEffects} duplicate effects`} />
              </div>

              <section className={`mt-5 border-l-4 p-4 ${result.tone === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.tone === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{result.status}</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">{result.verdict}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function OutcomeNode({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="relative min-w-0 rounded-md border border-neutral-200 bg-white p-4 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) {
    return (
      <div
        className="min-h-[520px] animate-pulse bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900"
        aria-label="Loading event-time model"
      />
    );
  }

  return (
    <div className="p-5 md:p-6" role="alert">
      <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50">
        <p className="text-sm font-semibold">Event-time model unavailable</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
