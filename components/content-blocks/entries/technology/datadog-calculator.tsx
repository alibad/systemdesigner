'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  FileText,
  Network,
  ShieldCheck,
  SlidersHorizontal,
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
type Workload = {
  id: string;
  label: string;
  detail: string;
  requestsPerSecond: number;
  errorPercent: number;
  logsPerRequest: number;
  bytesPerLog: number;
  spansPerTrace: number;
  bytesPerSpan: number;
};
type RetentionPolicy = {
  id: string;
  label: string;
  detail: string;
  retainFailureLogs: boolean;
  retainFailureTraces: boolean;
};
type TelemetryData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    retentionPolicyId: string;
    healthyLogRetentionPercent: number;
    healthyTraceSamplePercent: number;
  };
  bounds: {
    healthyLogRetentionPercent: Bound;
    healthyTraceSamplePercent: Bound;
  };
  workloads: Workload[];
  retentionPolicies: RetentionPolicy[];
};

const BLOCK_ID = 'technology/datadog-calculator';
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GIB = 1024 ** 3;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isTelemetryData(value: unknown): value is TelemetryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TelemetryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.retentionPolicyId
      && typeof candidate.defaults.healthyLogRetentionPercent === 'number'
      && typeof candidate.defaults.healthyTraceSamplePercent === 'number'
      && isBound(candidate.bounds?.healthyLogRetentionPercent)
      && isBound(candidate.bounds?.healthyTraceSamplePercent)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.retentionPolicies)
      && candidate.retentionPolicies.length > 0,
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatGib(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} TiB`;
  if (value >= 10) return `${value.toFixed(0)} GiB`;
  return `${value.toFixed(1)} GiB`;
}

export default function DatadogCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No telemetry decision model was supplied.');
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
        if (!isTelemetryData(payload)) throw new Error('The telemetry decision model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the telemetry lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <TelemetryPolicyLab data={data} />;
}

function TelemetryPolicyLab({ data }: { data: TelemetryData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [retentionPolicyId, setRetentionPolicyId] = useState(data.defaults.retentionPolicyId);
  const [healthyLogRetentionPercent, setHealthyLogRetentionPercent] = useState(
    data.defaults.healthyLogRetentionPercent,
  );
  const [healthyTraceSamplePercent, setHealthyTraceSamplePercent] = useState(
    data.defaults.healthyTraceSamplePercent,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const policy = data.retentionPolicies.find((item) => item.id === retentionPolicyId)
    ?? data.retentionPolicies[0];

  const result = useMemo(() => {
    const requestsPerDay = workload.requestsPerSecond * SECONDS_PER_DAY;
    const failureRequestsPerDay = requestsPerDay * workload.errorPercent / 100;
    const healthyRequestsPerDay = requestsPerDay - failureRequestsPerDay;

    const failureLogsPerDay = failureRequestsPerDay * workload.logsPerRequest;
    const healthyLogsPerDay = healthyRequestsPerDay * workload.logsPerRequest;
    const rawLogsPerDay = failureLogsPerDay + healthyLogsPerDay;
    const keptLogsPerDay = failureLogsPerDay
      * (policy.retainFailureLogs ? 1 : healthyLogRetentionPercent / 100)
      + healthyLogsPerDay * healthyLogRetentionPercent / 100;

    const failureSpansPerDay = failureRequestsPerDay * workload.spansPerTrace;
    const healthySpansPerDay = healthyRequestsPerDay * workload.spansPerTrace;
    const rawSpansPerDay = failureSpansPerDay + healthySpansPerDay;
    const indexedSpansPerDay = failureSpansPerDay
      * (policy.retainFailureTraces ? 1 : healthyTraceSamplePercent / 100)
      + healthySpansPerDay * healthyTraceSamplePercent / 100;

    const rawLogsGib = rawLogsPerDay * workload.bytesPerLog / BYTES_PER_GIB;
    const keptLogsGib = keptLogsPerDay * workload.bytesPerLog / BYTES_PER_GIB;
    const rawSpansGib = rawSpansPerDay * workload.bytesPerSpan / BYTES_PER_GIB;
    const indexedSpansGib = indexedSpansPerDay * workload.bytesPerSpan / BYTES_PER_GIB;
    const logFailureCoverage = policy.retainFailureLogs ? 100 : healthyLogRetentionPercent;
    const traceFailureCoverage = policy.retainFailureTraces ? 100 : healthyTraceSamplePercent;
    const weakestFailureCoverage = Math.min(logFailureCoverage, traceFailureCoverage);

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'Failures stay searchable while routine traffic is reduced';
    let detail = 'The policy keeps every modeled failure log and trace, then samples healthy traffic independently.';

    if (weakestFailureCoverage < 20) {
      tone = 'rose';
      verdict = 'The policy discards most failure evidence';
      detail = 'Uniform sampling treats rare failures like routine traffic. Preserve error and high-latency paths before reducing healthy events.';
    } else if (weakestFailureCoverage < 100) {
      tone = 'amber';
      verdict = 'Failure investigations now depend on chance';
      detail = 'Some incidents will have neither a retained log trail nor a complete trace. Add outcome-aware retention before lowering routine sampling further.';
    } else if (healthyLogRetentionPercent > 75 && healthyTraceSamplePercent > 75) {
      tone = 'amber';
      verdict = 'Coverage is broad, but little volume is removed';
      detail = 'Keep this only when the investigation value justifies the retained volume. Otherwise reduce routine traffic while protecting failures.';
    }

    return {
      detail,
      indexedSpansGib,
      indexedSpansPerDay,
      keptLogsGib,
      keptLogsPerDay,
      logFailureCoverage,
      rawLogsGib,
      rawSpansGib,
      tone,
      traceFailureCoverage,
      verdict,
    };
  }, [healthyLogRetentionPercent, healthyTraceSamplePercent, policy, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setRetentionPolicyId(data.defaults.retentionPolicyId);
    setHealthyLogRetentionPercent(data.defaults.healthyLogRetentionPercent);
    setHealthyTraceSamplePercent(data.defaults.healthyTraceSamplePercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Telemetry policy lab"
          title={data.title}
          description={data.description}
          icon={SlidersHorizontal}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Traffic shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Activity}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Failure policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.retentionPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent="violet"
                      onClick={() => setRetentionPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Routine logs retained"
                value={healthyLogRetentionPercent}
                output={`${healthyLogRetentionPercent}%`}
                {...data.bounds.healthyLogRetentionPercent}
                accent="amber"
                lowLabel="Small searchable set"
                highLabel="Keep every log"
                onChange={setHealthyLogRetentionPercent}
              />

              <LabRange
                label="Healthy traces indexed"
                value={healthyTraceSamplePercent}
                output={`${healthyTraceSamplePercent}%`}
                {...data.bounds.healthyTraceSamplePercent}
                accent="cyan"
                lowLabel="Trend sample"
                highLabel="Every trace"
                onChange={setHealthyTraceSamplePercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Retained logs"
                value={formatGib(result.keptLogsGib)}
                detail={`${formatCompact(result.keptLogsPerDay)} events/day`}
                icon={FileText}
                tone="amber"
              />
              <LabMetric
                label="Indexed spans"
                value={formatGib(result.indexedSpansGib)}
                detail={`${formatCompact(result.indexedSpansPerDay)} spans/day`}
                icon={Network}
                tone="cyan"
              />
              <LabMetric
                label="Failure logs"
                value={`${result.logFailureCoverage}%`}
                detail="Modeled evidence retained"
                icon={Database}
                tone={result.logFailureCoverage === 100 ? 'emerald' : result.logFailureCoverage >= 20 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Failure traces"
                value={`${result.traceFailureCoverage}%`}
                detail="Modeled traces indexed"
                icon={Activity}
                tone={result.traceFailureCoverage === 100 ? 'emerald' : result.traceFailureCoverage >= 20 ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Telemetry retention arithmetic" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Policy output
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                Compare raw volume with searchable evidence
              </h4>
              <div className="mt-5 space-y-5">
                <RetentionRow
                  label="Logs"
                  kept={result.keptLogsGib}
                  raw={result.rawLogsGib}
                  tone="bg-amber-500"
                />
                <RetentionRow
                  label="Trace spans"
                  kept={result.indexedSpansGib}
                  raw={result.rawSpansGib}
                  tone="bg-cyan-500"
                />
              </div>
              <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Raw and retained byte estimates use the selected event sizes. They are planning arithmetic, not a Datadog price or backend compression claim.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RetentionRow({
  label,
  kept,
  raw,
  tone,
}: {
  label: string;
  kept: number;
  raw: number;
  tone: string;
}) {
  const percent = raw > 0 ? kept / raw * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-neutral-800 dark:text-neutral-100">{label}</span>
        <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-300">
          {formatGib(kept)} of {formatGib(raw)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(1, percent)}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {percent.toFixed(1)}% retained
      </p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      Loading telemetry decision model...
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <p className="font-semibold">Telemetry decision model unavailable</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
