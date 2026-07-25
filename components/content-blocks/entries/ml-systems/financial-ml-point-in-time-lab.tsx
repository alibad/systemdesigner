'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/financial-ml/data/point-in-time-scenarios.json';
const BLOCK_ID = 'ml-systems/financial-ml-point-in-time-lab';

type JoinMode = 'point-in-time' | 'current-state';

type Feature = {
  id: string;
  label: string;
  eventTime: string;
  availableTime: string;
  availableOffsetHours: number;
  explanation: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  decisionTime: string;
  targetLabel: string;
  labelHorizonDays: number;
  features: Feature[];
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    joinMode: JoinMode;
    validationGapDays: number;
  };
  gapRange: { min: number; max: number; step: number };
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && (data.defaults.joinMode === 'point-in-time' || data.defaults.joinMode === 'current-state')
      && typeof data.defaults.validationGapDays === 'number'
      && data.gapRange
      && typeof data.gapRange.min === 'number'
      && typeof data.gapRange.max === 'number'
      && typeof data.gapRange.step === 'number'
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.decisionTime === 'string'
        && typeof scenario.targetLabel === 'string'
        && typeof scenario.labelHorizonDays === 'number'
        && Array.isArray(scenario.features)
        && scenario.features.length >= 4
        && scenario.features.every((feature) => (
          typeof feature.id === 'string'
          && typeof feature.label === 'string'
          && typeof feature.availableOffsetHours === 'number'
        ))
      )),
  );
}

export default function FinancialMlPointInTimeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('fraud-authorization');
  const [joinMode, setJoinMode] = useState<JoinMode>('point-in-time');
  const [validationGapDays, setValidationGapDays] = useState(7);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Point-in-time scenario data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setJoinMode(payload.defaults.joinMode);
        setValidationGapDays(payload.defaults.validationGapDays);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];

  const result = useMemo(() => {
    if (!scenario) return null;
    const available = scenario.features.filter((feature) => feature.availableOffsetHours <= 0);
    const included = joinMode === 'point-in-time' ? available : scenario.features;
    const leaked = included.filter((feature) => feature.availableOffsetHours > 0);
    const gapCoversLabel = validationGapDays >= scenario.labelHorizonDays;
    const credible = leaked.length === 0 && gapCoversLabel;

    return {
      available,
      credible,
      gapCoversLabel,
      included,
      leaked,
    };
  }, [joinMode, scenario, validationGapDays]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setJoinMode(data.defaults.joinMode);
    setValidationGapDays(data.defaults.validationGapDays);
  }

  if (!data || !scenario || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'h-96 animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading point-in-time lab'}
      >
        {error}
      </div>
    );
  }

  const status = result.credible
    ? {
        label: 'Temporal contract intact',
        detail: 'Every selected feature existed at decision time, and the validation gap covers the label window.',
        tone: 'emerald' as const,
        icon: CheckCircle2,
      }
    : {
        label: 'Backtest evidence is contaminated',
        detail: result.leaked.length > 0
          ? 'The feature view includes information published after the decision. Offline performance cannot support release.'
          : `The ${validationGapDays}-day gap is shorter than the ${scenario.labelHorizonDays}-day label window, so adjacent folds can share outcome information.`,
        tone: 'rose' as const,
        icon: TriangleAlert,
      };
  const StatusIcon = status.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Point-in-time workbench"
          title={data.title}
          description={data.description}
          icon={CalendarClock}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the financial decision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Clock3}
                      accent="cyan"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the feature join
                </legend>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={joinMode === 'point-in-time'}
                    label="As-of snapshot"
                    detail="Include only values available at or before the decision."
                    icon={ShieldCheck}
                    accent="emerald"
                    onClick={() => setJoinMode('point-in-time')}
                  />
                  <LabChoice
                    selected={joinMode === 'current-state'}
                    label="Latest-state join"
                    detail="Join the newest stored value, even when it arrived later."
                    icon={Database}
                    accent="rose"
                    onClick={() => setJoinMode('current-state')}
                  />
                </div>
              </fieldset>

              <LabRange
                label="3. Train-test gap"
                value={validationGapDays}
                output={`${validationGapDays} days`}
                min={data.gapRange.min}
                max={data.gapRange.max}
                step={data.gapRange.step}
                accent="violet"
                lowLabel="Adjacent folds"
                highLabel="Separated folds"
                onChange={setValidationGapDays}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-4 ${
              result.credible
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{status.label}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{status.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Available at decision"
                value={`${result.available.length}/${scenario.features.length}`}
                detail={scenario.decisionTime}
                icon={Clock3}
                tone="cyan"
              />
              <LabMetric
                label="Future fields included"
                value={String(result.leaked.length)}
                detail={result.leaked.length === 0 ? 'No look-ahead fields' : 'Remove before evaluation'}
                icon={TriangleAlert}
                tone={result.leaked.length === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Label horizon"
                value={`${scenario.labelHorizonDays} days`}
                detail={scenario.targetLabel}
                icon={CalendarClock}
                tone="violet"
              />
              <LabMetric
                label="Fold separation"
                value={result.gapCoversLabel ? 'Covered' : 'Too short'}
                detail={`${validationGapDays}-day validation gap`}
                icon={ShieldCheck}
                tone={result.gapCoversLabel ? 'emerald' : 'amber'}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evidence available to the decision
                  </p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Inclusion changes with the join policy; eligibility never changes after the fact.
                  </p>
                </div>
                <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                  Decision boundary: T0
                </span>
              </div>

              <div className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {scenario.features.map((feature) => {
                  const included = result.included.some((item) => item.id === feature.id);
                  const future = feature.availableOffsetHours > 0;
                  return (
                    <div
                      key={feature.id}
                      className={`grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] ${
                        included ? 'bg-white dark:bg-neutral-950' : 'bg-neutral-50 opacity-65 dark:bg-neutral-900'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-neutral-950 dark:text-white">{feature.label}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            future
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          }`}>
                            {future ? 'Arrives after T0' : 'Available by T0'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                          {feature.explanation}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 text-xs sm:text-right">
                        <div>
                          <dt className="text-neutral-500 dark:text-neutral-400">Event</dt>
                          <dd className="mt-1 font-semibold text-neutral-800 dark:text-neutral-100">{feature.eventTime}</dd>
                        </div>
                        <div>
                          <dt className="text-neutral-500 dark:text-neutral-400">Available</dt>
                          <dd className="mt-1 font-semibold text-neutral-800 dark:text-neutral-100">{feature.availableTime}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
