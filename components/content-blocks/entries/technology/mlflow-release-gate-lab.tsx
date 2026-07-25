'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  GitCompareArrows,
  ListChecks,
  PackageCheck,
  ShieldCheck,
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

const BLOCK_ID = 'technology/mlflow-release-gate-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/mlflow/data/release-gate-model.json';

type Bounds = { min: number; max: number; step: number };
type Change = { id: string; label: string; detail: string; requiredGateIds: string[] };
type Handoff = { id: string; label: string; detail: string; preventsAliasDrift: boolean };
type Gate = { id: string; label: string; detail: string };
type Failure = {
  id: string;
  label: string;
  detail: string;
  signal: string;
  containment: string;
  baseRecoveryMinutes: number;
};
type ReleaseGateData = {
  title: string;
  description: string;
  defaults: {
    changeId: string;
    handoffId: string;
    failureId: string;
    canaryPercent: number;
    candidateF1: number;
    worstSliceRecall: number;
    p95LatencyMs: number;
    completedGateIds: string[];
  };
  bounds: {
    canaryPercent: Bounds;
    candidateF1: Bounds;
    worstSliceRecall: Bounds;
    p95LatencyMs: Bounds;
  };
  thresholds: {
    minimumF1: number;
    minimumWorstSliceRecall: number;
    maximumP95LatencyMs: number;
    maximumInitialCanaryPercent: number;
  };
  changes: Change[];
  handoffs: Handoff[];
  gates: Gate[];
  failures: Failure[];
};

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<Bounds>;
  return typeof bounds.min === 'number' && typeof bounds.max === 'number' && typeof bounds.step === 'number';
}

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseGateData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.changeId === 'string'
      && typeof data.defaults.handoffId === 'string'
      && typeof data.defaults.failureId === 'string'
      && Array.isArray(data.defaults.completedGateIds)
      && isBounds(data.bounds?.canaryPercent)
      && isBounds(data.bounds.candidateF1)
      && isBounds(data.bounds.worstSliceRecall)
      && isBounds(data.bounds.p95LatencyMs)
      && typeof data.thresholds?.minimumF1 === 'number'
      && typeof data.thresholds.minimumWorstSliceRecall === 'number'
      && typeof data.thresholds.maximumP95LatencyMs === 'number'
      && typeof data.thresholds.maximumInitialCanaryPercent === 'number'
      && Array.isArray(data.changes)
      && data.changes.length > 0
      && data.changes.every((item) => typeof item.id === 'string' && Array.isArray(item.requiredGateIds))
      && Array.isArray(data.handoffs)
      && data.handoffs.length > 0
      && data.handoffs.every((item) => typeof item.id === 'string' && typeof item.preventsAliasDrift === 'boolean')
      && Array.isArray(data.gates)
      && data.gates.length > 0
      && data.gates.every((item) => typeof item.id === 'string' && typeof item.label === 'string')
      && Array.isArray(data.failures)
      && data.failures.length > 0
      && data.failures.every((item) => typeof item.id === 'string' && typeof item.baseRecoveryMinutes === 'number'),
  );
}

export default function MlflowReleaseGateLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load release data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isReleaseGateData(value)) throw new Error('The release model does not match the expected contract.');
        setData(value);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load release data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ReleaseGateWorkbench data={data} />;
}

function ReleaseGateWorkbench({ data }: { data: ReleaseGateData }) {
  const [changeId, setChangeId] = useState(data.defaults.changeId);
  const [handoffId, setHandoffId] = useState(data.defaults.handoffId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [canaryPercent, setCanaryPercent] = useState(data.defaults.canaryPercent);
  const [candidateF1, setCandidateF1] = useState(data.defaults.candidateF1);
  const [worstSliceRecall, setWorstSliceRecall] = useState(data.defaults.worstSliceRecall);
  const [p95LatencyMs, setP95LatencyMs] = useState(data.defaults.p95LatencyMs);
  const [completedGateIds, setCompletedGateIds] = useState(data.defaults.completedGateIds);

  const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
  const handoff = data.handoffs.find((item) => item.id === handoffId) ?? data.handoffs[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
  const result = useMemo(() => {
    const completed = new Set(completedGateIds);
    const missingGateIds = change.requiredGateIds.filter((id) => !completed.has(id));
    const metricFailures = [
      candidateF1 < data.thresholds.minimumF1 ? 'Overall F1 misses the floor' : null,
      worstSliceRecall < data.thresholds.minimumWorstSliceRecall ? 'Worst-slice recall misses the floor' : null,
      p95LatencyMs > data.thresholds.maximumP95LatencyMs ? 'P95 latency exceeds the ceiling' : null,
      canaryPercent > data.thresholds.maximumInitialCanaryPercent ? 'Initial canary is too broad' : null,
    ].filter((item): item is string => Boolean(item));
    const faultInjected = failure.id !== 'none';
    const eligible = missingGateIds.length === 0
      && metricFailures.length === 0
      && handoff.preventsAliasDrift
      && !faultInjected;
    const recoveryMinutes = faultInjected
      ? Math.max(1, Math.round(failure.baseRecoveryMinutes * (1 + canaryPercent / 20)))
      : 0;
    const state = eligible
      ? 'Promote bounded canary'
      : faultInjected
        ? 'Contain and recover'
        : 'Hold alias movement';
    return { eligible, faultInjected, metricFailures, missingGateIds, recoveryMinutes, state };
  }, [canaryPercent, candidateF1, change.requiredGateIds, completedGateIds, data.thresholds, failure, handoff.preventsAliasDrift, p95LatencyMs, worstSliceRecall]);

  function toggleGate(gateId: string) {
    setCompletedGateIds((current) => current.includes(gateId)
      ? current.filter((id) => id !== gateId)
      : [...current, gateId]);
  }

  function reset() {
    setChangeId(data.defaults.changeId);
    setHandoffId(data.defaults.handoffId);
    setFailureId(data.defaults.failureId);
    setCanaryPercent(data.defaults.canaryPercent);
    setCandidateF1(data.defaults.candidateF1);
    setWorstSliceRecall(data.defaults.worstSliceRecall);
    setP95LatencyMs(data.defaults.p95LatencyMs);
    setCompletedGateIds(data.defaults.completedGateIds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Registry release lab"
          title={data.title}
          description={data.description}
          icon={PackageCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">1. Candidate change</legend>
                <div className="mt-3 space-y-2">
                  {data.changes.map((item) => <LabChoice key={item.id} selected={change.id === item.id} label={item.label} detail={item.detail} icon={GitCompareArrows} accent="violet" onClick={() => setChangeId(item.id)} />)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">2. Deployment handoff</legend>
                <div className="mt-3 space-y-2">
                  {data.handoffs.map((item) => <LabChoice key={item.id} selected={handoff.id === item.id} label={item.label} detail={item.detail} icon={CloudCog} accent="cyan" onClick={() => setHandoffId(item.id)} />)}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">3. Failure injection</legend>
                <div className="mt-3 space-y-2">
                  {data.failures.map((item) => <LabChoice key={item.id} selected={failure.id === item.id} label={item.label} detail={item.detail} icon={CircleAlert} accent={item.id === 'none' ? 'emerald' : 'rose'} onClick={() => setFailureId(item.id)} />)}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className={`rounded-md border p-4 ${
            result.eligible
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : result.faultInjected
                ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
          }`}>
            <div className="flex items-start gap-3">
              {result.eligible
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
              <div className="min-w-0">
                <p className="text-base font-semibold text-neutral-950 dark:text-white">{result.state}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.eligible
                    ? 'All evidence passes. Resolve the alias once, record the immutable version, and begin the bounded canary.'
                    : result.faultInjected
                      ? failure.containment
                      : 'Keep the current champion in place until every required gate, metric, and handoff contract passes.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric label="Required gates" value={`${change.requiredGateIds.length - result.missingGateIds.length}/${change.requiredGateIds.length}`} detail="Change-specific evidence" icon={ListChecks} tone={result.missingGateIds.length === 0 ? 'emerald' : 'amber'} />
            <LabMetric label="Alias handoff" value={handoff.preventsAliasDrift ? 'Immutable' : 'Can drift'} detail="Resolution during deployment" icon={ShieldCheck} tone={handoff.preventsAliasDrift ? 'emerald' : 'rose'} />
            <LabMetric label="Recovery model" value={result.faultInjected ? `${result.recoveryMinutes} min` : 'Standby'} detail="Illustrative containment time" icon={TimerReset} tone={result.faultInjected ? 'rose' : 'neutral'} />
          </div>

          <fieldset className="mt-7 grid gap-5 sm:grid-cols-2">
            <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Candidate measurements</legend>
            <LabRange label="Overall F1" value={candidateF1} output={`${candidateF1}%`} min={data.bounds.candidateF1.min} max={data.bounds.candidateF1.max} step={data.bounds.candidateF1.step} lowLabel={`${data.bounds.candidateF1.min}%`} highLabel={`${data.bounds.candidateF1.max}%`} accent="violet" onChange={setCandidateF1} />
            <LabRange label="Worst-slice recall" value={worstSliceRecall} output={`${worstSliceRecall}%`} min={data.bounds.worstSliceRecall.min} max={data.bounds.worstSliceRecall.max} step={data.bounds.worstSliceRecall.step} lowLabel={`${data.bounds.worstSliceRecall.min}%`} highLabel={`${data.bounds.worstSliceRecall.max}%`} accent="rose" onChange={setWorstSliceRecall} />
            <LabRange label="P95 latency" value={p95LatencyMs} output={`${p95LatencyMs} ms`} min={data.bounds.p95LatencyMs.min} max={data.bounds.p95LatencyMs.max} step={data.bounds.p95LatencyMs.step} lowLabel={`${data.bounds.p95LatencyMs.min} ms`} highLabel={`${data.bounds.p95LatencyMs.max} ms`} accent="cyan" onChange={setP95LatencyMs} />
            <LabRange label="Initial canary" value={canaryPercent} output={`${canaryPercent}%`} min={data.bounds.canaryPercent.min} max={data.bounds.canaryPercent.max} step={data.bounds.canaryPercent.step} lowLabel={`${data.bounds.canaryPercent.min}%`} highLabel={`${data.bounds.canaryPercent.max}%`} accent="amber" onChange={setCanaryPercent} />
          </fieldset>

          <div className="mt-7">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">5. Release evidence</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.gates.filter((gate) => change.requiredGateIds.includes(gate.id)).map((gate) => {
                const selected = completedGateIds.includes(gate.id);
                return (
                  <button
                    key={gate.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleGate(gate.id)}
                    className={`rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-neutral-300 dark:border-neutral-700'}`}>
                        {selected ? <Check aria-hidden="true" className="h-4 w-4" /> : <Activity aria-hidden="true" className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{gate.label}</span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{gate.detail}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(result.metricFailures.length > 0 || result.missingGateIds.length > 0 || !handoff.preventsAliasDrift) ? (
            <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Blocking evidence</p>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:text-rose-600 dark:text-neutral-300 dark:marker:text-rose-400">
                {result.missingGateIds.map((id) => <li key={id}>Missing gate: {data.gates.find((gate) => gate.id === id)?.label ?? id}</li>)}
                {result.metricFailures.map((item) => <li key={item}>{item}</li>)}
                {!handoff.preventsAliasDrift ? <li>Runtime alias polling can load different versions across workers.</li> : null}
              </ul>
            </div>
          ) : null}

          {result.faultInjected ? (
            <div className="mt-6 rounded-md border border-rose-300 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
              <p className="text-sm font-semibold text-rose-950 dark:text-rose-100">Observed signal</p>
              <p className="mt-1 text-sm leading-6 text-rose-900 dark:text-rose-200">{failure.signal}</p>
            </div>
          ) : null}
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return <div data-content-block={BLOCK_ID} aria-label="Loading MLflow release lab" className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />;
}

function LoadError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{detail}</div>;
}
