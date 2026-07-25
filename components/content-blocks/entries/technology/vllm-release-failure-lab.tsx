'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleAlert,
  GitCompareArrows,
  HeartPulse,
  LoaderCircle,
  Network,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  Square,
  TestTube2,
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
  recoveryMinutes: number;
};
type ReleaseData = {
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
  changes: Change[];
  topologies: Topology[];
  gates: Gate[];
  failures: Failure[];
};

const BLOCK_ID = 'technology/vllm-release-failure-lab';

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

function isReleaseData(value: unknown): value is ReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.changeId
      && candidate.defaults.topologyId
      && candidate.defaults.failureId
      && isNumber(candidate.defaults.canaryPercent)
      && isStringArray(candidate.defaults.completedGateIds)
      && isBounds(candidate.bounds?.canaryPercent)
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
        && isNumber(item.recoveryMinutes)
      )),
  );
}

function changeIcon(id: string) {
  if (id === 'parallelism-change') return Network;
  if (id === 'model-runtime-bundle') return PackageCheck;
  return RefreshCcw;
}

function failureIcon(id: string) {
  if (id === 'none') return ShieldCheck;
  if (id === 'api-regression') return GitCompareArrows;
  if (id === 'metric-drift') return HeartPulse;
  return ServerCrash;
}

export default function VllmReleaseFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No vLLM release model was supplied.');
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
        if (!isReleaseData(payload)) throw new Error('The release model is incomplete.');
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
  return <ReleaseLab data={data} />;
}

function ReleaseLab({ data }: { data: ReleaseData }) {
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
    const rollbackReady = completedGateIds.has('rollback');
    const hasFailure = failure.id !== 'none';
    const affectedTrafficPct = hasFailure
      ? topology.isolatesFailure ? canaryPercent : 100
      : 0;
    const recoveryMinutes = hasFailure
      ? failure.recoveryMinutes + (rollbackReady ? 0 : 6) + (topology.isolatesFailure ? 0 : 4)
      : 0;
    const boundedCanary = topology.isolatesFailure && canaryPercent <= 10;
    const ready = missingGates.length === 0 && boundedCanary && !hasFailure;

    let status = 'Candidate is ready for a bounded canary';
    let verdict = 'Required evidence is present, the candidate has an independent failure domain, and initial exposure is at most 10%.';
    if (hasFailure && topology.isolatesFailure && rollbackReady) {
      status = 'Abort candidate; reference pool remains available';
      verdict = `${failure.containment} The modeled user impact is limited to the ${canaryPercent}% candidate route.`;
    } else if (hasFailure) {
      status = 'Failure escapes the intended boundary';
      verdict = `${failure.containment} Shared capacity or a missing warm rollback increases both impact and recovery time.`;
    } else if (missingGates.length > 0) {
      status = 'Release evidence is incomplete';
      verdict = `Collect ${missingGates.map((gate) => gate.label.toLowerCase()).join(', ')} evidence before sending production traffic.`;
    } else if (!topology.isolatesFailure) {
      status = 'Candidate shares the reference failure domain';
      verdict = 'An in-place change can remove both candidate and rollback capacity. Create an independent pool before canarying the upgrade.';
    } else if (canaryPercent > 10) {
      status = 'Initial exposure is too broad';
      verdict = 'The evidence passes, but the first canary step puts more than 10% of traffic at risk. Begin smaller and expand through measured stages.';
    }

    return {
      affectedTrafficPct,
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
  }, [canaryPercent, change.requiredGateIds, completedGateIds, data.gates, failure, topology]);

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
          eyebrow="vLLM release lab"
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
                      icon={changeIcon(item.id)}
                      accent="blue"
                      onClick={() => setChangeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Rollout topology
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.topologies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === topology.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.isolatesFailure ? ShieldCheck : Network}
                      accent={item.isolatesFailure ? 'emerald' : 'amber'}
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
                lowLabel="Bounded canary"
                highLabel="Full promotion"
                onChange={setCanaryPercent}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Inject a failure
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
                icon={CheckCircle2}
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
                label="Recovery estimate"
                value={result.hasFailure ? `~${result.recoveryMinutes} min` : 'Not active'}
                detail={result.rollbackReady ? 'Warm rollback evidence present' : 'Rollback gate is missing'}
                icon={TimerReset}
                tone={result.rollbackReady ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Failure boundary"
                value={topology.isolatesFailure ? 'Canary pool' : 'Shared pool'}
                detail={topology.isolatesFailure ? 'Independent queue and workers' : 'Reference capacity is exposed'}
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

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Traffic and failure path</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{failure.signal}</p>
                </div>
                <span className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${result.boundedCanary
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-200'}`}
                >
                  {result.boundedCanary ? 'Bounded route' : 'Broad route'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
                <PoolState
                  label="Reference pool"
                  trafficPct={100 - canaryPercent}
                  state={result.hasFailure && !topology.isolatesFailure ? 'Exposed to candidate failure' : 'Available for rollback'}
                  healthy={!result.hasFailure || topology.isolatesFailure}
                />
                <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-500">
                  <GitCompareArrows aria-hidden="true" className="h-5 w-5 rotate-90 sm:rotate-0" />
                  <span className="sr-only">Traffic split</span>
                </div>
                <PoolState
                  label="Candidate pool"
                  trafficPct={canaryPercent}
                  state={result.hasFailure ? 'Fault injected; remove from routing' : 'Receiving canary traffic'}
                  healthy={!result.hasFailure}
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                In a shared in-place pool, the diagram still shows logical routes, but the processes and failure domain are not independent.
              </p>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence gates</p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">Only gates required by the selected change affect the verdict.</p>
                </div>
                <RotateCcw aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400" />
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {data.gates.map((gate) => (
                  <GateControl
                    key={gate.id}
                    gate={gate}
                    checked={completedGateIds.has(gate.id)}
                    required={change.requiredGateIds.includes(gate.id)}
                    onToggle={() => toggleGate(gate.id)}
                  />
                ))}
              </div>
            </section>

            {result.hasFailure ? (
              <section className="rounded-md border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
                <div className="flex items-start gap-3">
                  <ServerCrash aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  <div>
                    <p className="text-sm font-semibold text-rose-950 dark:text-rose-100">Containment action</p>
                    <p className="mt-1 text-sm leading-6 text-rose-900 dark:text-rose-200">{failure.containment}</p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PoolState({
  label,
  trafficPct,
  state,
  healthy,
}: {
  label: string;
  trafficPct: number;
  state: string;
  healthy: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${healthy
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">{trafficPct}%</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{state}</p>
    </div>
  );
}

function GateControl({
  gate,
  checked,
  required,
  onToggle,
}: {
  gate: Gate;
  checked: boolean;
  required: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`flex min-h-24 w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${checked
        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
        : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${checked
        ? 'bg-emerald-600 text-white'
        : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'}`}
      >
        {checked ? <Check aria-hidden="true" className="h-4 w-4" /> : <Square aria-hidden="true" className="h-4 w-4" />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{gate.label}</span>
          <span className="rounded-md border border-current px-1.5 py-0.5 text-[10px] font-semibold uppercase opacity-70">
            {required ? 'Required' : 'Optional'}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{gate.detail}</span>
      </span>
    </button>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-56 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading vLLM release model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100">
      <p className="font-semibold">Release lab unavailable</p>
      <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
    </div>
  );
}
