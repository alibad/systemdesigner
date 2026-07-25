'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Network,
  ShieldCheck,
  TimerReset,
  WifiOff,
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
type CheckType = { id: string; label: string; detail: string; evidence: string };
type Scenario = {
  id: string;
  label: string;
  detail: string;
  unsafeChecks: number[];
  failedChecksByType: Record<string, number[]>;
};
type HealthModel = {
  checkCount: number;
  defaults: {
    checkType: string;
    scenario: string;
    intervalSeconds: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  bounds: {
    intervalSeconds: Bound;
    unhealthyThreshold: Bound;
    healthyThreshold: Bound;
  };
  checkTypes: CheckType[];
  scenarios: Scenario[];
};

type CheckEvent = {
  index: number;
  passed: boolean;
  unsafe: boolean;
  eligibleBefore: boolean;
  eligibleAfter: boolean;
  transition: 'ejected' | 'restored' | null;
};

function simulateChecks(
  count: number,
  scenario: Scenario,
  checkTypeId: string,
  unhealthyThreshold: number,
  healthyThreshold: number,
): CheckEvent[] {
  const failedChecks = new Set(scenario.failedChecksByType[checkTypeId] ?? []);
  const unsafeChecks = new Set(scenario.unsafeChecks);
  let eligible = true;
  let consecutiveFailures = 0;
  let consecutiveSuccesses = 0;

  return Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const passed = !failedChecks.has(index);
    const unsafe = unsafeChecks.has(index);
    const eligibleBefore = eligible;
    let transition: CheckEvent['transition'] = null;

    if (passed) {
      consecutiveSuccesses += 1;
      consecutiveFailures = 0;
      if (!eligible && consecutiveSuccesses >= healthyThreshold) {
        eligible = true;
        transition = 'restored';
      }
    } else {
      consecutiveFailures += 1;
      consecutiveSuccesses = 0;
      if (eligible && consecutiveFailures >= unhealthyThreshold) {
        eligible = false;
        transition = 'ejected';
      }
    }

    return { index, passed, unsafe, eligibleBefore, eligibleAfter: eligible, transition };
  });
}

export default function LoadBalancingHealthEjectionLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<HealthModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkTypeId, setCheckTypeId] = useState('shallow-http');
  const [scenarioId, setScenarioId] = useState('dependency-outage');
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [unhealthyThreshold, setUnhealthyThreshold] = useState(3);
  const [healthyThreshold, setHealthyThreshold] = useState(2);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The health ejection model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<HealthModel>;
      })
      .then((model) => {
        if (!model.checkTypes.length || !model.scenarios.length || model.checkCount < 1) {
          throw new Error('The health ejection model has no checks to simulate.');
        }
        setData(model);
        setCheckTypeId(model.defaults.checkType);
        setScenarioId(model.defaults.scenario);
        setIntervalSeconds(model.defaults.intervalSeconds);
        setUnhealthyThreshold(model.defaults.unhealthyThreshold);
        setHealthyThreshold(model.defaults.healthyThreshold);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the health model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const view = useMemo(() => {
    if (!data) return null;
    const checkType = data.checkTypes.find((item) => item.id === checkTypeId) ?? data.checkTypes[0];
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const events = simulateChecks(
      data.checkCount,
      scenario,
      checkType.id,
      unhealthyThreshold,
      healthyThreshold,
    );
    const ejected = events.find((event) => event.transition === 'ejected') ?? null;
    const restored = events.find((event) => event.transition === 'restored') ?? null;
    const unsafeExposureIntervals = events.filter(
      (event) => event.unsafe && event.eligibleBefore,
    ).length;
    const unavailableIntervals = events.filter((event) => !event.eligibleAfter).length;
    const missedUnsafeFailure = scenario.unsafeChecks.length > 0 && !ejected;
    const falseEjection = scenario.unsafeChecks.length === 0 && Boolean(ejected);
    const sharedDependencyRisk =
      scenario.id === 'dependency-outage' && checkType.id === 'readiness';

    return {
      checkType,
      scenario,
      events,
      ejected,
      restored,
      unsafeExposureIntervals,
      unavailableIntervals,
      missedUnsafeFailure,
      falseEjection,
      sharedDependencyRisk,
    };
  }, [checkTypeId, data, healthyThreshold, scenarioId, unhealthyThreshold]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !view) return <LabLoading />;

  const reset = () => {
    setCheckTypeId(data.defaults.checkType);
    setScenarioId(data.defaults.scenario);
    setIntervalSeconds(data.defaults.intervalSeconds);
    setUnhealthyThreshold(data.defaults.unhealthyThreshold);
    setHealthyThreshold(data.defaults.healthyThreshold);
  };
  const warning = view.missedUnsafeFailure || view.falseEjection || view.sharedDependencyRisk;
  const consequence = view.missedUnsafeFailure
    ? `${view.checkType.label} does not observe this failure, so the backend remains eligible through ${view.scenario.unsafeChecks.length} unsafe intervals. Probe depth, passive errors, or application load shedding must close that blind spot.`
    : view.falseEjection
      ? `One noisy probe ejects a backend that is still safe to serve. The selected success threshold then suppresses traffic while the backend proves recovery.`
      : view.sharedDependencyRisk
        ? `This readiness signal detects the critical dependency failure, but every frontend that shares the dependency may fail the same check. Protect the fleet from simultaneous ejection or define deliberate fail-open and load-shedding behavior.`
        : view.scenario.unsafeChecks.length === 0
          ? `The threshold absorbs the single noisy result, so healthy capacity remains eligible. Keep enough sensitivity to detect sustained failures.`
          : `The probe detects the failure and ejects the backend after ${view.unsafeExposureIntervals} modeled unsafe intervals. Recovery waits for ${healthyThreshold} consecutive successful checks.`;

  return (
    <div data-content-block="reference/load-balancing-health-ejection-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Health state and failure injection lab"
          title="Tune how evidence changes eligibility"
          description="Inject a backend failure, choose what the probe can observe, and change the consecutive failure and success thresholds. The timeline separates actual service safety from probe results."
          icon={HeartPulse}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Probe depth
                </legend>
                <div className="mt-3 space-y-2">
                  {data.checkTypes.map((checkType) => (
                    <LabChoice
                      key={checkType.id}
                      selected={view.checkType.id === checkType.id}
                      label={checkType.label}
                      detail={checkType.detail}
                      icon={checkType.id === 'tcp' ? Network : checkType.id === 'readiness' ? ShieldCheck : Activity}
                      accent={checkType.id === 'readiness' ? 'violet' : checkType.id === 'tcp' ? 'blue' : 'cyan'}
                      onClick={() => setCheckTypeId(checkType.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label htmlFor="load-balancing-failure-scenario" className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Injected scenario
                </span>
                <select
                  id="load-balancing-failure-scenario"
                  value={view.scenario.id}
                  onChange={(event) => setScenarioId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus-visible:border-rose-500 focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {view.scenario.detail}
                </span>
              </label>

              <LabRange
                label="Check interval"
                value={intervalSeconds}
                output={`${intervalSeconds} sec`}
                {...data.bounds.intervalSeconds}
                accent="blue"
                lowLabel="faster evidence"
                highLabel="lower probe load"
                onChange={setIntervalSeconds}
              />
              <LabRange
                label="Failures to eject"
                value={unhealthyThreshold}
                output={`${unhealthyThreshold} consecutive`}
                {...data.bounds.unhealthyThreshold}
                accent="rose"
                lowLabel="sensitive"
                highLabel="noise tolerant"
                onChange={setUnhealthyThreshold}
              />
              <LabRange
                label="Successes to restore"
                value={healthyThreshold}
                output={`${healthyThreshold} consecutive`}
                {...data.bounds.healthyThreshold}
                accent="emerald"
                lowLabel="fast re-entry"
                highLabel="stable re-entry"
                onChange={setHealthyThreshold}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Probe evidence"
                value={view.checkType.label}
                detail={view.checkType.evidence}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Threshold window"
                value={view.missedUnsafeFailure ? 'No failure signal' : `${intervalSeconds * unhealthyThreshold} sec`}
                detail={view.missedUnsafeFailure ? 'The selected probe never starts the failure counter.' : 'Interval x failure threshold in this bounded model; product timeouts and propagation can add delay.'}
                icon={Clock3}
                tone={warning ? 'amber' : 'violet'}
              />
              <LabMetric
                label="Unsafe traffic exposure"
                value={`${view.unsafeExposureIntervals * intervalSeconds} sec`}
                detail={`${view.unsafeExposureIntervals} unsafe interval${view.unsafeExposureIntervals === 1 ? '' : 's'} while routing was still eligible.`}
                icon={view.unsafeExposureIntervals ? WifiOff : CheckCircle2}
                tone={view.unsafeExposureIntervals ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Traffic suppressed"
                value={`${view.unavailableIntervals * intervalSeconds} sec`}
                detail={view.restored ? `Restored at check ${view.restored.index}.` : view.ejected ? 'Not restored inside the timeline.' : 'The backend was never ejected.'}
                icon={TimerReset}
                tone={view.falseEjection ? 'rose' : view.ejected ? 'amber' : 'emerald'}
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Probe and routing timeline
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Each column represents one {intervalSeconds}-second observation interval. "Unsafe" describes the real request path; pass or fail describes only the selected probe.
                </p>
              </header>
              <div className="grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-5 dark:bg-neutral-800">
                {view.events.map((event) => (
                  <CheckTile key={event.index} event={event} />
                ))}
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-5 ${
                warning || view.unsafeExposureIntervals > 0
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {warning || view.unsafeExposureIntervals > 0 ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">Decision consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function CheckTile({ event }: { event: CheckEvent }) {
  const tone = event.transition === 'ejected'
    ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40'
    : event.transition === 'restored'
      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
      : event.unsafe
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
        : 'border-transparent bg-white dark:bg-neutral-950';

  return (
    <div className={`min-w-0 border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Check {event.index}
        </span>
        {event.passed ? (
          <CheckCircle2 aria-label="Probe passed" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <WifiOff aria-label="Probe failed" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
        {event.passed ? 'Probe pass' : 'Probe fail'}
      </p>
      <p className={`mt-1 text-xs font-medium ${event.unsafe ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
        Service: {event.unsafe ? 'unsafe' : 'safe'}
      </p>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
        Routing: {event.eligibleAfter ? 'eligible' : 'ejected'}
      </p>
      {event.transition ? (
        <p className="mt-2 text-xs font-semibold uppercase text-neutral-900 dark:text-white">
          {event.transition}
        </p>
      ) : null}
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block="reference/load-balancing-health-ejection-lab">
      <div className="min-h-[760px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading health ejection lab" />
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block="reference/load-balancing-health-ejection-lab" role="alert" className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <p className="font-semibold">Health ejection lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
