'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  RadioTower,
  ScanSearch,
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

type RequestClass = {
  id: 'normal' | 'slow' | 'failed';
  label: string;
  description: string;
  percentage: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  requestsPerMinute: number;
  classes: RequestClass[];
};

type SamplingPolicy = {
  id: string;
  label: string;
  detail: string;
  mode: 'always-on' | 'head-probability' | 'tail-priority';
};

type SamplingModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    policyId: string;
    windowMinutes: number;
    baselinePercent: number;
  };
  workloads: Workload[];
  policies: SamplingPolicy[];
};

const BLOCK_ID = 'fundamentals/advanced-observability-systems-calculator';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/advanced-observability-systems/data/sampling-evidence-model.json';

function isSamplingModel(value: unknown): value is SamplingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SamplingModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.policyId
      && typeof candidate.defaults.windowMinutes === 'number'
      && typeof candidate.defaults.baselinePercent === 'number'
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 3
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && ['always-on', 'head-probability', 'tail-priority'].includes(policy.mode)
      ))
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && typeof workload.requestsPerMinute === 'number'
        && workload.requestsPerMinute > 0
        && Array.isArray(workload.classes)
        && workload.classes.length === 3
        && workload.classes.every((requestClass) => (
          ['normal', 'slow', 'failed'].includes(requestClass.id)
          && typeof requestClass.label === 'string'
          && typeof requestClass.description === 'string'
          && typeof requestClass.percentage === 'number'
        ))
        && Math.abs(
          workload.classes.reduce((total, requestClass) => total + requestClass.percentage, 0) - 100,
        ) < 0.001
      )),
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function policyIcon(mode: SamplingPolicy['mode']) {
  if (mode === 'always-on') return Database;
  if (mode === 'tail-priority') return ScanSearch;
  return RadioTower;
}

export default function AdvancedObservabilitySystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<SamplingModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSamplingModel(payload)) throw new Error('The sampling model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load sampling data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Trace sampling evidence lab"
            title="Choose which requests remain debuggable"
            description="Loading the lesson-owned workload and sampling model."
            icon={ScanSearch}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <SamplingLab model={model} />
      )}
    </div>
  );
}

function SamplingLab({ model }: { model: SamplingModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [policyId, setPolicyId] = useState(model.defaults.policyId);
  const [windowMinutes, setWindowMinutes] = useState(model.defaults.windowMinutes);
  const [baselinePercent, setBaselinePercent] = useState(model.defaults.baselinePercent);

  const workload = model.workloads.find((item) => item.id === workloadId) ?? model.workloads[0];
  const policy = model.policies.find((item) => item.id === policyId) ?? model.policies[0];

  const result = useMemo(() => {
    const total = workload.requestsPerMinute * windowMinutes;
    const rows = workload.classes.map((requestClass) => {
      const produced = total * (requestClass.percentage / 100);
      const retentionPercent = policy.mode === 'always-on'
        ? 100
        : policy.mode === 'tail-priority' && requestClass.id !== 'normal'
          ? 100
          : baselinePercent;
      const retained = produced * (retentionPercent / 100);
      return { ...requestClass, produced, retained, retentionPercent };
    });
    const retained = rows.reduce((sum, row) => sum + row.retained, 0);
    const incidentProduced = rows
      .filter((row) => row.id !== 'normal')
      .reduce((sum, row) => sum + row.produced, 0);
    const incidentRetained = rows
      .filter((row) => row.id !== 'normal')
      .reduce((sum, row) => sum + row.retained, 0);
    const incidentCoverage = incidentProduced === 0 ? 100 : (incidentRetained / incidentProduced) * 100;
    const reduction = total === 0 ? 0 : 100 - (retained / total) * 100;
    const tone: 'emerald' | 'amber' | 'rose' = incidentCoverage >= 99.999
      ? 'emerald'
      : incidentRetained >= 1
        ? 'amber'
        : 'rose';
    const explanation = policy.mode === 'always-on'
      ? 'Every modeled trace is retained. This preserves evidence but does not control retained volume.'
      : policy.mode === 'tail-priority'
        ? 'Completed slow and failed traces are retained; normal traces use the baseline probability. This assumes complete traces reach the decision point.'
        : `Every request class uses the same ${baselinePercent}% expected probability. The policy cannot know final duration or status when the root span starts.`;

    return { explanation, incidentCoverage, incidentRetained, reduction, retained, rows, tone, total };
  }, [baselinePercent, policy, windowMinutes, workload]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setPolicyId(model.defaults.policyId);
    setWindowMinutes(model.defaults.windowMinutes);
    setBaselinePercent(model.defaults.baselinePercent);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Trace sampling evidence lab"
        title={model.title}
        description={model.description}
        icon={ScanSearch}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload window
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workloads.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workload.id}
                    label={item.label}
                    detail={`${item.requestsPerMinute.toLocaleString()} requests/min. ${item.detail}`}
                    icon={Activity}
                    accent="cyan"
                    onClick={() => setWorkloadId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Observation window"
              value={windowMinutes}
              output={`${windowMinutes} min`}
              min={1}
              max={30}
              step={1}
              lowLabel="1 minute"
              highLabel="30 minutes"
              accent="cyan"
              onChange={setWindowMinutes}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Sampling decision
              </legend>
              <div className="mt-3 grid gap-2">
                {model.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={policyIcon(item.mode)}
                    accent={item.mode === 'always-on' ? 'blue' : item.mode === 'tail-priority' ? 'emerald' : 'violet'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            {policy.mode !== 'always-on' ? (
              <LabRange
                label={policy.mode === 'tail-priority' ? 'Normal-trace baseline' : 'Root sampling probability'}
                value={baselinePercent}
                output={`${baselinePercent}%`}
                min={1}
                max={100}
                step={1}
                lowLabel="1%"
                highLabel="100%"
                accent="violet"
                onChange={setBaselinePercent}
              />
            ) : null}
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Traces produced"
              value={formatCount(result.total)}
              detail={`${workload.requestsPerMinute.toLocaleString()}/min for ${windowMinutes} minutes.`}
              icon={RadioTower}
              tone="blue"
            />
            <LabMetric
              label="Expected retained"
              value={formatCount(result.retained)}
              detail={`${result.reduction.toFixed(1)}% fewer retained traces than always-on.`}
              icon={Database}
              tone="violet"
            />
            <LabMetric
              label="Incident evidence"
              value={formatCount(result.incidentRetained)}
              detail="Expected retained slow and failed traces."
              icon={ShieldCheck}
              tone={result.tone}
            />
            <LabMetric
              label="Incident coverage"
              value={`${result.incidentCoverage.toFixed(1)}%`}
              detail="Expected share of modeled incident traces retained."
              icon={Gauge}
              tone={result.tone}
            />
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence by request outcome
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {result.rows.map((row) => (
                <div key={row.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(130px,0.8fr)_minmax(180px,1.6fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{row.label}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{row.description}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${row.id === 'failed' ? 'bg-rose-500' : row.id === 'slow' ? 'bg-amber-500' : 'bg-cyan-500'}`}
                        style={{ width: `${Math.max(row.retentionPercent, 1)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {row.retentionPercent}% of {formatCount(row.produced)} expected to survive
                    </p>
                  </div>
                  <p className="text-left text-lg font-semibold tabular-nums text-neutral-950 sm:text-right dark:text-white">
                    {formatCount(row.retained)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-md border p-4 ${result.tone === 'emerald'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            : result.tone === 'amber'
              ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}
          >
            <div className="flex items-start gap-3">
              {result.tone === 'emerald' ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : result.tone === 'amber' ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {result.incidentCoverage >= 99.999
                    ? 'The modeled incident classes remain available.'
                    : result.incidentRetained >= 1
                      ? 'Some incident traces are expected to disappear.'
                      : 'This window may retain no incident trace at all.'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  Counts are mathematical expectations, not a guarantee for a particular window. Measure the effective policy and test incomplete traces, collector pressure, and destination failure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Sampling model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading sampling model…
        </div>
      )}
    </div>
  );
}
