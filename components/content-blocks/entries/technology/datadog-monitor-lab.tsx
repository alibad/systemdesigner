'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cloud,
  Radio,
  Timer,
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
type StreamProfile = {
  id: string;
  label: string;
  detail: string;
  reportIntervalSeconds: number;
  ingestionDelaySeconds: number;
  incidentStartedSecondsAgo: number;
  baselineValue: number;
  incidentValue: number;
  threshold: number;
};
type WindowPolicy = {
  id: string;
  label: string;
  detail: string;
  requireFullWindow: boolean;
};
type MonitorData = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    windowPolicyId: string;
    windowMinutes: number;
    evaluationDelaySeconds: number;
  };
  bounds: {
    windowMinutes: Bound;
    evaluationDelaySeconds: Bound;
  };
  profiles: StreamProfile[];
  windowPolicies: WindowPolicy[];
};

type BucketState = 'empty' | 'normal' | 'breach';
type MonitorStatus = 'alert' | 'ok' | 'no-data' | 'waiting';

const BLOCK_ID = 'technology/datadog-monitor-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isMonitorData(value: unknown): value is MonitorData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MonitorData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.profileId
      && candidate.defaults.windowPolicyId
      && typeof candidate.defaults.windowMinutes === 'number'
      && typeof candidate.defaults.evaluationDelaySeconds === 'number'
      && isBound(candidate.bounds?.windowMinutes)
      && isBound(candidate.bounds?.evaluationDelaySeconds)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && Array.isArray(candidate.windowPolicies)
      && candidate.windowPolicies.length > 0,
  );
}

function formatDuration(seconds: number) {
  if (seconds === 0) return 'None';
  if (seconds < 60) return `${seconds}s`;
  return `${seconds / 60}m`;
}

export default function DatadogMonitorLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No monitor evaluation model was supplied.');
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
        if (!isMonitorData(payload)) throw new Error('The monitor evaluation model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the monitor lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <MonitorEvaluationLab data={data} />;
}

function MonitorEvaluationLab({ data }: { data: MonitorData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [windowPolicyId, setWindowPolicyId] = useState(data.defaults.windowPolicyId);
  const [windowMinutes, setWindowMinutes] = useState(data.defaults.windowMinutes);
  const [evaluationDelaySeconds, setEvaluationDelaySeconds] = useState(
    data.defaults.evaluationDelaySeconds,
  );

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const policy = data.windowPolicies.find((item) => item.id === windowPolicyId)
    ?? data.windowPolicies[0];

  const result = useMemo(() => {
    const windowSeconds = windowMinutes * 60;
    const bucketCount = windowMinutes;
    const bucketValues: number[][] = Array.from({ length: bucketCount }, () => []);
    const oldestAge = evaluationDelaySeconds + windowSeconds;

    for (
      let age = profile.reportIntervalSeconds;
      age <= oldestAge;
      age += profile.reportIntervalSeconds
    ) {
      const inWindow = age > evaluationDelaySeconds && age <= oldestAge;
      const hasArrived = age >= profile.ingestionDelaySeconds;
      if (!inWindow || !hasArrived) continue;

      const bucketIndex = Math.min(
        bucketCount - 1,
        Math.floor((age - evaluationDelaySeconds - 1) / 60),
      );
      const value = age <= profile.incidentStartedSecondsAgo
        ? profile.incidentValue
        : profile.baselineValue;
      bucketValues[bucketIndex].push(value);
    }

    const populatedBuckets = bucketValues.filter((bucket) => bucket.length > 0);
    const missingBuckets = bucketCount - populatedBuckets.length;
    const oldestBucketPresent = bucketValues[bucketCount - 1]?.length > 0;
    const fullWindow = oldestBucketPresent && missingBuckets <= 3;
    const values = bucketValues.flat();
    const evaluatedValue = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;

    let status: MonitorStatus;
    let title: string;
    let detail: string;

    if (values.length === 0) {
      status = 'no-data';
      title = 'No data is available in the evaluated window';
      detail = 'The selected time range is newer than the stream has delivered. Shift evaluation into the past or use a longer window.';
    } else if (policy.requireFullWindow && !fullWindow) {
      status = 'waiting';
      title = 'Evaluation is canceled while the full window is incomplete';
      detail = `The oldest minute has ${oldestBucketPresent ? 'data' : 'no data'} and ${missingBuckets} of ${bucketCount} minute buckets are empty.`;
    } else if (evaluatedValue !== null && evaluatedValue >= profile.threshold) {
      status = 'alert';
      title = 'The monitor evaluates to ALERT';
      detail = 'Enough arrived points are above the threshold. The evaluation delay reduces missing data but adds the same delay to detection.';
    } else {
      status = 'ok';
      title = 'The monitor evaluates to OK';
      detail = evaluatedValue === null
        ? 'No value was calculated.'
        : 'The arrived points average below the threshold. Check whether the delay shifted the window before the incident.';
    }

    const buckets: BucketState[] = bucketValues
      .map((bucket) => {
        if (bucket.length === 0) return 'empty';
        const average = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
        return average >= profile.threshold ? 'breach' : 'normal';
      })
      .reverse();

    return {
      buckets,
      detail,
      evaluatedValue,
      fullWindow,
      missingBuckets,
      status,
      title,
      visiblePoints: values.length,
    };
  }, [evaluationDelaySeconds, policy.requireFullWindow, profile, windowMinutes]);

  function reset() {
    setProfileId(data.defaults.profileId);
    setWindowPolicyId(data.defaults.windowPolicyId);
    setWindowMinutes(data.defaults.windowMinutes);
    setEvaluationDelaySeconds(data.defaults.evaluationDelaySeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Monitor evaluation lab"
          title={data.title}
          description={data.description}
          icon={BellRing}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Signal stream
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'cloud-crawler' ? Cloud : Radio}
                      accent="blue"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Evaluation window"
                value={windowMinutes}
                output={`${windowMinutes}m`}
                {...data.bounds.windowMinutes}
                accent="violet"
                lowLabel="Fast response"
                highLabel="More evidence"
                onChange={setWindowMinutes}
              />

              <LabRange
                label="Evaluation delay"
                value={evaluationDelaySeconds}
                output={formatDuration(evaluationDelaySeconds)}
                {...data.bounds.evaluationDelaySeconds}
                accent="amber"
                lowLabel="Evaluate now"
                highLabel="Wait for late points"
                onChange={setEvaluationDelaySeconds}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Window policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.windowPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Timer}
                      accent="cyan"
                      onClick={() => setWindowPolicyId(item.id)}
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
                label="Monitor state"
                value={statusLabel(result.status)}
                detail={`Threshold ${profile.threshold}%`}
                icon={Activity}
                tone={statusTone(result.status)}
              />
              <LabMetric
                label="Evaluated value"
                value={result.evaluatedValue === null ? '—' : `${result.evaluatedValue.toFixed(1)}%`}
                detail={`${result.visiblePoints} arrived points`}
                icon={Radio}
                tone="blue"
              />
              <LabMetric
                label="Missing buckets"
                value={`${result.missingBuckets}/${windowMinutes}`}
                detail={result.fullWindow ? 'Full-window test passes' : 'Window is incomplete'}
                icon={CircleAlert}
                tone={result.fullWindow ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Detection delay"
                value={formatDuration(evaluationDelaySeconds)}
                detail={`Stream arrival lag ${formatDuration(profile.ingestionDelaySeconds)}`}
                icon={Clock3}
                tone={evaluationDelaySeconds >= profile.ingestionDelaySeconds ? 'amber' : 'neutral'}
              />
            </div>

            <section className={`rounded-md border p-4 ${statusPanel(result.status)}`}>
              <div className="flex items-start gap-3">
                {result.status === 'ok' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">{result.title}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evaluated minute buckets
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Oldest on the left, newest on the right
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Report every {formatDuration(profile.reportIntervalSeconds)}
                </p>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10" role="img" aria-label={`${result.missingBuckets} empty minute buckets in the selected evaluation window`}>
                {result.buckets.map((bucket, index) => (
                  <div
                    key={`${bucket}-${index}`}
                    className={`h-9 rounded-sm border ${bucketStyle(bucket)}`}
                    title={`${windowMinutes - index} minute bucket: ${bucket}`}
                  >
                    <span className="sr-only">{bucket}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                <Legend swatch="bg-emerald-500" label="Below threshold" />
                <Legend swatch="bg-rose-500" label="At or above threshold" />
                <Legend swatch="border border-dashed border-neutral-400 bg-transparent" label="No arrived point" />
              </div>
              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                This deterministic teaching model uses one-minute buckets, matching Datadog's documented bucket size for minute-based monitor windows. It does not reproduce every backend aggregation rule.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function statusLabel(status: MonitorStatus) {
  if (status === 'no-data') return 'NO DATA';
  if (status === 'waiting') return 'WAITING';
  return status.toUpperCase();
}

function statusTone(status: MonitorStatus): 'emerald' | 'amber' | 'rose' | 'blue' {
  if (status === 'ok') return 'emerald';
  if (status === 'alert') return 'rose';
  if (status === 'waiting') return 'amber';
  return 'blue';
}

function statusPanel(status: MonitorStatus) {
  if (status === 'ok') return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  if (status === 'alert') return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
  if (status === 'waiting') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  return 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100';
}

function bucketStyle(bucket: BucketState) {
  if (bucket === 'normal') return 'border-emerald-500 bg-emerald-500';
  if (bucket === 'breach') return 'border-rose-500 bg-rose-500';
  return 'border-dashed border-neutral-400 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900';
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      Loading monitor evaluation model...
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <p className="font-semibold">Monitor evaluation model unavailable</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}
