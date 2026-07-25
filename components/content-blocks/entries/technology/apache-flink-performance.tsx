'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RotateCcw,
  TimerOff,
  Waves,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number; default: number };
type StreamEvent = {
  id: string;
  label: string;
  eventTimeSeconds: number;
  arrivalTimeSeconds: number;
};
type EventScenario = {
  id: string;
  label: string;
  detail: string;
  events: StreamEvent[];
};
type EventTimeModel = {
  title: string;
  description: string;
  windowSizeSeconds: number;
  bounds: {
    outOfOrdernessSeconds: Bound;
    allowedLatenessSeconds: Bound;
  };
  scenarios: EventScenario[];
};
type EventStatus = 'main' | 'late-update' | 'dropped';
type TraceEvent = StreamEvent & {
  watermarkBefore: number | null;
  windowStart: number;
  windowEnd: number;
  status: EventStatus;
};

const BLOCK_ID = 'technology/apache-flink-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/apache-flink/data/event-time-scenarios.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && isFiniteNumber(candidate.default);
}

function isStreamEvent(value: unknown): value is StreamEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StreamEvent>;
  return Boolean(
    candidate.id
      && candidate.label
      && isFiniteNumber(candidate.eventTimeSeconds)
      && isFiniteNumber(candidate.arrivalTimeSeconds),
  );
}

function isEventTimeModel(value: unknown): value is EventTimeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EventTimeModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && isFiniteNumber(candidate.windowSizeSeconds)
      && candidate.bounds
      && isBound(candidate.bounds.outOfOrdernessSeconds)
      && isBound(candidate.bounds.allowedLatenessSeconds)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && Array.isArray(scenario.events)
        && scenario.events.length >= 4
        && scenario.events.every(isStreamEvent)
      )),
  );
}

function classifyEvents(
  events: StreamEvent[],
  windowSizeSeconds: number,
  outOfOrdernessSeconds: number,
  allowedLatenessSeconds: number,
): TraceEvent[] {
  let maximumEventTime: number | null = null;

  return [...events]
    .sort((left, right) => left.arrivalTimeSeconds - right.arrivalTimeSeconds)
    .map((event) => {
      const watermarkBefore = maximumEventTime === null
        ? null
        : maximumEventTime - outOfOrdernessSeconds;
      const windowStart = Math.floor(event.eventTimeSeconds / windowSizeSeconds) * windowSizeSeconds;
      const windowEnd = windowStart + windowSizeSeconds;
      let status: EventStatus = 'main';

      if (watermarkBefore !== null && watermarkBefore >= windowEnd) {
        status = watermarkBefore > windowEnd + allowedLatenessSeconds
          ? 'dropped'
          : 'late-update';
      }

      maximumEventTime = maximumEventTime === null
        ? event.eventTimeSeconds
        : Math.max(maximumEventTime, event.eventTimeSeconds);

      return {
        ...event,
        watermarkBefore,
        windowStart,
        windowEnd,
        status,
      };
    });
}

const statusStyles: Record<EventStatus, string> = {
  main: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  'late-update': 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  dropped: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
};

const statusLabels: Record<EventStatus, string> = {
  main: 'Main result',
  'late-update': 'Late update',
  dropped: 'Too late',
};

export default function ApacheFlinkPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EventTimeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [outOfOrdernessSeconds, setOutOfOrdernessSeconds] = useState(2);
  const [allowedLatenessSeconds, setAllowedLatenessSeconds] = useState(5);

  function resetModel(model: EventTimeModel) {
    setScenarioId(model.scenarios[1]?.id ?? model.scenarios[0].id);
    setOutOfOrdernessSeconds(model.bounds.outOfOrdernessSeconds.default);
    setAllowedLatenessSeconds(model.bounds.allowedLatenessSeconds.default);
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEventTimeModel(payload)) throw new Error('The event-time model is incomplete.');
        setData(payload);
        resetModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the event-time model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const trace = useMemo(() => {
    if (!data || !scenario) return [];
    return classifyEvents(
      scenario.events,
      data.windowSizeSeconds,
      outOfOrdernessSeconds,
      allowedLatenessSeconds,
    );
  }, [allowedLatenessSeconds, data, outOfOrdernessSeconds, scenario]);

  const counts = useMemo(() => trace.reduce(
    (result, event) => ({ ...result, [event.status]: result[event.status] + 1 }),
    { main: 0, 'late-update': 0, dropped: 0 } as Record<EventStatus, number>,
  ), [trace]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Event-time window lab"
          title={data?.title ?? 'Which records reach the window result?'}
          description={data?.description ?? 'Loading the event-time scenarios.'}
          icon={Waves}
          accent="cyan"
          onReset={data ? () => resetModel(data) : undefined}
        />

        {!data || !scenario ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Arrival pattern
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'ordered' ? CheckCircle2 : item.id === 'partition-resumes' ? RotateCcw : Waves}
                        accent={item.id === 'ordered' ? 'emerald' : item.id === 'partition-resumes' ? 'amber' : 'cyan'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Watermark lag"
                  value={outOfOrdernessSeconds}
                  output={`${outOfOrdernessSeconds}s`}
                  {...data.bounds.outOfOrdernessSeconds}
                  accent="cyan"
                  lowLabel="Earlier close"
                  highLabel="Wait for disorder"
                  onChange={setOutOfOrdernessSeconds}
                />
                <LabRange
                  label="Allowed lateness"
                  value={allowedLatenessSeconds}
                  output={`${allowedLatenessSeconds}s`}
                  {...data.bounds.allowedLatenessSeconds}
                  accent="amber"
                  lowLabel="Release state sooner"
                  highLabel="Retain for updates"
                  onChange={setAllowedLatenessSeconds}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-3">
                <LabMetric label="Main result" value={String(counts.main)} detail="Arrived before the window fired" icon={CheckCircle2} tone="emerald" />
                <LabMetric label="Late updates" value={String(counts['late-update'])} detail="Window fired, but retained state accepts an update" icon={Clock3} tone="amber" />
                <LabMetric label="Too late" value={String(counts.dropped)} detail="Window state is already eligible for cleanup" icon={TimerOff} tone={counts.dropped > 0 ? 'rose' : 'neutral'} />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Arrival-order trace</p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                      Compare event time with the watermark already observed
                    </h4>
                  </div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    {data.windowSizeSeconds}s tumbling windows
                  </span>
                </div>

                <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {trace.map((event, index) => (
                    <li key={event.id} className={`min-w-0 rounded-md border p-4 ${statusStyles[event.status]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase opacity-70">Arrival {index + 1}</p>
                          <h5 className="mt-1 truncate text-sm font-semibold">{event.label}</h5>
                        </div>
                        <span className="shrink-0 rounded-full border border-current/20 px-2 py-1 text-[11px] font-semibold uppercase">
                          {statusLabels[event.status]}
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <dt className="opacity-65">Event time</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">t={event.eventTimeSeconds}s</dd>
                        </div>
                        <div>
                          <dt className="opacity-65">Arrived at</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">+{event.arrivalTimeSeconds}s</dd>
                        </div>
                        <div>
                          <dt className="opacity-65">Watermark before</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">{event.watermarkBefore === null ? 'Not emitted' : `t=${event.watermarkBefore}s`}</dd>
                        </div>
                        <div>
                          <dt className="opacity-65">Assigned window</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">[{event.windowStart}, {event.windowEnd})</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-md border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
                <div className="flex items-start gap-3">
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Two controls, two different costs</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      Watermark lag delays the first result so more disorder can arrive. Allowed lateness keeps a fired window&apos;s state longer and can emit updated results. Neither setting repairs a downstream sink that cannot accept updates.
                    </p>
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

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6" role={error ? 'alert' : 'status'}>
      <div className="max-w-md text-center">
        {error
          ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-cyan-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">
          {error ? 'Event-time model unavailable' : 'Loading event-time model'}
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {error ?? 'Preparing the arrival-order trace.'}
        </p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
