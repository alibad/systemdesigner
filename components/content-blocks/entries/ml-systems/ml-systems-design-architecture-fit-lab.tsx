'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  Server,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ml-systems-design/data/architecture-fit-lab.json';
const FRESHNESS_OPTIONS = [1, 5, 30, 300, 900, 3600, 21600, 43200, 86400] as const;

type Workload = {
  id: string;
  label: string;
  detail: string;
  defaultFreshnessSeconds: number;
  defaultPeakQps: number;
  stakes: string;
};

type Mode = {
  id: 'batch' | 'online' | 'hybrid';
  label: string;
  detail: string;
  predictionAgeSeconds: number;
  baseLatencyMs: number;
  qpsPerReplica: number;
  opsScore: number;
  path: string[];
};

type LabData = {
  title: string;
  description: string;
  defaults: { workloadId: string; modeId: Mode['id'] };
  workloads: Workload[];
  modes: Mode[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      typeof data.defaults.workloadId === 'string' &&
      ['batch', 'online', 'hybrid'].includes(data.defaults.modeId) &&
      Array.isArray(data.workloads) &&
      data.workloads.length >= 3 &&
      Array.isArray(data.modes) &&
      data.modes.length === 3 &&
      data.modes.every((mode) =>
        mode &&
        ['batch', 'online', 'hybrid'].includes(mode.id) &&
        Array.isArray(mode.path) &&
        mode.path.length === 4,
      ),
  );
}

function formatFreshness(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} hr`;
}

function recommendedMode(freshnessSeconds: number): Mode['id'] {
  if (freshnessSeconds <= 2) return 'online';
  if (freshnessSeconds <= 900) return 'hybrid';
  return 'batch';
}

function closestFreshnessIndex(seconds: number) {
  return FRESHNESS_OPTIONS.reduce(
    (bestIndex, option, index) =>
      Math.abs(option - seconds) < Math.abs(FRESHNESS_OPTIONS[bestIndex] - seconds)
        ? index
        : bestIndex,
    0,
  );
}

export default function MlSystemsDesignArchitectureFitLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState<string | null>(null);
  const [modeId, setModeId] = useState<Mode['id'] | null>(null);
  const [freshnessIndex, setFreshnessIndex] = useState<number | null>(null);
  const [peakQps, setPeakQps] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The architecture lab data is invalid.');
        const workload =
          value.workloads.find((item) => item.id === value.defaults.workloadId) ??
          value.workloads[0];
        setData(value);
        setWorkloadId(workload.id);
        setModeId(value.defaults.modeId);
        setFreshnessIndex(closestFreshnessIndex(workload.defaultFreshnessSeconds));
        setPeakQps(workload.defaultPeakQps);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data || !workloadId || !modeId || freshnessIndex === null || peakQps === null) {
      return null;
    }
    const freshnessSeconds = FRESHNESS_OPTIONS[freshnessIndex];
    const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];
    const recommendation = recommendedMode(freshnessSeconds);
    const replicas = Math.max(1, Math.ceil(peakQps / (mode.qpsPerReplica * 0.65)));
    const utilization = Math.min(99, (peakQps / (replicas * mode.qpsPerReplica)) * 100);
    const queuePenalty = Math.max(0, utilization - 65) * 0.75;
    const p95LatencyMs = Math.round(mode.baseLatencyMs + queuePenalty);
    const freshnessRatio = mode.predictionAgeSeconds / Math.max(1, freshnessSeconds);
    const freshnessFits = freshnessRatio <= 1;
    const selectedFits = recommendation === mode.id && freshnessFits;
    const fitScore = Math.max(
      12,
      Math.min(
        100,
        Math.round(
          100 -
            Math.max(0, freshnessRatio - 1) * 34 -
            (recommendation === mode.id ? 0 : 22) -
            Math.max(0, utilization - 80),
        ),
      ),
    );
    const headline = selectedFits
      ? `${mode.label} fits the decision contract.`
      : !freshnessFits
        ? `${mode.label} produces predictions that are too stale.`
        : `${data.modes.find((item) => item.id === recommendation)?.label} is a better starting point.`;

    return {
      workload,
      mode,
      recommendation,
      replicas,
      utilization,
      p95LatencyMs,
      freshnessFits,
      selectedFits,
      fitScore,
      headline,
    };
  }, [data, freshnessIndex, modeId, peakQps, workloadId]);

  const chooseWorkload = (workload: Workload) => {
    setWorkloadId(workload.id);
    setFreshnessIndex(closestFreshnessIndex(workload.defaultFreshnessSeconds));
    setPeakQps(workload.defaultPeakQps);
    setModeId(recommendedMode(workload.defaultFreshnessSeconds));
  };

  const reset = () => {
    if (!data) return;
    const workload =
      data.workloads.find((item) => item.id === data.defaults.workloadId) ?? data.workloads[0];
    setWorkloadId(workload.id);
    setModeId(data.defaults.modeId);
    setFreshnessIndex(closestFreshnessIndex(workload.defaultFreshnessSeconds));
    setPeakQps(workload.defaultPeakQps);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result || freshnessIndex === null || peakQps === null) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading architecture fit lab"
      />
    );
  }

  const statusClass = result.selectedFits
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40';
  const StatusIcon = result.selectedFits ? CheckCircle2 : TriangleAlert;
  const freshnessSeconds = FRESHNESS_OPTIONS[freshnessIndex];

  return (
    <div data-content-block="ml-systems/ml-systems-design-architecture-fit-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Architecture decision lab"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product decision
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workloadId === workload.id}
                      label={workload.label}
                      detail={workload.detail}
                      icon={Gauge}
                      accent="blue"
                      onClick={() => chooseWorkload(workload)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inference pattern
                </legend>
                <div className="mt-3 space-y-2">
                  {data.modes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={modeId === mode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={mode.id === 'batch' ? Boxes : mode.id === 'online' ? Server : Layers3}
                      accent={mode.id === 'batch' ? 'emerald' : mode.id === 'online' ? 'blue' : 'violet'}
                      onClick={() => setModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Operating pressure
                </legend>
                <LabRange
                  label="Maximum prediction age"
                  value={freshnessIndex}
                  output={formatFreshness(freshnessSeconds)}
                  min={0}
                  max={FRESHNESS_OPTIONS.length - 1}
                  step={1}
                  accent="amber"
                  lowLabel="Live context"
                  highLabel="One day"
                  onChange={setFreshnessIndex}
                />
                <LabRange
                  label="Peak request rate"
                  value={peakQps}
                  output={`${peakQps.toLocaleString()} QPS`}
                  min={20}
                  max={12000}
                  step={20}
                  accent="cyan"
                  lowLabel="Small workload"
                  highLabel="Large peak"
                  onChange={setPeakQps}
                />
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className={`rounded-md border p-4 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-neutral-800 dark:text-neutral-100"
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {result.headline}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    Recommended starting point:{' '}
                    <strong>
                      {data.modes.find((mode) => mode.id === result.recommendation)?.label}
                    </strong>
                    . {result.workload.stakes}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Architecture fit"
                value={`${result.fitScore}/100`}
                detail={result.selectedFits ? 'Meets modeled constraints' : 'Review the selected path'}
                icon={Gauge}
                tone={result.fitScore >= 80 ? 'emerald' : result.fitScore >= 55 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Prediction age"
                value={formatFreshness(result.mode.predictionAgeSeconds)}
                detail={`${formatFreshness(freshnessSeconds)} maximum`}
                icon={Clock3}
                tone={result.freshnessFits ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled p95"
                value={`${result.p95LatencyMs} ms`}
                detail={`${result.utilization.toFixed(0)}% peak utilization`}
                icon={Gauge}
                tone={result.utilization > 80 ? 'amber' : 'cyan'}
              />
              <LabMetric
                label="Serving replicas"
                value={result.replicas.toLocaleString()}
                detail={`Operations level ${result.mode.opsScore} of 4`}
                icon={Server}
                tone="violet"
              />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Active decision path
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                {result.mode.path.map((node, index) => (
                  <div key={node} className="contents">
                    <div className="min-h-16 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-3 text-center text-sm font-semibold text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100">
                      {node}
                    </div>
                    {index < result.mode.path.length - 1 ? (
                      <>
                        <ArrowDown aria-hidden="true" className="mx-auto h-4 w-4 shrink-0 text-blue-500 md:hidden" />
                        <ArrowRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-blue-500 md:block" />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
