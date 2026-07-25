'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  History,
  LoaderCircle,
  RadioTower,
  RotateCcw,
  TimerOff,
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
type EventSample = {
  id: string;
  label: string;
  eventSecond: number;
  watermarkAgeAtArrivalSeconds: number;
  value: number;
};
type EventScenario = {
  id: string;
  label: string;
  detail: string;
  events: EventSample[];
};
type TriggerPolicy = {
  id: 'final-only' | 'early-and-late';
  label: string;
  detail: string;
  earlyPanes: number;
};
type WindowingModel = {
  title: string;
  description: string;
  window: { label: string; startSecond: number; endSecond: number };
  bounds: { allowedLatenessSeconds: Bound };
  scenarios: EventScenario[];
  triggerPolicies: TriggerPolicy[];
};
type EventResult = EventSample & { status: 'on-time' | 'corrected' | 'dropped' };

const BLOCK_ID = 'technology/google-cloud-dataflow-windowing-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/google-cloud-dataflow/data/windowing-event-trace.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.min <= candidate.max
    && candidate.step > 0;
}

function isEvent(value: unknown): value is EventSample {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EventSample>;
  return Boolean(
    candidate.id
      && candidate.label
      && isFiniteNumber(candidate.eventSecond)
      && isFiniteNumber(candidate.watermarkAgeAtArrivalSeconds)
      && isFiniteNumber(candidate.value),
  );
}

function isWindowingModel(value: unknown): value is WindowingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WindowingModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.window
      && candidate.window.label
      && isFiniteNumber(candidate.window.startSecond)
      && isFiniteNumber(candidate.window.endSecond)
      && candidate.bounds
      && isBound(candidate.bounds.allowedLatenessSeconds)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && Array.isArray(scenario.events)
        && scenario.events.length >= 4
        && scenario.events.every(isEvent)
      ))
      && Array.isArray(candidate.triggerPolicies)
      && candidate.triggerPolicies.length === 2
      && candidate.triggerPolicies.every((policy) => (
        ['final-only', 'early-and-late'].includes(policy.id)
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && isFiniteNumber(policy.earlyPanes)
      )),
  );
}

export default function GoogleCloudDataflowWindowingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<WindowingModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState<TriggerPolicy['id']>('final-only');
  const [allowedLatenessSeconds, setAllowedLatenessSeconds] = useState(30);

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
        if (!isWindowingModel(payload)) throw new Error('The windowing trace is incomplete.');
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setPolicyId(payload.triggerPolicies[0].id);
        setAllowedLatenessSeconds(30);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the windowing trace.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((candidate) => candidate.id === scenarioId) ?? null;
  const policy = data?.triggerPolicies.find((candidate) => candidate.id === policyId) ?? null;

  const result = useMemo(() => {
    const events: EventResult[] = (scenario?.events ?? []).map((event) => ({
      ...event,
      status: event.watermarkAgeAtArrivalSeconds <= 0
        ? 'on-time'
        : event.watermarkAgeAtArrivalSeconds <= allowedLatenessSeconds
          ? 'corrected'
          : 'dropped',
    }));
    const onTime = events.filter((event) => event.status === 'on-time');
    const corrected = events.filter((event) => event.status === 'corrected');
    const dropped = events.filter((event) => event.status === 'dropped');
    const committedTotal = [...onTime, ...corrected].reduce((total, event) => total + event.value, 0);
    const paneCount = (policy?.earlyPanes ?? 0) + (onTime.length > 0 ? 1 : 0) + corrected.length;

    return { committedTotal, corrected, dropped, events, onTime, paneCount };
  }, [allowedLatenessSeconds, policy?.earlyPanes, scenario?.events]);

  function reset() {
    if (!data) return;
    setScenarioId(data.scenarios[0].id);
    setPolicyId(data.triggerPolicies[0].id);
    setAllowedLatenessSeconds(30);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Event-time window lab"
          title={data?.title ?? 'Which events reach the result?'}
          description={data?.description ?? 'Loading the event trace.'}
          icon={Clock3}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !policy ? (
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
                    {data.scenarios.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === scenarioId}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={candidate.id === 'mostly-on-time' ? CheckCircle2 : candidate.id === 'mobile-reconnect' ? RotateCcw : History}
                        accent={candidate.id === 'mostly-on-time' ? 'emerald' : candidate.id === 'mobile-reconnect' ? 'amber' : 'rose'}
                        onClick={() => setScenarioId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Trigger policy
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.triggerPolicies.map((candidate) => (
                      <LabChoice
                        key={candidate.id}
                        selected={candidate.id === policyId}
                        label={candidate.label}
                        detail={candidate.detail}
                        icon={candidate.id === 'final-only' ? AlarmClock : RadioTower}
                        accent={candidate.id === 'final-only' ? 'blue' : 'violet'}
                        onClick={() => setPolicyId(candidate.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Allowed lateness"
                  value={allowedLatenessSeconds}
                  output={`${allowedLatenessSeconds}s`}
                  {...data.bounds.allowedLatenessSeconds}
                  accent="amber"
                  lowLabel="Drop after watermark"
                  highLabel="Hold state longer"
                  onChange={setAllowedLatenessSeconds}
                />
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="On time" value={`${result.onTime.length}`} detail="Arrived before the watermark passed" icon={CheckCircle2} tone="emerald" />
                <LabMetric label="Late corrections" value={`${result.corrected.length}`} detail="Retained inside allowed lateness" icon={History} tone={result.corrected.length > 0 ? 'amber' : 'neutral'} />
                <LabMetric label="Dropped late" value={`${result.dropped.length}`} detail="Arrived after retained state expired" icon={TimerOff} tone={result.dropped.length > 0 ? 'rose' : 'neutral'} />
                <LabMetric label="Modeled panes" value={`${result.paneCount}`} detail={policy.id === 'early-and-late' ? 'Provisional, on-time, and corrections' : 'On-time result and corrections'} icon={RadioTower} tone="violet" />
              </div>

              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{data.window.label}</p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Trace every event against the watermark</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Event time selects the window; watermark age determines lateness.</p>
                </div>

                <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {result.events.map((event) => (
                    <li key={event.id} className={`min-w-0 rounded-md border p-4 ${event.status === 'on-time' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : event.status === 'corrected' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase opacity-70">Event at +{event.eventSecond}s</p>
                          <h5 className="mt-1 break-words text-sm font-semibold">{event.label}</h5>
                        </div>
                        {event.status === 'on-time' ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" /> : event.status === 'corrected' ? <History aria-hidden="true" className="h-5 w-5 shrink-0" /> : <TimerOff aria-hidden="true" className="h-5 w-5 shrink-0" />}
                      </div>
                      <p className="mt-3 text-sm font-semibold tabular-nums">Value {event.value}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">
                        {event.watermarkAgeAtArrivalSeconds <= 0
                          ? `${Math.abs(event.watermarkAgeAtArrivalSeconds)}s before the watermark passed`
                          : `${event.watermarkAgeAtArrivalSeconds}s after the watermark passed`}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase opacity-75">
                        {event.status === 'on-time' ? 'Initial result' : event.status === 'corrected' ? 'Correction emitted' : 'State already expired'}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={`rounded-md border p-5 ${result.dropped.length === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
                <div className="flex items-start gap-3">
                  {result.dropped.length === 0 ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">Visible result</p>
                    <h4 className="mt-1 text-lg font-semibold">Committed total: {result.committedTotal}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">
                      {result.dropped.length === 0
                        ? 'Every sample event is represented, but retaining state longer can increase storage and delay cleanup.'
                        : `${result.dropped.length} event${result.dropped.length === 1 ? '' : 's'} arrived after the configured lateness horizon and cannot correct this window.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50">
                <p className="font-semibold">Accuracy and completeness are different</p>
                <p className="mt-1 text-sm leading-6 opacity-85">
                  Dataflow exactly-once mode can keep committed pipeline results free of duplicate effects, but it cannot make an event arrive before retained window state expires. Watermarks, allowed lateness, triggers, and sink semantics still define what users see.
                </p>
              </div>
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
        {error ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" /> : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-violet-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{error ? 'Windowing trace unavailable' : 'Loading event-time trace'}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{error ?? 'Preparing windows, watermarks, and late events.'}</p>
        {error ? <button type="button" onClick={onRetry} className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100">Retry</button> : null}
      </div>
    </div>
  );
}
