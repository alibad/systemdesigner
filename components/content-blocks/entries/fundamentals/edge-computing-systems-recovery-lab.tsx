'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Database,
  GitMerge,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  Upload,
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
type RecoveryScenario = {
  id: string;
  label: string;
  detail: string;
  eventRatePerSecond: number;
  conflictRatePercent: number;
  replayRatePerSecond: number;
  localAuthority: string;
  operatorNote: string;
};
type RecoveryPolicy = {
  id: string;
  label: string;
  detail: string;
  unresolvedPercent: number;
  dataLossPercent: number;
  deduplicates: boolean;
  risk: string;
};
type RecoveryModel = {
  eventBytes: number;
  retryPercent: number;
  defaults: {
    scenarioId: string;
    policyId: string;
    outageMinutes: number;
    bufferCapacityMb: number;
  };
  bounds: {
    outageMinutes: Bound;
    bufferCapacityMb: Bound;
  };
  scenarios: RecoveryScenario[];
  policies: RecoveryPolicy[];
};

const BLOCK_ID = 'fundamentals/edge-computing-systems-recovery-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/edge-computing-systems/data/offline-recovery-model.json';

function isRecoveryModel(value: unknown): value is RecoveryModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<RecoveryModel>;
  return Boolean(
    model.eventBytes
      && model.defaults?.scenarioId
      && model.defaults?.policyId
      && model.bounds?.outageMinutes
      && model.bounds?.bufferCapacityMb
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 2
      && Array.isArray(model.policies)
      && model.policies.length >= 2,
  );
}

function formatEvents(value: number) {
  return new Intl.NumberFormat('en-US', { notation: value >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  return `${Math.ceil(seconds / 60)} min`;
}

function scenarioIcon(scenarioId: string) {
  if (scenarioId === 'wan-outage') return CloudOff;
  if (scenarioId === 'store-partition') return Database;
  return RotateCcw;
}

export default function EdgeComputingSystemsRecoveryLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RecoveryModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [outageMinutes, setOutageMinutes] = useState(45);
  const [bufferCapacityMb, setBufferCapacityMb] = useState(256);

  function reset(model: RecoveryModel) {
    setScenarioId(model.defaults.scenarioId);
    setPolicyId(model.defaults.policyId);
    setOutageMinutes(model.defaults.outageMinutes);
    setBufferCapacityMb(model.defaults.bufferCapacityMb);
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
        if (!isRecoveryModel(payload)) throw new Error('The offline recovery model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load recovery data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((candidate) => candidate.id === scenarioId) ?? data.scenarios[0];
    const policy = data.policies.find((candidate) => candidate.id === policyId) ?? data.policies[0];
    const generatedEvents = scenario.eventRatePerSecond * outageMinutes * 60;
    const capacityEvents = Math.floor(bufferCapacityMb * 1_000_000 / data.eventBytes);
    const retainedEvents = Math.min(generatedEvents, capacityEvents);
    const droppedEvents = generatedEvents - retainedEvents;
    const backlogMb = retainedEvents * data.eventBytes / 1_000_000;
    const bufferFillPercent = generatedEvents === 0 ? 0 : Math.min(100, backlogMb / bufferCapacityMb * 100);
    const conflictEvents = Math.round(retainedEvents * scenario.conflictRatePercent / 100);
    const unresolvedEvents = Math.round(conflictEvents * policy.unresolvedPercent / 100);
    const policyLostEvents = Math.round(conflictEvents * policy.dataLossPercent / 100);
    const retryEvents = Math.round(retainedEvents * data.retryPercent / 100);
    const duplicateEffects = policy.deduplicates ? 0 : retryEvents;
    const replaySeconds = retainedEvents / scenario.replayRatePerSecond;

    let status = 'Deterministic recovery';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The local log fits, retries are deduplicated, and the selected policy resolves the modeled conflicts.';

    if (droppedEvents > 0) {
      status = 'Local buffer overflows';
      tone = 'rose';
      verdict = `${formatEvents(droppedEvents)} events are lost before the link returns. Increase retention, reduce local volume, or define a safe shedding rule.`;
    } else if (duplicateEffects > 0) {
      status = 'Retries repeat business effects';
      tone = 'rose';
      verdict = `${formatEvents(duplicateEffects)} retried events become additional effects because replay has no stable idempotency key.`;
    } else if (policyLostEvents > 0) {
      status = 'Local intent is erased';
      tone = 'rose';
      verdict = `${formatEvents(policyLostEvents)} conflicting local events are discarded even though users may already have observed their effects.`;
    } else if (unresolvedEvents > 0) {
      status = 'Conflicts await a decision';
      tone = 'amber';
      verdict = `${formatEvents(unresolvedEvents)} events remain quarantined after automatic replay. The evidence is preserved, but the workflow needs an owner and deadline.`;
    }

    return {
      scenario,
      policy,
      generatedEvents,
      retainedEvents,
      droppedEvents,
      backlogMb,
      bufferFillPercent,
      conflictEvents,
      unresolvedEvents,
      policyLostEvents,
      retryEvents,
      duplicateEffects,
      replaySeconds,
      status,
      tone,
      verdict,
    };
  }, [bufferCapacityMb, data, outageMinutes, policyId, scenarioId]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Disconnected recovery lab"
          title="Let the edge keep working without hiding the reconciliation bill"
          description="Inject an outage, size the durable local buffer, and choose a conflict policy. The trace separates local autonomy, safe replay, duplicate suppression, and business reconciliation."
          icon={CloudOff}
          accent="amber"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Recovery data could not be loaded</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-amber-500 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading recovery model...</p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure to inject</legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((scenario) => (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === view.scenario.id}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={scenarioIcon(scenario.id)}
                        accent="amber"
                        onClick={() => setScenarioId(scenario.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Disconnected duration"
                  value={outageMinutes}
                  output={`${outageMinutes} min`}
                  {...data.bounds.outageMinutes}
                  accent="amber"
                  lowLabel="brief flap"
                  highLabel="extended isolation"
                  onChange={setOutageMinutes}
                />
                <LabRange
                  label="Durable local buffer"
                  value={bufferCapacityMb}
                  output={`${bufferCapacityMb} MB`}
                  {...data.bounds.bufferCapacityMb}
                  accent="blue"
                  lowLabel="small device"
                  highLabel="gateway storage"
                  onChange={setBufferCapacityMb}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Reconnect policy</legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((policy) => (
                      <LabChoice
                        key={policy.id}
                        selected={policy.id === view.policy.id}
                        label={policy.label}
                        detail={policy.detail}
                        icon={policy.id === 'blind-append' ? ShieldAlert : GitMerge}
                        accent={policy.id === 'blind-append' || policy.id === 'cloud-wins' ? 'rose' : policy.id === 'quarantine' ? 'amber' : 'emerald'}
                        onClick={() => setPolicyId(policy.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Events created offline"
                  value={formatEvents(view.generatedEvents)}
                  detail={`${view.scenario.eventRatePerSecond}/s for ${outageMinutes} minutes.`}
                  icon={Database}
                  tone="blue"
                />
                <LabMetric
                  label="Buffer pressure"
                  value={`${view.bufferFillPercent.toFixed(0)}%`}
                  detail={`${view.backlogMb.toFixed(1)} MB retained of ${bufferCapacityMb} MB.`}
                  icon={HardDrive}
                  tone={view.droppedEvents > 0 ? 'rose' : view.bufferFillPercent > 80 ? 'amber' : 'emerald'}
                />
                <LabMetric
                  label="Replay drain time"
                  value={formatDuration(view.replaySeconds)}
                  detail={`At ${view.scenario.replayRatePerSecond}/s after connectivity returns.`}
                  icon={Upload}
                  tone={view.replaySeconds > 900 ? 'amber' : 'violet'}
                />
                <LabMetric
                  label="Conflict set"
                  value={formatEvents(view.conflictEvents)}
                  detail={`${view.unresolvedEvents} unresolved; ${view.policyLostEvents} discarded by policy.`}
                  icon={GitMerge}
                  tone={view.conflictEvents === 0 ? 'emerald' : view.unresolvedEvents > 0 ? 'amber' : 'violet'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Recovery trace</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Each stage owns a different guarantee; reconnect is not the same as recovery.</p>
                  </div>
                  <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    {view.scenario.localAuthority}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <TraceStep
                    number="1"
                    title="Persist locally"
                    detail={view.droppedEvents > 0 ? `${formatEvents(view.droppedEvents)} events exceed the buffer.` : `${formatEvents(view.retainedEvents)} events remain durable.`}
                    state={view.droppedEvents > 0 ? 'danger' : 'healthy'}
                  />
                  <TraceStep
                    number="2"
                    title="Reconnect and replay"
                    detail={`${formatEvents(view.retryEvents)} events may be retried after uncertain acknowledgements.`}
                    state="active"
                  />
                  <TraceStep
                    number="3"
                    title="Suppress duplicates"
                    detail={view.duplicateEffects > 0 ? `${formatEvents(view.duplicateEffects)} duplicate effects escape.` : 'Stable identities make retries idempotent.'}
                    state={view.duplicateEffects > 0 ? 'danger' : 'healthy'}
                  />
                  <TraceStep
                    number="4"
                    title="Resolve conflicts"
                    detail={view.unresolvedEvents > 0 ? `${formatEvents(view.unresolvedEvents)} await an explicit decision.` : view.policyLostEvents > 0 ? `${formatEvents(view.policyLostEvents)} local events are discarded.` : 'The modeled conflicts converge under the policy.'}
                    state={view.unresolvedEvents > 0 ? 'warning' : view.policyLostEvents > 0 ? 'danger' : 'healthy'}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    <span>Local retention consumed</span>
                    <span className="tabular-nums">{view.backlogMb.toFixed(1)} MB / {bufferCapacityMb} MB</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${view.droppedEvents > 0 ? 'bg-rose-500' : view.bufferFillPercent > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${view.bufferFillPercent}%` }}
                    />
                  </div>
                </div>
              </section>

              <section className={`mt-5 rounded-md border p-4 ${view.tone === 'rose' ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : view.tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}>
                <div className="flex items-start gap-3">
                  {view.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${view.tone === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{view.status}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{view.verdict}</p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{view.scenario.operatorNote} {view.policy.risk}</p>
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

function TraceStep({
  number,
  title,
  detail,
  state,
}: {
  number: string;
  title: string;
  detail: string;
  state: 'healthy' | 'active' | 'warning' | 'danger';
}) {
  const styles = {
    healthy: 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    active: 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    warning: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    danger: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
  };

  return (
    <div className={`min-h-32 rounded-md border p-3 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{number}</span>
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
