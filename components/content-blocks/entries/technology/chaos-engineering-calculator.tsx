'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  FlaskConical,
  Gauge,
  Network,
  ShieldAlert,
  ShieldCheck,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type MetricDirection = 'higher-is-healthier' | 'lower-is-healthier';

interface ExperimentMetric {
  id: string;
  label: string;
  unit: '%' | 'ms' | 's';
  direction: MetricDirection;
  baseline: number;
  hypothesisLimit: number;
  abortLimit: number;
  precision: number;
}

interface ExperimentFault {
  id: string;
  label: string;
  detail: string;
  impactByMetric: Record<string, number>;
}

interface ExperimentContractData {
  title: string;
  description: string;
  modelNotice: string;
  requestRatePerSecond: number;
  defaults: {
    metricId: string;
    faultId: string;
    blastRadiusPct: number;
    durationMinutes: number;
    automaticStop: boolean;
  };
  metrics: ExperimentMetric[];
  faults: ExperimentFault[];
}

const BLOCK_ID = 'technology/chaos-engineering-calculator';

function isExperimentContractData(value: unknown): value is ExperimentContractData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExperimentContractData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.modelNotice &&
      candidate.defaults &&
      typeof candidate.requestRatePerSecond === 'number' &&
      Array.isArray(candidate.metrics) &&
      candidate.metrics.length &&
      Array.isArray(candidate.faults) &&
      candidate.faults.length,
  );
}

export default function ChaosEngineeringCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ExperimentContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No experiment-contract model was supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isExperimentContractData(payload)) {
          throw new Error('The experiment-contract model is incomplete.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the experiment model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <BlockState title="Experiment lab unavailable" detail={error} />;
  if (!data) {
    return (
      <BlockState
        title="Loading experiment contract"
        detail="Preparing the hypothesis and safety boundaries..."
      />
    );
  }

  return <ExperimentContractLab data={data} />;
}

function ExperimentContractLab({ data }: { data: ExperimentContractData }) {
  const [metricId, setMetricId] = useState(data.defaults.metricId);
  const [faultId, setFaultId] = useState(data.defaults.faultId);
  const [blastRadiusPct, setBlastRadiusPct] = useState(data.defaults.blastRadiusPct);
  const [durationMinutes, setDurationMinutes] = useState(data.defaults.durationMinutes);
  const [automaticStop, setAutomaticStop] = useState(data.defaults.automaticStop);

  const metric = data.metrics.find((item) => item.id === metricId) ?? data.metrics[0];
  const fault = data.faults.find((item) => item.id === faultId) ?? data.faults[0];

  const result = useMemo(() => {
    const impact = fault.impactByMetric[metric.id] ?? 0;
    const severity = (blastRadiusPct / 10) * (0.75 + durationMinutes / 20);
    const signedImpact = impact * severity;
    const projected =
      metric.direction === 'higher-is-healthier'
        ? metric.baseline - signedImpact
        : metric.baseline + signedImpact;
    const boundedProjected =
      metric.unit === '%' ? Math.min(100, Math.max(0, projected)) : Math.max(0, projected);
    const hypothesisHolds = isInsideBoundary(
      boundedProjected,
      metric.hypothesisLimit,
      metric.direction,
    );
    const abortCrossed = !isInsideBoundary(
      boundedProjected,
      metric.abortLimit,
      metric.direction,
    );
    const exposedRequests = Math.round(
      data.requestRatePerSecond * durationMinutes * 60 * (blastRadiusPct / 100),
    );

    if (abortCrossed && automaticStop) {
      return {
        status: 'stopped' as const,
        title: 'The automatic stop condition contains the modeled run',
        detail:
          'The projected steady-state value crosses the abort boundary. The fault should stop, cleanup should run, and operators should verify recovery before another experiment.',
        projected: boundedProjected,
        exposedRequests,
        hypothesisHolds,
        abortCrossed,
      };
    }

    if (abortCrossed) {
      return {
        status: 'unsafe' as const,
        title: 'The modeled run exceeds its safety boundary',
        detail:
          'The abort threshold is crossed without an automatic stop. Manual observation is not a reliable guardrail for a time-sensitive customer impact.',
        projected: boundedProjected,
        exposedRequests,
        hypothesisHolds,
        abortCrossed,
      };
    }

    if (!hypothesisHolds) {
      return {
        status: 'learning' as const,
        title: 'The hypothesis is falsified inside the safety envelope',
        detail:
          'This is useful evidence: the system missed its declared steady state without crossing the abort boundary. Record the result, remediate the weakness, and rerun the same contract.',
        projected: boundedProjected,
        exposedRequests,
        hypothesisHolds,
        abortCrossed,
      };
    }

    return {
      status: 'held' as const,
      title: 'The hypothesis holds in this training model',
      detail:
        'The projected steady state remains inside both boundaries. This increases confidence only for the selected fault, scope, duration, and observed conditions.',
      projected: boundedProjected,
      exposedRequests,
      hypothesisHolds,
      abortCrossed,
    };
  }, [
    automaticStop,
    blastRadiusPct,
    data.requestRatePerSecond,
    durationMinutes,
    fault,
    metric,
  ]);

  const reset = () => {
    setMetricId(data.defaults.metricId);
    setFaultId(data.defaults.faultId);
    setBlastRadiusPct(data.defaults.blastRadiusPct);
    setDurationMinutes(data.defaults.durationMinutes);
    setAutomaticStop(data.defaults.automaticStop);
  };

  const statusClass =
    result.status === 'unsafe'
      ? dangerClass
      : result.status === 'learning' || result.status === 'stopped'
        ? warningClass
        : healthyClass;
  const StatusIcon =
    result.status === 'unsafe'
      ? ShieldAlert
      : result.status === 'held'
        ? CheckCircle2
        : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Experiment contract lab"
          title={data.title}
          description={data.description}
          icon={FlaskConical}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the steady state
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.metrics.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === metric.id}
                      label={item.label}
                      detail={`Baseline ${formatMetric(item.baseline, item)}`}
                      icon={Gauge}
                      accent="cyan"
                      onClick={() => setMetricId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Inject a realistic fault
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.faults.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === fault.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Network}
                      accent="rose"
                      onClick={() => setFaultId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Blast radius"
                value={blastRadiusPct}
                output={`${blastRadiusPct}%`}
                min={5}
                max={50}
                step={5}
                accent="amber"
                lowLabel="Small cohort"
                highLabel="Half of traffic"
                onChange={setBlastRadiusPct}
              />

              <LabRange
                label="Fault duration"
                value={durationMinutes}
                output={`${durationMinutes} min`}
                min={1}
                max={15}
                accent="violet"
                lowLabel="Brief pulse"
                highLabel="Sustained fault"
                onChange={setDurationMinutes}
              />

              <LabChoice
                selected={automaticStop}
                label="Automatic stop condition"
                detail="Stop the fault when the abort boundary is crossed; cleanup and recovery verification still remain required."
                icon={ShieldCheck}
                accent="emerald"
                onClick={() => setAutomaticStop((value) => !value)}
              />
            </div>
          }
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${statusClass}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Modeled decision</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Baseline"
                value={formatMetric(metric.baseline, metric)}
                detail="Normal measured behavior"
                icon={Activity}
                tone="neutral"
              />
              <LabMetric
                label="Projected steady state"
                value={formatMetric(result.projected, metric)}
                detail="Synthetic training consequence"
                icon={Gauge}
                tone={result.hypothesisHolds ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Hypothesis boundary"
                value={formatBoundary(metric.hypothesisLimit, metric)}
                detail="The claim the experiment tries to disprove"
                icon={Target}
                tone="cyan"
              />
              <LabMetric
                label="Abort boundary"
                value={formatBoundary(metric.abortLimit, metric)}
                detail={automaticStop ? 'Automatic stop enabled' : 'No automatic stop'}
                icon={ShieldAlert}
                tone={result.abortCrossed ? 'rose' : 'violet'}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stage
                icon={Target}
                label="Hypothesis"
                title={`${metric.label} stays ${boundaryWord(metric.direction)} ${formatMetric(
                  metric.hypothesisLimit,
                  metric,
                )}`}
                detail="A falsifiable system-output claim, not an internal component health check."
              />
              <Stage
                icon={Users}
                label="Exposure"
                title={`${result.exposedRequests.toLocaleString()} request opportunities`}
                detail={`${blastRadiusPct}% of a ${data.requestRatePerSecond.toLocaleString()} req/s training workload for ${durationMinutes} minutes.`}
              />
              <Stage
                icon={Clock}
                label="Recovery"
                title="Cleanup, observe, verify"
                detail="Removing the fault is not proof of recovery. Recheck the steady state and downstream queues."
              />
            </div>

            <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {data.modelNotice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function isInsideBoundary(value: number, limit: number, direction: MetricDirection) {
  return direction === 'higher-is-healthier' ? value >= limit : value <= limit;
}

function boundaryWord(direction: MetricDirection) {
  return direction === 'higher-is-healthier' ? 'at or above' : 'at or below';
}

function formatBoundary(value: number, metric: ExperimentMetric) {
  const comparator = metric.direction === 'higher-is-healthier' ? '≥' : '≤';
  return `${comparator} ${formatMetric(value, metric)}`;
}

function formatMetric(value: number, metric: ExperimentMetric) {
  return `${value.toFixed(metric.precision)}${metric.unit}`;
}

function Stage({
  icon: Icon,
  label,
  title,
  detail,
}: {
  icon: typeof Target;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-h-40 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">
        {title}
      </p>
      <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function BlockState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass =
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass =
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
const dangerClass =
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
