'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  History,
  ShieldCheck,
  TimerOff,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/feature-engineering/data/point-in-time-join-lab.json';

type Policy = {
  id: 'latest-warehouse' | 'event-time' | 'dual-time';
  label: string;
  detail: string;
};

type FeatureEvent = {
  id: string;
  eventTime: number;
  eventLabel: string;
  availableTime: number;
  availableLabel: string;
  value: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  feature: string;
  entity: string;
  predictionTime: number;
  predictionLabel: string;
  ttlMinutes: number;
  onlineValue: string;
  defaultValue: string;
  events: FeatureEvent[];
};

type LabData = {
  title: string;
  description: string;
  defaultScenario: string;
  defaultPolicy: Policy['id'];
  policies: Policy[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.defaultScenario === 'string' &&
      typeof data.defaultPolicy === 'string' &&
      Array.isArray(data.policies) &&
      data.policies.length > 0 &&
      Array.isArray(data.scenarios) &&
      data.scenarios.length > 0 &&
      data.scenarios.every(
        (scenario) =>
          typeof scenario.predictionTime === 'number' &&
          typeof scenario.ttlMinutes === 'number' &&
          Array.isArray(scenario.events) &&
          scenario.events.length > 0,
      ),
  );
}

function newest(rows: FeatureEvent[]) {
  return rows.reduce<FeatureEvent | null>(
    (current, row) => (!current || row.eventTime > current.eventTime ? row : current),
    null,
  );
}

function rowReason(event: FeatureEvent, scenario: Scenario, policy: Policy['id']) {
  if (policy === 'latest-warehouse') return 'The backfill can see this stored row.';
  if (event.eventTime > scenario.predictionTime) return 'The event happened after prediction.';
  if (policy === 'event-time') return 'The event happened by prediction time.';
  if (event.availableTime > scenario.predictionTime) {
    return 'The event had not reached the feature pipeline.';
  }
  if (scenario.predictionTime - event.eventTime > scenario.ttlMinutes) {
    return `The value is older than the ${scenario.ttlMinutes}-minute TTL.`;
  }
  return 'The event happened, arrived, and remained fresh before prediction.';
}

function Timeline({
  event,
  scenario,
}: {
  event: FeatureEvent;
  scenario: Scenario;
}) {
  const values = scenario.events.flatMap((item) => [item.eventTime, item.availableTime]);
  const minimum = Math.min(...values, scenario.predictionTime) - 10;
  const maximum = Math.max(...values, scenario.predictionTime) + 10;
  const position = (minute: number) =>
    `${Math.max(2, Math.min(98, ((minute - minimum) / (maximum - minimum)) * 100))}%`;

  return (
    <div
      className="relative mt-4 h-8 rounded-md bg-neutral-100 dark:bg-neutral-800"
      role="img"
      aria-label={`Event at ${event.eventLabel}, available at ${event.availableLabel}, prediction at ${scenario.predictionLabel}`}
    >
      <div className="absolute inset-x-2 top-1/2 h-px bg-neutral-300 dark:bg-neutral-600" />
      <span
        className="absolute inset-y-0 w-px bg-amber-500"
        style={{ left: position(scenario.predictionTime) }}
      />
      <span
        className="absolute top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-cyan-600 shadow-sm dark:border-neutral-950 dark:bg-cyan-400"
        style={{ left: position(event.eventTime) }}
      />
      <span
        className="absolute top-2 h-4 w-4 -translate-x-1/2 rotate-45 border-2 border-white bg-violet-600 shadow-sm dark:border-neutral-950 dark:bg-violet-400"
        style={{ left: position(event.availableTime) }}
      />
    </div>
  );
}

export default function FeatureEngineeringPointInTimeJoinLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('account-velocity');
  const [policyId, setPolicyId] = useState<Policy['id']>('dual-time');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load join data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) {
          throw new Error('The point-in-time data does not match the expected contract.');
        }
        setData(value);
        setScenarioId(value.defaultScenario);
        setPolicyId(value.defaultPolicy);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load join data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const selected =
      policy.id === 'latest-warehouse'
        ? newest(scenario.events)
        : policy.id === 'event-time'
          ? newest(scenario.events.filter((event) => event.eventTime <= scenario.predictionTime))
          : newest(
              scenario.events.filter(
                (event) =>
                  event.eventTime <= scenario.predictionTime &&
                  event.availableTime <= scenario.predictionTime &&
                  scenario.predictionTime - event.eventTime <= scenario.ttlMinutes,
              ),
            );
    const joinedValue = selected?.value ?? scenario.defaultValue;
    const futureLeak = Boolean(selected && selected.eventTime > scenario.predictionTime);
    const lateArrival = Boolean(selected && selected.availableTime > scenario.predictionTime);
    const parity = joinedValue === scenario.onlineValue && !futureLeak && !lateArrival;
    const age = selected ? scenario.predictionTime - selected.eventTime : null;
    const verdict = futureLeak
      ? 'Future event leaked into training'
      : lateArrival
        ? 'Late data creates training-serving skew'
        : parity
          ? selected
            ? 'Historical and online values agree'
            : 'Freshness policy uses the safe default'
          : 'Join result differs from online behavior';
    return { scenario, policy, selected, joinedValue, futureLeak, lateArrival, parity, age, verdict };
  }, [data, policyId, scenarioId]);

  const reset = () => {
    if (!data) return;
    setScenarioId(data.defaultScenario);
    setPolicyId(data.defaultPolicy);
  };

  if (error) {
    return (
      <div
        data-content-block="ml-systems/feature-engineering-point-in-time-join-lab"
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block="ml-systems/feature-engineering-point-in-time-join-lab"
        className="not-prose my-7 h-80 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading point-in-time join lab"
      />
    );
  }

  return (
    <div data-content-block="ml-systems/feature-engineering-point-in-time-join-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Point-in-time join debugger"
          title={data.title}
          description={data.description}
          icon={History}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a prediction trace
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={scenario.id === result.scenario.id}
                      label={scenario.label}
                      detail={`${scenario.entity} at ${scenario.predictionLabel}`}
                      icon={Database}
                      accent="cyan"
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the historical join
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={policy.id === result.policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'dual-time' ? ShieldCheck : Clock3}
                      accent={policy.id === 'dual-time' ? 'emerald' : 'amber'}
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Join verdict
                </p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {result.verdict}
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  result.parity
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                }`}
              >
                {result.parity ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                )}
                {result.parity ? 'Point-in-time correct' : 'Offline-online mismatch'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Prediction boundary"
                value={result.scenario.predictionLabel}
                detail={`${result.scenario.entity}, ${result.scenario.feature}`}
                icon={Clock3}
                tone="cyan"
              />
              <LabMetric
                label="Historical value"
                value={result.joinedValue}
                detail={result.selected ? `From event ${result.selected.eventLabel}.` : 'No eligible row; use default.'}
                icon={Database}
                tone={result.parity ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Online value"
                value={result.scenario.onlineValue}
                detail="Value the serving path could produce then."
                icon={ShieldCheck}
                tone="violet"
              />
              <LabMetric
                label="Selected age"
                value={result.age === null ? 'No row' : `${result.age} min`}
                detail={`TTL is ${result.scenario.ttlMinutes} minutes.`}
                icon={TimerOff}
                tone={result.age !== null && result.age > result.scenario.ttlMinutes ? 'rose' : 'amber'}
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Two-clock event ledger
                  </p>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Circle: event time. Diamond: availability time. Amber line: prediction.
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Prediction {result.scenario.predictionLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {result.scenario.events.map((event) => {
                  const selected = event.id === result.selected?.id;
                  const eventAfter = event.eventTime > result.scenario.predictionTime;
                  const arrivalAfter = event.availableTime > result.scenario.predictionTime;
                  return (
                    <div
                      key={event.id}
                      className={`rounded-md border bg-white p-4 dark:bg-neutral-950 ${
                        selected
                          ? result.parity
                            ? 'border-emerald-400 ring-1 ring-emerald-400 dark:border-emerald-700'
                            : 'border-rose-400 ring-1 ring-rose-400 dark:border-rose-700'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {event.value}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                            {event.detail}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-md px-2 py-1 text-xs font-semibold ${
                            selected
                              ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}
                        >
                          {selected ? 'Selected by policy' : 'Not selected'}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className={eventAfter ? 'text-rose-700 dark:text-rose-300' : 'text-cyan-700 dark:text-cyan-300'}>
                          Event {event.eventLabel} {eventAfter ? '(after prediction)' : '(before prediction)'}
                        </div>
                        <div className={arrivalAfter ? 'text-rose-700 dark:text-rose-300' : 'text-violet-700 dark:text-violet-300'}>
                          Available {event.availableLabel} {arrivalAfter ? '(after prediction)' : '(before prediction)'}
                        </div>
                      </div>
                      <Timeline event={event} scenario={result.scenario} />
                      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                        {rowReason(event, result.scenario, result.policy.id)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={`mt-5 rounded-md border p-4 ${
                result.parity
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Why this policy {result.parity ? 'works' : 'fails'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {result.futureLeak
                  ? `The selected ${result.selected?.eventLabel} event occurred after the ${result.scenario.predictionLabel} prediction. A later backfill can see information the original request could not.`
                  : result.lateArrival
                    ? `The event occurred in time, but it did not become available until ${result.selected?.availableLabel}. The historical row would be richer than the online request.`
                    : result.selected
                      ? `The ${result.selected.eventLabel} event was available by ${result.selected.availableLabel} and remained inside the ${result.scenario.ttlMinutes}-minute freshness window.`
                      : `No row satisfies both time boundaries and the ${result.scenario.ttlMinutes}-minute TTL, so the historical path uses the same ${result.scenario.defaultValue} fallback as serving.`}
              </p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
