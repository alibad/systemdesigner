'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  CircleAlert,
  GitCompareArrows,
  HeartPulse,
  LoaderCircle,
  PackageCheck,
  ServerCrash,
  ShieldCheck,
  Square,
  TestTube2,
  TimerReset,
  Workflow,
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
type Topology = { id: string; label: string; detail: string; isolatesFailure: boolean };
type Gate = { id: string; label: string; detail: string };
type Failure = {
  id: string;
  label: string;
  detail: string;
  signal: string;
  containment: string;
  baseRecoveryMinutes: number;
};
type ServingReleaseData = {
  title: string;
  description: string;
  defaults: {
    changeId: string;
    topologyId: string;
    failureId: string;
    canaryPercent: number;
    completedGateIds: string[];
  };
  bounds: { canaryPercent: Bounds };
  policy: {
    maxInitialCanaryPercent: number;
    missingRollbackPenaltyMinutes: number;
    sharedPoolPenaltyMinutes: number;
  };
  changes: Change[];
  topologies: Topology[];
  gates: Gate[];
  failures: Failure[];
};

const BLOCK_ID = 'technology/tensorflow-serving-release-lab';

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

function isServingReleaseData(value: unknown): value is ServingReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.changeId
      && candidate.defaults.topologyId
      && candidate.defaults.failureId
      && isNumber(candidate.defaults.canaryPercent)
      && isStringArray(candidate.defaults.completedGateIds)
      && isBounds(candidate.bounds?.canaryPercent)
      && isNumber(candidate.policy?.maxInitialCanaryPercent)
      && isNumber(candidate.policy?.missingRollbackPenaltyMinutes)
      && isNumber(candidate.policy?.sharedPoolPenaltyMinutes)
      && Array.isArray(candidate.changes)
      && candidate.changes.length > 0
      && candidate.changes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && isStringArray(item.requiredGateIds)
      ))
      && Array.isArray(candidate.topologies)
      && candidate.topologies.length > 0
      && candidate.topologies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.isolatesFailure === 'boolean'
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
        && typeof item.signal === 'string'
        && typeof item.containment === 'string'
        && isNumber(item.baseRecoveryMinutes)
      )),
  );
}

export default function TensorFlowServingReleaseLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ServingReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No TensorFlow serving release model was supplied.');
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
        if (!isServingReleaseData(payload)) {
          throw new Error('The TensorFlow release model is incomplete.');
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
  return <ServingReleaseLab data={data} />;
}

function ServingReleaseLab({ data }: { data: ServingReleaseData }) {
  const [changeId, setChangeId] = useState(data.defaults.changeId);
  const [topologyId, setTopologyId] = useState(data.defaults.topologyId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [canaryPercent, setCanaryPercent] = useState(data.defaults.canaryPercent);
  const [completedGateIds, setCompletedGateIds] = useState(
    () => new Set(data.defaults.completedGateIds),
  );

  const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
  const topology = data.topologies.find((item) => item.id === topologyId) ?? data.topologies[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];

  const result = useMemo(() => {
    const requiredGates = data.gates.filter((gate) => change.requiredGateIds.includes(gate.id));
    const missingGates = requiredGates.filter((gate) => !completedGateIds.has(gate.id));
    const passedGateCount = requiredGates.length - missingGates.length;
    const rollbackReady = completedGateIds.has('warm-rollback');
    const hasFailure = failure.id !== 'none';
    const boundedCanary = canaryPercent <= data.policy.maxInitialCanaryPercent;
    const affectedTrafficPercent = hasFailure ? topology.isolatesFailure ? canaryPercent : 100 : 0;
    const recoveryMinutes = hasFailure
      ? failure.baseRecoveryMinutes
        + (rollbackReady ? 0 : data.policy.missingRollbackPenaltyMinutes)
        + (topology.isolatesFailure ? 0 : data.policy.sharedPoolPenaltyMinutes)
      : 0;
    const ready = missingGates.length === 0
      && topology.isolatesFailure
      && boundedCanary
      && !hasFailure;

    let status = 'Candidate is ready for a bounded canary';
    let verdict = `All required evidence passes, the failure domain is isolated, and exposure is within the ${data.policy.maxInitialCanaryPercent}% initial-canary policy used by this lab.`;
    if (hasFailure && topology.isolatesFailure && rollbackReady) {
      status = 'Abort the candidate; keep the reference version serving';
      verdict = `${failure.containment} Modeled impact remains on the ${canaryPercent}% candidate route.`;
    } else if (hasFailure) {
      status = 'The injected failure escapes the intended boundary';
      verdict = `${failure.containment} Shared capacity or missing rollback evidence increases impact and recovery time.`;
    } else if (missingGates.length > 0) {
      status = 'Release evidence is incomplete';
      verdict = `Collect ${missingGates.map((gate) => gate.label.toLowerCase()).join(', ')} before sending production traffic.`;
    } else if (!topology.isolatesFailure) {
      status = 'The candidate shares the reference failure domain';
      verdict = 'An in-place replacement can remove both the new path and the rollback path. Create an independent candidate pool.';
    } else if (!boundedCanary) {
      status = 'Initial exposure exceeds this release policy';
      verdict = `Begin at or below ${data.policy.maxInitialCanaryPercent}%, inspect version-specific signals, and expand through measured stages.`;
    }

    return {
      affectedTrafficPercent,
      boundedCanary,
      hasFailure,
      missingGates,
      passedGateCount,
      ready,
      recoveryMinutes,
      requiredGates,
      rollbackReady,
      status,
      verdict,
    };
  }, [canaryPercent, change.requiredGateIds, completedGateIds, data.gates, data.policy, failure, topology]);

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
    setTopologyId(data.defaults.topologyId);
    setFailureId(data.defaults.failureId);
    setCanaryPercent(data.defaults.canaryPercent);
    setCompletedGateIds(new Set(data.defaults.completedGateIds));
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="TensorFlow release lab"
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
                  Candidate change
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.changes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === change.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'runtime-upgrade' ? GitCompareArrows : item.id === 'custom-layer-change' ? Braces : Workflow}
                      accent="blue"
                      onClick={() => setChangeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Rollout boundary
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.topologies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === topology.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.isolatesFailure ? ShieldCheck : ServerCrash}
                      accent={item.isolatesFailure ? 'emerald' : 'rose'}
                      onClick={() => setTopologyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Candidate traffic"
                value={canaryPercent}
                output={`${canaryPercent}%`}
                {...data.bounds.canaryPercent}
                accent="amber"
                lowLabel="Small canary"
                highLabel="Full traffic"
                onChange={setCanaryPercent}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Inject a serving failure
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
                detail={result.missingGates.length ? `${result.missingGates.length} gate(s) missing` : 'Every required gate passes'}
                icon={PackageCheck}
                tone={result.missingGates.length ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Traffic affected"
                value={`${result.affectedTrafficPercent}%`}
                detail={result.hasFailure ? 'Under the injected failure' : 'No active failure'}
                icon={AlertTriangle}
                tone={result.affectedTrafficPercent > data.policy.maxInitialCanaryPercent ? 'rose' : result.affectedTrafficPercent > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Recovery estimate"
                value={result.hasFailure ? `~${result.recoveryMinutes} min` : 'Not active'}
                detail={result.rollbackReady ? 'Warm rollback evidence is present' : 'Rollback gate is missing'}
                icon={TimerReset}
                tone={result.rollbackReady ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Failure boundary"
                value={topology.isolatesFailure ? 'Candidate pool' : 'Shared pool'}
                detail={topology.isolatesFailure ? 'Reference workers stay independent' : 'Reference capacity is exposed'}
                icon={ShieldCheck}
                tone={topology.isolatesFailure ? 'cyan' : 'rose'}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.ready
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {result.ready
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.verdict}</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="tensorflow-release-gates" className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence checklist</p>
                  <h4 id="tensorflow-release-gates" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Gates required for {change.label.toLowerCase()}
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Toggle evidence to test the decision.</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {result.requiredGates.map((gate) => {
                  const checked = completedGateIds.has(gate.id);
                  return (
                    <button
                      key={gate.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleGate(gate.id)}
                      className={`flex min-w-0 items-start gap-3 rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked
                        ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-800 dark:bg-neutral-950 dark:text-white'
                        : 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked
                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-neutral-950'
                        : 'border-neutral-400 bg-white dark:border-neutral-600 dark:bg-neutral-950'}`}
                      >
                        {checked ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Square aria-hidden="true" className="h-3 w-3 opacity-0" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{gate.label}</span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{gate.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-label="Injected failure response" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start gap-3">
                <HeartPulse aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed signal</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{failure.signal}</p>
                  <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Containment action</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{failure.containment}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function failureIcon(id: string) {
  if (id === 'none') return ShieldCheck;
  if (id === 'signature-mismatch') return Braces;
  if (id === 'latency-regression') return HeartPulse;
  return ServerCrash;
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading TensorFlow release model
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <p className="font-semibold">TensorFlow release lab unavailable</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
