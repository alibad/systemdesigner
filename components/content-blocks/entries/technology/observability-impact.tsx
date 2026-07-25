'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleAlert,
  Database,
  FileText,
  Gauge,
  Network,
  WalletCards,
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

type Bound = { min: number; max: number; step: number };
type Workload = {
  id: string;
  label: string;
  detail: string;
  requestsPerSecond: number;
  services: number;
  spansPerTrace: number;
  errorPercent: number;
  monthlyBudgetUsd: number;
};
type MetricPolicy = {
  id: string;
  label: string;
  detail: string;
  seriesPerService: number;
  risk: 'bounded' | 'elevated' | 'unbounded';
};
type SamplingPolicy = {
  id: string;
  label: string;
  detail: string;
  retainAllErrors: boolean;
  bufferOverheadPercent: number;
};
type LogPolicy = {
  id: string;
  label: string;
  detail: string;
  eventsPerRequest: number;
  bytesPerEvent: number;
  diagnosticCoverage: number;
};
type BudgetData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    metricPolicyId: string;
    samplingPolicyId: string;
    logPolicyId: string;
    traceSamplePercent: number;
    retentionDays: number;
  };
  bounds: {
    traceSamplePercent: Bound;
    retentionDays: Bound;
  };
  assumptions: {
    scrapeIntervalSeconds: number;
    metricBytesPerSample: number;
    bytesPerSpan: number;
    ingestUsdPerGib: number;
    storageUsdPerGibMonth: number;
  };
  workloads: Workload[];
  metricPolicies: MetricPolicy[];
  samplingPolicies: SamplingPolicy[];
  logPolicies: LogPolicy[];
};

const BLOCK_ID = 'technology/observability-impact';
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GIB = 1024 ** 3;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isBudgetData(value: unknown): value is BudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.metricPolicyId
      && candidate.defaults.samplingPolicyId
      && candidate.defaults.logPolicyId
      && typeof candidate.defaults.traceSamplePercent === 'number'
      && typeof candidate.defaults.retentionDays === 'number'
      && isBound(candidate.bounds?.traceSamplePercent)
      && isBound(candidate.bounds?.retentionDays)
      && candidate.assumptions
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && Array.isArray(candidate.metricPolicies)
      && candidate.metricPolicies.length > 0
      && Array.isArray(candidate.samplingPolicies)
      && candidate.samplingPolicies.length > 0
      && Array.isArray(candidate.logPolicies)
      && candidate.logPolicies.length > 0,
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ObservabilityImpact({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No telemetry budget model was supplied.');
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
        if (!isBudgetData(payload)) throw new Error('The telemetry budget model is incomplete.');
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
  return <TelemetryBudgetWorkbench data={data} />;
}

function TelemetryBudgetWorkbench({ data }: { data: BudgetData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [metricPolicyId, setMetricPolicyId] = useState(data.defaults.metricPolicyId);
  const [samplingPolicyId, setSamplingPolicyId] = useState(data.defaults.samplingPolicyId);
  const [logPolicyId, setLogPolicyId] = useState(data.defaults.logPolicyId);
  const [traceSamplePercent, setTraceSamplePercent] = useState(data.defaults.traceSamplePercent);
  const [retentionDays, setRetentionDays] = useState(data.defaults.retentionDays);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const metricPolicy = data.metricPolicies.find((item) => item.id === metricPolicyId)
    ?? data.metricPolicies[0];
  const samplingPolicy = data.samplingPolicies.find((item) => item.id === samplingPolicyId)
    ?? data.samplingPolicies[0];
  const logPolicy = data.logPolicies.find((item) => item.id === logPolicyId) ?? data.logPolicies[0];

  const result = useMemo(() => {
    const metricSamplesPerSecond = workload.services
      * metricPolicy.seriesPerService
      / data.assumptions.scrapeIntervalSeconds;
    const healthyTraceRate = workload.requestsPerSecond
      * (1 - workload.errorPercent / 100)
      * traceSamplePercent
      / 100;
    const errorTraceRate = workload.requestsPerSecond
      * workload.errorPercent
      / 100
      * (samplingPolicy.retainAllErrors ? 1 : traceSamplePercent / 100);
    const tracesPerSecond = healthyTraceRate + errorTraceRate;
    const spansPerDay = tracesPerSecond * workload.spansPerTrace * SECONDS_PER_DAY;
    const logsPerSecond = workload.requestsPerSecond * logPolicy.eventsPerRequest;

    const metricsGibPerDay = metricSamplesPerSecond
      * SECONDS_PER_DAY
      * data.assumptions.metricBytesPerSample
      / BYTES_PER_GIB;
    const tracesGibPerDay = spansPerDay * data.assumptions.bytesPerSpan / BYTES_PER_GIB;
    const logsGibPerDay = logsPerSecond
      * SECONDS_PER_DAY
      * logPolicy.bytesPerEvent
      / BYTES_PER_GIB;
    const totalGibPerDay = metricsGibPerDay + tracesGibPerDay + logsGibPerDay;
    const retainedGib = totalGibPerDay * retentionDays;
    const monthlyCostUsd = totalGibPerDay * 30 * data.assumptions.ingestUsdPerGib
      + retainedGib * data.assumptions.storageUsdPerGibMonth;
    const failureCapturePercent = samplingPolicy.retainAllErrors ? 100 : traceSamplePercent;
    const budgetUsePercent = monthlyCostUsd / workload.monthlyBudgetUsd * 100;

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The signal plan stays inside its operating envelope';
    let detail = 'Cardinality is bounded, failure traces are retained, and modeled cost leaves room for incident bursts.';

    if (metricPolicy.risk === 'unbounded') {
      tone = 'rose';
      verdict = 'Unbounded labels make the metric plane unstable';
      detail = 'Request or customer identity multiplies active series. Move unique identifiers to traces or logs and keep metric dimensions bounded.';
    } else if (budgetUsePercent > 125) {
      tone = 'rose';
      verdict = 'The telemetry plan exceeds the monthly budget';
      detail = 'Reduce low-value event volume, shorten broad retention, or retain high-value failures selectively before removing critical evidence.';
    } else if (failureCapturePercent < 10) {
      tone = 'rose';
      verdict = 'Random sampling discards most failure evidence';
      detail = 'Use outcome-aware sampling for errors and slow traces, then sample healthy traffic to control volume.';
    } else if (budgetUsePercent > 85 || logPolicy.diagnosticCoverage < 70) {
      tone = 'amber';
      verdict = 'The plan needs an explicit compromise';
      detail = budgetUsePercent > 85
        ? 'Modeled steady-state cost leaves little room for traffic or incident bursts.'
        : 'Sparse logs control volume but may not preserve the local decisions needed after a trace identifies the failing service.';
    } else if (samplingPolicy.bufferOverheadPercent >= 8) {
      tone = 'amber';
      verdict = 'Coverage is strong, but tail sampling needs collector headroom';
      detail = 'Buffer complete traces in an isolated collector tier, cap memory, and expose refused or dropped spans.';
    }

    return {
      budgetUsePercent,
      detail,
      failureCapturePercent,
      logsGibPerDay,
      metricSamplesPerSecond,
      metricsGibPerDay,
      monthlyCostUsd,
      retainedGib,
      spansPerDay,
      tone,
      totalGibPerDay,
      tracesGibPerDay,
      verdict,
    };
  }, [
    data.assumptions,
    logPolicy,
    metricPolicy,
    retentionDays,
    samplingPolicy,
    traceSamplePercent,
    workload,
  ]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setMetricPolicyId(data.defaults.metricPolicyId);
    setSamplingPolicyId(data.defaults.samplingPolicyId);
    setLogPolicyId(data.defaults.logPolicyId);
    setTraceSamplePercent(data.defaults.traceSamplePercent);
    setRetentionDays(data.defaults.retentionDays);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Telemetry budget lab"
          title={data.title}
          description={data.description}
          icon={ChartNoAxesCombined}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Workload"
                items={data.workloads}
                selectedId={workload.id}
                icon={Activity}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Metric dimensions"
                items={data.metricPolicies}
                selectedId={metricPolicy.id}
                icon={Gauge}
                accent="violet"
                onSelect={setMetricPolicyId}
              />
              <ChoiceGroup
                label="3. Trace decision"
                items={data.samplingPolicies}
                selectedId={samplingPolicy.id}
                icon={Network}
                accent="cyan"
                onSelect={setSamplingPolicyId}
              />
              <LabRange
                label="Healthy trace sample"
                value={traceSamplePercent}
                output={`${traceSamplePercent}%`}
                {...data.bounds.traceSamplePercent}
                accent="cyan"
                lowLabel="Cost-first"
                highLabel="Coverage-first"
                onChange={setTraceSamplePercent}
              />
              <ChoiceGroup
                label="4. Log policy"
                items={data.logPolicies}
                selectedId={logPolicy.id}
                icon={FileText}
                accent="amber"
                onSelect={setLogPolicyId}
              />
              <LabRange
                label="Retention"
                value={retentionDays}
                output={`${retentionDays} days`}
                {...data.bounds.retentionDays}
                accent="violet"
                lowLabel="Short investigation window"
                highLabel="Long history"
                onChange={setRetentionDays}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Daily ingest"
                value={`${result.totalGibPerDay.toFixed(1)} GiB`}
                detail={`${retentionDays} day retention`}
                icon={Database}
                tone={result.totalGibPerDay < 250 ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Failure traces"
                value={`${result.failureCapturePercent.toFixed(0)}%`}
                detail="Modeled error-path capture"
                icon={Network}
                tone={result.failureCapturePercent >= 90 ? 'emerald' : result.failureCapturePercent >= 25 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Monthly model"
                value={formatUsd(result.monthlyCostUsd)}
                detail={`${result.budgetUsePercent.toFixed(0)}% of ${formatUsd(workload.monthlyBudgetUsd)} budget`}
                icon={WalletCards}
                tone={result.budgetUsePercent <= 85 ? 'emerald' : result.budgetUsePercent <= 125 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Active series"
                value={formatCompact(workload.services * metricPolicy.seriesPerService)}
                detail={`${formatCompact(result.metricSamplesPerSecond)} samples/sec`}
                icon={Gauge}
                tone={metricPolicy.risk === 'bounded' ? 'blue' : metricPolicy.risk === 'elevated' ? 'amber' : 'rose'}
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

            <section aria-label="Telemetry volume by signal" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Daily signal mix</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">See which policy consumes the budget</h4>
              <div className="mt-5 space-y-4">
                <VolumeRow label="Metrics" value={result.metricsGibPerDay} total={result.totalGibPerDay} tone="bg-blue-500" detail={`${formatCompact(result.metricSamplesPerSecond)} samples/sec`} />
                <VolumeRow label="Traces" value={result.tracesGibPerDay} total={result.totalGibPerDay} tone="bg-violet-500" detail={`${formatCompact(result.spansPerDay)} spans/day`} />
                <VolumeRow label="Logs" value={result.logsGibPerDay} total={result.totalGibPerDay} tone="bg-amber-500" detail={`${logPolicy.diagnosticCoverage}% diagnostic coverage`} />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Retained volume" value={`${(result.retainedGib / 1024).toFixed(2)} TiB`} detail="Before replication and backend index overhead" />
              <Fact label="Collector overhead" value={`${samplingPolicy.bufferOverheadPercent}%`} detail="Planning allowance for the sampling policy" />
              <Fact label="Metric risk" value={metricPolicy.risk} detail={`${metricPolicy.seriesPerService.toLocaleString()} series per service`} />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'cyan' | 'amber';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function VolumeRow({
  label,
  value,
  total,
  tone,
  detail,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
  detail: string;
}) {
  const width = Math.max(2, value / Math.max(total, 0.001) * 100);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-neutral-800 dark:text-neutral-100">{label}</span>
        <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-300">
          {value.toFixed(1)} GiB / {detail}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      Loading telemetry budget model...
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <p className="font-semibold">Telemetry budget model unavailable</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
