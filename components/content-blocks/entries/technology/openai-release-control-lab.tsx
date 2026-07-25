'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Gauge,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Route,
  ShieldCheck,
  TestTube2,
  TimerReset,
  Wrench,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type Change = { id: string; label: string; detail: string; requiredGateIds: string[] };
type Gate = { id: string; label: string; detail: string };
type Failure = {
  id: string;
  label: string;
  detail: string;
  retryable: boolean;
  duplicateActionRisk: boolean;
  signal: string;
  containment: string;
};
type ReleaseControlsData = {
  title: string;
  description: string;
  defaults: {
    changeId: string;
    failureId: string;
    canaryPercent: number;
    maxAttempts: number;
    completedGateIds: string[];
  };
  bounds: { canaryPercent: Bounds; maxAttempts: Bounds };
  changes: Change[];
  gates: Gate[];
  failures: Failure[];
};

const BLOCK_ID = 'technology/openai-release-control-lab';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bounds>;
  return isNumber(candidate.min) && isNumber(candidate.max) && isNumber(candidate.step);
}

function isReleaseControlsData(value: unknown): value is ReleaseControlsData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseControlsData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.changeId
      && candidate.defaults.failureId
      && isNumber(candidate.defaults.canaryPercent)
      && isNumber(candidate.defaults.maxAttempts)
      && isStringArray(candidate.defaults.completedGateIds)
      && isBounds(candidate.bounds?.canaryPercent)
      && isBounds(candidate.bounds.maxAttempts)
      && Array.isArray(candidate.changes)
      && candidate.changes.length > 0
      && candidate.changes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isStringArray(item.requiredGateIds)
      ))
      && Array.isArray(candidate.gates)
      && candidate.gates.length > 0
      && candidate.gates.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
      ))
      && Array.isArray(candidate.failures)
      && candidate.failures.length > 0
      && candidate.failures.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.retryable === 'boolean'
        && typeof item.duplicateActionRisk === 'boolean'
        && typeof item.signal === 'string'
        && typeof item.containment === 'string'
      )),
  );
}

export default function OpenAIReleaseControlLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseControlsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No release-control model was supplied.');
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
        if (!isReleaseControlsData(payload)) {
          throw new Error('The release-control model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the release lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ReleaseControlLab data={data} />;
}

function ReleaseControlLab({ data }: { data: ReleaseControlsData }) {
  const [changeId, setChangeId] = useState(data.defaults.changeId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [canaryPercent, setCanaryPercent] = useState(data.defaults.canaryPercent);
  const [maxAttempts, setMaxAttempts] = useState(data.defaults.maxAttempts);
  const [completedGateIds, setCompletedGateIds] = useState(
    () => new Set(data.defaults.completedGateIds),
  );

  const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];

  const result = useMemo(() => {
    const requiredGates = data.gates.filter((gate) => change.requiredGateIds.includes(gate.id));
    const missingGates = requiredGates.filter((gate) => !completedGateIds.has(gate.id));
    const passedGateCount = requiredGates.length - missingGates.length;
    const boundedCanary = canaryPercent <= 10;
    const observable = completedGateIds.has('observability');
    const rollbackReady = completedGateIds.has('rollback');
    const idempotent = completedGateIds.has('idempotency');
    const hasFailure = failure.id !== 'none';
    const retrySafe = !hasFailure
      || (failure.retryable ? maxAttempts >= 2 && maxAttempts <= 3 : maxAttempts === 1);
    const duplicateContained = !failure.duplicateActionRisk || idempotent;
    const contained = hasFailure
      && boundedCanary
      && observable
      && rollbackReady
      && retrySafe
      && duplicateContained;
    const affectedTrafficPct = !hasFailure ? 0 : contained ? canaryPercent : 100;
    const ready = !hasFailure && missingGates.length === 0 && boundedCanary;

    let status = 'Candidate is ready for a bounded canary';
    let verdict = 'Every required gate passes and initial exposure is at most 10%. Keep the reference configuration warm and watch stop conditions.';
    if (missingGates.length > 0) {
      status = 'Release evidence is incomplete';
      verdict = `Complete ${missingGates.map((gate) => gate.label.toLowerCase()).join(', ')} before exposing production traffic.`;
    } else if (!boundedCanary) {
      status = 'Initial exposure is too broad';
      verdict = 'The candidate may pass offline gates, but a first step above 10% makes an unknown failure affect too many users.';
    }

    if (hasFailure && failure.duplicateActionRisk && !idempotent) {
      status = 'Retry can duplicate a side effect';
      verdict = 'The timeout is ambiguous and the idempotency gate is missing. Look up or resume the stable operation before another attempt.';
    } else if (hasFailure && !observable) {
      status = 'Failure cannot be traced end to end';
      verdict = 'Without trace continuity, operators cannot distinguish provider rejection, local timeout, tool completion, and fallback behavior.';
    } else if (hasFailure && !retrySafe) {
      status = failure.retryable ? 'Retry budget adds excess pressure' : 'Non-retryable failure is being retried';
      verdict = failure.retryable
        ? 'Use a small capped attempt count with backoff and jitter. More attempts consume deadline and rate-limit budget.'
        : 'Schema and safety regressions need fallback or rollback, not repeated generation with the same candidate.';
    } else if (hasFailure && (!rollbackReady || !boundedCanary)) {
      status = 'Failure escapes the intended release boundary';
      verdict = 'A missing warm rollback or broad exposure turns a candidate failure into a full-route incident.';
    } else if (contained) {
      status = 'Injected failure stays inside the canary';
      verdict = `${failure.containment} The modeled user impact is limited to ${canaryPercent}% of traffic.`;
    }

    return {
      affectedTrafficPct,
      boundedCanary,
      contained,
      duplicateContained,
      hasFailure,
      missingGates,
      observable,
      passedGateCount,
      ready,
      requiredGates,
      retrySafe,
      rollbackReady,
      status,
      verdict,
    };
  }, [canaryPercent, change.requiredGateIds, completedGateIds, data.gates, failure, maxAttempts]);

  function toggleGate(id: string) {
    setCompletedGateIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setChangeId(data.defaults.changeId);
    setFailureId(data.defaults.failureId);
    setCanaryPercent(data.defaults.canaryPercent);
    setMaxAttempts(data.defaults.maxAttempts);
    setCompletedGateIds(new Set(data.defaults.completedGateIds));
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="OpenAI release lab"
          title={data.title}
          description={data.description}
          icon={TestTube2}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate change
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.changes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === change.id}
                      label={item.label}
                      detail={item.detail}
                      icon={changeIcon(item.id)}
                      accent="blue"
                      onClick={() => setChangeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Initial canary traffic"
                value={canaryPercent}
                output={`${canaryPercent}%`}
                {...data.bounds.canaryPercent}
                accent="amber"
                lowLabel="Bounded"
                highLabel="Full route"
                onChange={setCanaryPercent}
              />

              <LabRange
                label="Maximum attempts"
                value={maxAttempts}
                output={`${maxAttempts} attempt${maxAttempts === 1 ? '' : 's'}`}
                {...data.bounds.maxAttempts}
                accent="rose"
                lowLabel="No retry"
                highLabel="More pressure"
                onChange={setMaxAttempts}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.failures.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === failure.id}
                      label={item.label}
                      detail={item.detail}
                      icon={failureIcon(item.id)}
                      accent={item.id === 'none' ? 'emerald' : 'rose'}
                      onClick={() => setFailureId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Required evidence"
                value={`${result.passedGateCount}/${result.requiredGates.length}`}
                detail={result.missingGates.length ? `${result.missingGates.length} gate(s) missing` : 'All required gates pass'}
                icon={FileCheck2}
                tone={result.missingGates.length ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Traffic affected"
                value={`${result.affectedTrafficPct}%`}
                detail={result.hasFailure ? 'Under the injected failure' : 'No failure injected'}
                icon={AlertTriangle}
                tone={result.affectedTrafficPct > 10 ? 'rose' : result.affectedTrafficPct > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Retry policy"
                value={result.retrySafe ? 'Bounded' : 'Unsafe'}
                detail={`${maxAttempts} maximum attempt${maxAttempts === 1 ? '' : 's'}`}
                icon={RefreshCcw}
                tone={result.retrySafe ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Failure boundary"
                value={result.hasFailure ? result.contained ? 'Canary' : 'Full route' : 'Not active'}
                detail={result.rollbackReady ? 'Warm rollback selected' : 'Rollback evidence missing'}
                icon={ShieldCheck}
                tone={result.contained ? 'emerald' : result.hasFailure ? 'rose' : 'neutral'}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.ready || result.contained
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.ready || result.contained
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.verdict}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Release gates</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{change.label}</p>
                </div>
                <span className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${result.boundedCanary
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200'}`}
                >
                  {result.boundedCanary ? 'Bounded canary' : 'Broad exposure'}
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {data.gates.map((gate) => {
                  const checked = completedGateIds.has(gate.id);
                  const required = change.requiredGateIds.includes(gate.id);
                  return (
                    <label
                      key={gate.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber-500 ${checked
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25'
                        : required
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/25'
                          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGate(gate.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                          {gate.label}
                          {required ? <span className="text-[10px] uppercase text-amber-700 dark:text-amber-300">Required</span> : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">{gate.detail}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Failure path</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <FlowNode label="Reference route" detail={`${100 - canaryPercent}% traffic`} icon={Route} tone="neutral" />
                <FlowArrow />
                <FlowNode label="Candidate route" detail={`${canaryPercent}% traffic`} icon={TestTube2} tone={result.hasFailure ? 'rose' : 'blue'} />
                <FlowArrow />
                <FlowNode
                  label={result.hasFailure ? result.contained ? 'Rollback ready' : 'Impact expands' : 'Stop conditions armed'}
                  detail={result.hasFailure ? failure.signal : 'No failure injected'}
                  icon={result.contained ? RotateCcw : result.hasFailure ? AlertTriangle : Gauge}
                  tone={result.contained ? 'emerald' : result.hasFailure ? 'rose' : 'neutral'}
                />
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function changeIcon(id: string) {
  if (id === 'tool-scope') return Wrench;
  if (id === 'retrieval-policy') return Route;
  if (id === 'model-snapshot') return TestTube2;
  return FileCheck2;
}

function failureIcon(id: string) {
  if (id === 'none') return Check;
  if (id === 'rate-limit') return Gauge;
  if (id === 'timeout-after-tool') return TimerReset;
  if (id === 'schema-drift') return FileCheck2;
  return ShieldCheck;
}

function FlowNode({
  label,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  detail: string;
  icon: typeof Route;
  tone: 'neutral' | 'blue' | 'emerald' | 'rose';
}) {
  const styles = {
    neutral: 'border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
    blue: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100',
  };
  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex h-5 items-center justify-center text-neutral-400 sm:w-5" aria-hidden="true">
      <span className="rotate-90 text-lg leading-none sm:rotate-0">-&gt;</span>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="text-center text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading release controls...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Release lab unavailable</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
