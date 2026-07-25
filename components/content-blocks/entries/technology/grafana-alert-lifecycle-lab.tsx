'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  EyeOff,
  Radio,
  TimerReset,
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
type Scenario = {
  id: string;
  label: string;
  detail: string;
  values: Array<number | null>;
};
type NoDataPolicy = {
  id: string;
  label: string;
  detail: string;
};
type AlertData = {
  title: string;
  description: string;
  evaluationIntervalSeconds: number;
  alertThreshold: number;
  defaults: {
    scenarioId: string;
    pendingIntervals: number;
    recoveryThreshold: number;
    keepFiringIntervals: number;
    noDataPolicy: string;
  };
  bounds: {
    pendingIntervals: Bound;
    recoveryThreshold: Bound;
    keepFiringIntervals: Bound;
  };
  scenarios: Scenario[];
  noDataPolicies: NoDataPolicy[];
};
type AlertState = 'normal' | 'pending' | 'alerting' | 'recovering' | 'no-data';
type TimelineItem = {
  index: number;
  state: AlertState;
  value: number | null;
  reason: string;
  keptLastState: boolean;
};

const BLOCK_ID = 'technology/grafana-alert-lifecycle-lab';

const statePresentation: Record<AlertState, {
  label: string;
  card: string;
  strip: string;
  text: string;
}> = {
  normal: {
    label: 'Normal',
    card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35',
    strip: 'bg-emerald-500',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
  pending: {
    label: 'Pending',
    card: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35',
    strip: 'bg-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
  },
  alerting: {
    label: 'Alerting',
    card: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35',
    strip: 'bg-rose-500',
    text: 'text-rose-800 dark:text-rose-200',
  },
  recovering: {
    label: 'Recovering',
    card: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35',
    strip: 'bg-violet-500',
    text: 'text-violet-800 dark:text-violet-200',
  },
  'no-data': {
    label: 'No Data',
    card: 'border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900',
    strip: 'bg-neutral-500',
    text: 'text-neutral-800 dark:text-neutral-200',
  },
};

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isAlertData(value: unknown): value is AlertData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AlertData>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.evaluationIntervalSeconds === 'number'
      && typeof candidate.alertThreshold === 'number'
      && candidate.defaults?.scenarioId
      && typeof candidate.defaults.pendingIntervals === 'number'
      && typeof candidate.defaults.recoveryThreshold === 'number'
      && typeof candidate.defaults.keepFiringIntervals === 'number'
      && candidate.defaults.noDataPolicy
      && isBound(candidate.bounds?.pendingIntervals)
      && isBound(candidate.bounds?.recoveryThreshold)
      && isBound(candidate.bounds?.keepFiringIntervals)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.noDataPolicies)
      && candidate.noDataPolicies.length > 0,
  );
}

function intervalLabel(count: number, intervalSeconds: number) {
  if (count === 0) return 'Immediate';
  const seconds = count * intervalSeconds;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

export default function GrafanaAlertLifecycleLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<AlertData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No alert lifecycle model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isAlertData(payload)) throw new Error('The alert lifecycle model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the alert lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <AlertLifecycleLab data={data} />;
}

function AlertLifecycleLab({ data }: { data: AlertData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [pendingIntervals, setPendingIntervals] = useState<number>(
    data.defaults.pendingIntervals,
  );
  const [recoveryThreshold, setRecoveryThreshold] = useState<number>(
    data.defaults.recoveryThreshold,
  );
  const [keepFiringIntervals, setKeepFiringIntervals] = useState<number>(
    data.defaults.keepFiringIntervals,
  );
  const [noDataPolicyId, setNoDataPolicyId] = useState(data.defaults.noDataPolicy);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const noDataPolicy = data.noDataPolicies.find((item) => item.id === noDataPolicyId)
    ?? data.noDataPolicies[0];
  const timeline = useMemo(
    () => simulateTimeline({
      alertThreshold: data.alertThreshold,
      keepFiringIntervals,
      noDataPolicyId: noDataPolicy.id,
      pendingIntervals,
      recoveryThreshold,
      values: scenario.values,
    }),
    [
      data.alertThreshold,
      keepFiringIntervals,
      noDataPolicy.id,
      pendingIntervals,
      recoveryThreshold,
      scenario.values,
    ],
  );
  const selected = timeline[Math.min(selectedIndex, timeline.length - 1)];
  const last = timeline[timeline.length - 1];
  const firstAction = timeline.find(
    (item) => item.state === 'alerting' || item.state === 'no-data',
  );
  const actionTransitions = timeline.reduce((count, item, index) => {
    const previous = index > 0 ? timeline[index - 1].state : 'normal';
    return count + (
      item.state !== previous && (item.state === 'alerting' || item.state === 'no-data')
        ? 1
        : 0
    );
  }, 0);
  const maxValue = Math.max(...scenario.values.filter((value): value is number => value !== null));

  function chooseScenario(id: string) {
    setScenarioId(id);
    setSelectedIndex(0);
  }

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setPendingIntervals(data.defaults.pendingIntervals);
    setRecoveryThreshold(data.defaults.recoveryThreshold);
    setKeepFiringIntervals(data.defaults.keepFiringIntervals);
    setNoDataPolicyId(data.defaults.noDataPolicy);
    setSelectedIndex(0);
  }

  const selectedStyle = statePresentation[selected.state];

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Alert state machine lab"
          title={data.title}
          description={data.description}
          icon={BellRing}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Signal pattern
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Radio}
                      accent={item.id === 'telemetry-gap' ? 'violet' : 'amber'}
                      onClick={() => chooseScenario(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Pending period"
                value={pendingIntervals}
                output={intervalLabel(pendingIntervals, data.evaluationIntervalSeconds)}
                {...data.bounds.pendingIntervals}
                accent="amber"
                lowLabel="fire immediately"
                highLabel="require persistence"
                onChange={setPendingIntervals}
              />
              <LabRange
                label="Recovery threshold"
                value={recoveryThreshold}
                output={`${recoveryThreshold}ms`}
                {...data.bounds.recoveryThreshold}
                accent="emerald"
                lowLabel="strong recovery"
                highLabel="near firing line"
                onChange={setRecoveryThreshold}
              />
              <LabRange
                label="Keep firing for"
                value={keepFiringIntervals}
                output={intervalLabel(keepFiringIntervals, data.evaluationIntervalSeconds)}
                {...data.bounds.keepFiringIntervals}
                accent="violet"
                lowLabel="resolve now"
                highLabel="delay resolution"
                onChange={setKeepFiringIntervals}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Missing-data policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.noDataPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === noDataPolicy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={EyeOff}
                      accent="violet"
                      onClick={() => setNoDataPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Final state"
                value={statePresentation[last.state].label}
                detail="after the final modeled evaluation"
                icon={last.state === 'normal' ? CheckCircle2 : CircleAlert}
                tone={metricTone(last.state)}
              />
              <LabMetric
                label="First action state"
                value={firstAction ? `+${firstAction.index}m` : 'Never'}
                detail={firstAction ? statePresentation[firstAction.state].label : 'no firing or No Data state'}
                icon={Clock3}
                tone={firstAction ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Action transitions"
                value={actionTransitions.toString()}
                detail="entries into Alerting or No Data"
                icon={BellRing}
                tone={actionTransitions > 1 ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Peak value"
                value={`${maxValue}ms`}
                detail={`firing threshold ${data.alertThreshold}ms`}
                icon={Activity}
                tone={maxValue >= data.alertThreshold ? 'rose' : 'emerald'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-row sm:items-end sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evaluation timeline
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Select any result to inspect its transition
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  One cell = {data.evaluationIntervalSeconds / 60} minute
                </p>
              </div>

              <div className="overflow-x-auto p-4">
                <div className="flex min-w-max items-stretch gap-2">
                  {timeline.map((item) => {
                    const style = statePresentation[item.state];
                    const selectedItem = item.index === selected.index;
                    const valueHeight = item.value === null
                      ? 0
                      : Math.max(8, Math.min(100, item.value / (data.alertThreshold * 1.35) * 100));

                    return (
                      <button
                        key={item.index}
                        type="button"
                        aria-pressed={selectedItem}
                        onClick={() => setSelectedIndex(item.index)}
                        className={`relative flex h-44 w-28 shrink-0 flex-col overflow-hidden rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${style.card} ${
                          selectedItem ? 'ring-2 ring-neutral-950 dark:ring-white' : 'hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
                        }`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-1 ${style.strip}`} />
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                          +{item.index}m
                        </span>
                        <span className="mt-1 text-base font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {item.value === null ? 'No points' : `${item.value}ms`}
                        </span>
                        <span className="mt-3 flex flex-1 items-end rounded-sm bg-white/70 px-2 pt-2 dark:bg-neutral-950/50">
                          {item.value === null ? (
                            <EyeOff aria-hidden="true" className="mb-3 h-5 w-5 text-neutral-500" />
                          ) : (
                            <span
                              className={`w-full rounded-t-sm ${item.value >= data.alertThreshold ? 'bg-rose-400' : item.value < recoveryThreshold ? 'bg-emerald-400' : 'bg-amber-400'}`}
                              style={{ height: `${valueHeight}%` }}
                            />
                          )}
                        </span>
                        <span className={`mt-2 text-xs font-semibold ${style.text}`}>
                          {style.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={`rounded-md border p-5 ${selectedStyle.card}`}>
              <div className="flex items-start gap-3">
                {selected.state === 'normal' ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${selectedStyle.text}`}
                  />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${selectedStyle.text}`}
                  />
                )}
                <div>
                  <p className={`text-xs font-semibold uppercase ${selectedStyle.text}`}>
                    Evaluation +{selected.index}m · {selectedStyle.label}
                    {selected.keptLastState ? ' · state held' : ''}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {selected.value === null
                      ? 'The query succeeded but returned no points'
                      : `${selected.value}ms evaluated against ${data.alertThreshold}ms firing and ${recoveryThreshold}ms recovery thresholds`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {selected.reason}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                <TimerReset aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Discrete teaching model
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    A pending value of {intervalLabel(pendingIntervals, data.evaluationIntervalSeconds)}
                    {' '}waits that many complete evaluation intervals after the first breach.
                    Keep-firing uses the same rule after recovery. Scheduler timing, delayed
                    data, retries, labels, and notification grouping remain production concerns.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function simulateTimeline({
  alertThreshold,
  keepFiringIntervals,
  noDataPolicyId,
  pendingIntervals,
  recoveryThreshold,
  values,
}: {
  alertThreshold: number;
  keepFiringIntervals: number;
  noDataPolicyId: string;
  pendingIntervals: number;
  recoveryThreshold: number;
  values: Array<number | null>;
}): TimelineItem[] {
  let state: AlertState = 'normal';
  let breachRun = 0;
  let missingRun = 0;
  let recoveryRun = 0;

  return values.map((value, index) => {
    let reason = '';
    let keptLastState = false;

    if (value === null) {
      breachRun = 0;
      recoveryRun = 0;
      missingRun += 1;

      if (noDataPolicyId === 'keep-last') {
        keptLastState = true;
        reason = `Keep Last State preserves ${statePresentation[state].label}. A separate telemetry-availability rule is still required to detect a prolonged blind spot.`;
      } else if (pendingIntervals === 0 || missingRun > pendingIntervals) {
        state = 'no-data';
        reason = 'The successful query has returned no points for the configured pending period. The model now creates the distinct No Data state.';
      } else {
        state = 'pending';
        reason = `No data has persisted for ${missingRun} evaluation result${missingRun === 1 ? '' : 's'}; the pending period has not elapsed yet.`;
      }
    } else if (value >= alertThreshold) {
      missingRun = 0;
      recoveryRun = 0;

      if (state === 'alerting' || state === 'recovering') {
        state = 'alerting';
        breachRun = 0;
        reason = 'The value is at or above the firing threshold, so an already active instance remains Alerting.';
      } else {
        breachRun += 1;
        if (pendingIntervals === 0 || breachRun > pendingIntervals) {
          state = 'alerting';
          reason = 'The breach has persisted through the pending period, so the instance enters Alerting.';
        } else {
          state = 'pending';
          reason = `The firing condition is true, but only ${breachRun - 1} complete evaluation interval${breachRun === 2 ? '' : 's'} ha${breachRun === 2 ? 's' : 've'} elapsed since the first breach.`;
        }
      }
    } else if (value < recoveryThreshold) {
      missingRun = 0;
      breachRun = 0;

      if (state === 'alerting' || state === 'recovering') {
        recoveryRun += 1;
        if (keepFiringIntervals === 0 || recoveryRun > keepFiringIntervals) {
          state = 'normal';
          reason = 'The value is below the recovery threshold and the keep-firing period has elapsed, so the instance resolves to Normal.';
        } else {
          state = 'recovering';
          reason = 'The recovery condition is true, but Keep firing for intentionally delays resolution.';
        }
      } else {
        state = 'normal';
        recoveryRun = 0;
        reason = 'The value is below the recovery threshold, so the instance is Normal.';
      }
    } else {
      missingRun = 0;
      breachRun = 0;
      recoveryRun = 0;

      if (state === 'alerting' || state === 'recovering') {
        state = 'alerting';
        reason = 'The value is below the firing threshold but has not crossed the lower recovery threshold, so hysteresis keeps the instance Alerting.';
      } else {
        state = 'normal';
        reason = 'The value does not breach the firing threshold. Without an active alert to recover, the instance remains Normal.';
      }
    }

    return { index, keptLastState, reason, state, value };
  });
}

function metricTone(state: AlertState): 'emerald' | 'amber' | 'rose' | 'violet' | 'neutral' {
  if (state === 'normal') return 'emerald';
  if (state === 'pending') return 'amber';
  if (state === 'alerting') return 'rose';
  if (state === 'recovering') return 'violet';
  return 'neutral';
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-[320px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading Grafana alert lifecycle lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
    >
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Alert lifecycle lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
