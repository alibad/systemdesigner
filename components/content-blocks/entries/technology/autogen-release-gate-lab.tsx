'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  GitCompareArrows,
  KeyRound,
  ListChecks,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type ReleaseChange = {
  id: string;
  label: string;
  detail: string;
  minimumTaskSuccessPercent: number;
  maximumP95LatencySeconds: number;
  requiredGateIds: string[];
  rollout: string;
};

type EvidenceGate = {
  id: string;
  label: string;
  detail: string;
};

type ReleaseGateData = {
  title: string;
  description: string;
  defaults: {
    changeId: string;
    taskSuccessPercent: number;
    policyFailures: number;
    trajectoryCoveragePercent: number;
    p95LatencySeconds: number;
    completedGateIds: string[];
  };
  bounds: {
    taskSuccessPercent: Bounds;
    policyFailures: Bounds;
    trajectoryCoveragePercent: Bounds;
    p95LatencySeconds: Bounds;
  };
  globalThresholds: {
    maximumPolicyFailures: number;
    minimumTrajectoryCoveragePercent: number;
  };
  changes: ReleaseChange[];
  gates: EvidenceGate[];
};

type ThresholdResult = {
  id: string;
  label: string;
  actual: string;
  required: string;
  passed: boolean;
};

const BLOCK_ID = 'technology/autogen-release-gate-lab';

const changeIcons: Record<string, LucideIcon> = {
  'prompt-model': Activity,
  'tool-scope': KeyRound,
  'team-routing': GitCompareArrows,
  'framework-upgrade': PackageCheck,
};

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<Bounds>;
  return typeof bounds.min === 'number'
    && typeof bounds.max === 'number'
    && typeof bounds.step === 'number';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseGateData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.changeId === 'string'
      && typeof data.defaults.taskSuccessPercent === 'number'
      && typeof data.defaults.policyFailures === 'number'
      && typeof data.defaults.trajectoryCoveragePercent === 'number'
      && typeof data.defaults.p95LatencySeconds === 'number'
      && isStringArray(data.defaults.completedGateIds)
      && isBounds(data.bounds?.taskSuccessPercent)
      && isBounds(data.bounds.policyFailures)
      && isBounds(data.bounds.trajectoryCoveragePercent)
      && isBounds(data.bounds.p95LatencySeconds)
      && typeof data.globalThresholds?.maximumPolicyFailures === 'number'
      && typeof data.globalThresholds.minimumTrajectoryCoveragePercent === 'number'
      && Array.isArray(data.changes)
      && data.changes.length >= 3
      && data.changes.every((change) => (
        typeof change.id === 'string'
        && typeof change.label === 'string'
        && typeof change.detail === 'string'
        && typeof change.minimumTaskSuccessPercent === 'number'
        && typeof change.maximumP95LatencySeconds === 'number'
        && isStringArray(change.requiredGateIds)
        && typeof change.rollout === 'string'
      ))
      && Array.isArray(data.gates)
      && data.gates.length > 0
      && data.gates.every((gate) => (
        typeof gate.id === 'string'
        && typeof gate.label === 'string'
        && typeof gate.detail === 'string'
      )),
  );
}

export default function AutogenReleaseGateLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No release-gate model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load release gates (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateData(payload)) {
          throw new Error('The release-gate model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release gates.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <ReleaseLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ReleaseGateWorkbench data={data} />;
}

function ReleaseGateWorkbench({ data }: { data: ReleaseGateData }) {
  const initialChange = data.changes.find((item) => item.id === data.defaults.changeId)
    ?? data.changes[0];
  const [changeId, setChangeId] = useState(initialChange.id);
  const [taskSuccessPercent, setTaskSuccessPercent] = useState(data.defaults.taskSuccessPercent);
  const [policyFailures, setPolicyFailures] = useState(data.defaults.policyFailures);
  const [trajectoryCoveragePercent, setTrajectoryCoveragePercent] = useState(
    data.defaults.trajectoryCoveragePercent,
  );
  const [p95LatencySeconds, setP95LatencySeconds] = useState(data.defaults.p95LatencySeconds);
  const [completedGateIds, setCompletedGateIds] = useState(data.defaults.completedGateIds);

  const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
  const requiredGates = change.requiredGateIds
    .map((id) => data.gates.find((gate) => gate.id === id))
    .filter((gate): gate is EvidenceGate => Boolean(gate));

  const result = useMemo(() => {
    const completed = new Set(completedGateIds);
    const missingGates = requiredGates.filter((gate) => !completed.has(gate.id));
    const thresholds: ThresholdResult[] = [
      {
        id: 'task-success',
        label: 'Task success',
        actual: `${taskSuccessPercent}%`,
        required: `at least ${change.minimumTaskSuccessPercent}%`,
        passed: taskSuccessPercent >= change.minimumTaskSuccessPercent,
      },
      {
        id: 'policy-failures',
        label: 'Critical policy failures',
        actual: String(policyFailures),
        required: `at most ${data.globalThresholds.maximumPolicyFailures}`,
        passed: policyFailures <= data.globalThresholds.maximumPolicyFailures,
      },
      {
        id: 'trajectory-coverage',
        label: 'Offline trajectory capture',
        actual: `${trajectoryCoveragePercent}%`,
        required: `at least ${data.globalThresholds.minimumTrajectoryCoveragePercent}%`,
        passed: trajectoryCoveragePercent >= data.globalThresholds.minimumTrajectoryCoveragePercent,
      },
      {
        id: 'latency',
        label: 'p95 run latency',
        actual: `${p95LatencySeconds}s`,
        required: `at most ${change.maximumP95LatencySeconds}s`,
        passed: p95LatencySeconds <= change.maximumP95LatencySeconds,
      },
    ];
    const failedThresholds = thresholds.filter((threshold) => !threshold.passed);
    const passedCount = thresholds.length - failedThresholds.length
      + requiredGates.length - missingGates.length;
    const totalCount = thresholds.length + requiredGates.length;
    const promotable = failedThresholds.length === 0 && missingGates.length === 0;

    let blocker = 'All required evidence and thresholds pass.';
    if (policyFailures > data.globalThresholds.maximumPolicyFailures) {
      blocker = 'A critical policy failure is a hard stop. Fix the control and rerun the affected negative cases.';
    } else if (missingGates.length > 0) {
      blocker = `${missingGates.length} required evidence artifact${missingGates.length === 1 ? ' is' : 's are'} missing.`;
    } else if (failedThresholds.length > 0) {
      blocker = `${failedThresholds.length} measured threshold${failedThresholds.length === 1 ? ' is' : 's are'} outside the release envelope.`;
    }

    return {
      blocker,
      failedThresholds,
      missingGates,
      passedCount,
      promotable,
      thresholds,
      totalCount,
    } as const;
  }, [
    change.maximumP95LatencySeconds,
    change.minimumTaskSuccessPercent,
    completedGateIds,
    data.globalThresholds.maximumPolicyFailures,
    data.globalThresholds.minimumTrajectoryCoveragePercent,
    p95LatencySeconds,
    policyFailures,
    requiredGates,
    taskSuccessPercent,
    trajectoryCoveragePercent,
  ]);

  function toggleGate(id: string, checked: boolean) {
    setCompletedGateIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  }

  function reset() {
    setChangeId(initialChange.id);
    setTaskSuccessPercent(data.defaults.taskSuccessPercent);
    setPolicyFailures(data.defaults.policyFailures);
    setTrajectoryCoveragePercent(data.defaults.trajectoryCoveragePercent);
    setP95LatencySeconds(data.defaults.p95LatencySeconds);
    setCompletedGateIds(data.defaults.completedGateIds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence release gate"
          title={data.title}
          description={data.description}
          icon={ClipboardCheck}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Candidate change
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.changes.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === change.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={changeIcons[candidate.id] ?? GitCompareArrows}
                      accent="violet"
                      onClick={() => setChangeId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Measured candidate results
                </legend>
                <div className="mt-4 space-y-6">
                  <LabRange
                    label="Task success"
                    value={taskSuccessPercent}
                    output={`${taskSuccessPercent}%`}
                    {...data.bounds.taskSuccessPercent}
                    lowLabel="Weak"
                    highLabel="All cases"
                    accent="emerald"
                    onChange={setTaskSuccessPercent}
                  />
                  <LabRange
                    label="Critical policy failures"
                    value={policyFailures}
                    output={String(policyFailures)}
                    {...data.bounds.policyFailures}
                    lowLabel="None"
                    highLabel="Release stop"
                    accent="rose"
                    onChange={setPolicyFailures}
                  />
                  <LabRange
                    label="Offline trajectory capture"
                    value={trajectoryCoveragePercent}
                    output={`${trajectoryCoveragePercent}%`}
                    {...data.bounds.trajectoryCoveragePercent}
                    lowLabel="Gaps"
                    highLabel="Complete"
                    accent="blue"
                    onChange={setTrajectoryCoveragePercent}
                  />
                  <LabRange
                    label="p95 run latency"
                    value={p95LatencySeconds}
                    output={`${p95LatencySeconds}s`}
                    {...data.bounds.p95LatencySeconds}
                    lowLabel="Fast"
                    highLabel="Slow"
                    accent="amber"
                    onChange={setP95LatencySeconds}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Release decision"
                value={result.promotable ? 'Promote' : 'Blocked'}
                detail={result.promotable ? 'All selected gates pass' : result.blocker}
                icon={result.promotable ? PackageCheck : ShieldAlert}
                tone={result.promotable ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Gate completion"
                value={`${result.passedCount}/${result.totalCount}`}
                detail="Measured thresholds plus required evidence"
                icon={ListChecks}
                tone={result.promotable ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Task threshold"
                value={`>=${change.minimumTaskSuccessPercent}%`}
                detail={`${taskSuccessPercent}% measured on the candidate dataset`}
                icon={Activity}
                tone={taskSuccessPercent >= change.minimumTaskSuccessPercent ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Latency envelope"
                value={`<=${change.maximumP95LatencySeconds}s`}
                detail={`${p95LatencySeconds}s measured p95 run latency`}
                icon={Timer}
                tone={p95LatencySeconds <= change.maximumP95LatencySeconds ? 'blue' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Measured thresholds
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {result.thresholds.map((threshold) => (
                  <li
                    key={threshold.id}
                    className={`rounded-md border p-3 ${
                      threshold.passed
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {threshold.passed
                        ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {threshold.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {threshold.actual}; requires {threshold.required}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <legend className="px-1 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Required evidence for {change.label.toLowerCase()}
              </legend>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {requiredGates.map((gate) => {
                  const checked = completedGateIds.includes(gate.id);
                  return (
                    <label
                      key={gate.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 focus-within:ring-2 focus-within:ring-emerald-500 ${
                        checked
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                          : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleGate(gate.id, event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                          {gate.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                          {gate.detail}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <section className={`rounded-md border p-4 ${
              result.promotable
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            }`}>
              <div className="flex items-start gap-3">
                {result.promotable
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {result.promotable ? 'Promotion evidence is complete' : 'Promotion remains blocked'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.blocker}
                  </p>
                  <p className="mt-2 text-xs font-medium leading-5 text-neutral-600 dark:text-neutral-300">
                    Rollout: {change.rollout}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Gauge aria-hidden="true" className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Gate interpretation
                </h4>
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                Checkbox completion represents a reviewed artifact, not a promise. In a real release system, each gate should link to immutable evaluation output, trace queries, replay results, an approval record, or a rollback rehearsal.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ReleaseLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence release gate"
          title={error ? 'Release gate unavailable' : 'Loading release gates'}
          description={error ?? 'Loading candidate thresholds and evidence requirements.'}
          icon={error ? TriangleAlert : LoaderCircle}
          accent={error ? 'rose' : 'emerald'}
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center">
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : (
              <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-emerald-600 motion-reduce:animate-none dark:text-emerald-300" />
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
