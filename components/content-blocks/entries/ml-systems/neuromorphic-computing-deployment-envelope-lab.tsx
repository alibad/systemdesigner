'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  Gauge,
  GitBranch,
  RadioTower,
  ShieldAlert,
  Waves,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/neuromorphic-computing-deployment-envelope-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/neuromorphic-computing/data/deployment-envelope-model.json';

type Workload = {
  id: string;
  label: string;
  detail: string;
  denseEquivalentOpsPerSecond: number;
  deadlineMs: number;
  baselineQuality: number;
  qualityFloor: number;
  defaultActivityPercent: number;
};

type Architecture = {
  id: string;
  label: string;
  detail: string;
  mode: 'event' | 'hybrid' | 'dense';
  capacityUnitsPerSecond: number;
  minimumActivityShare: number;
  workMultiplier: number;
  baseLatencyMs: number;
  conversionLatencyMs: number;
  fixedEnergyIndex: number;
  dynamicEnergyIndex: number;
  qualityPenalty: number;
};

type Disturbance = {
  id: string;
  label: string;
  detail: string;
  activityMultiplier: number;
  qualityPenalty: number;
  latencyPenaltyMs: number;
};

type DeploymentData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    architectureId: string;
    disturbanceId: string;
    activityPercent: number;
  };
  workloads: Workload[];
  architectures: Architecture[];
  disturbances: Disturbance[];
};

function isDeploymentData(value: unknown): value is DeploymentData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<DeploymentData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      data.defaults &&
      Array.isArray(data.workloads) &&
      data.workloads.length >= 3 &&
      data.workloads.every(
        (workload) =>
          typeof workload.id === 'string' &&
          typeof workload.denseEquivalentOpsPerSecond === 'number' &&
          typeof workload.deadlineMs === 'number',
      ) &&
      Array.isArray(data.architectures) &&
      data.architectures.length >= 4 &&
      data.architectures.every(
        (architecture) =>
          typeof architecture.id === 'string' &&
          typeof architecture.capacityUnitsPerSecond === 'number' &&
          ['event', 'hybrid', 'dense'].includes(architecture.mode),
      ) &&
      Array.isArray(data.disturbances) &&
      data.disturbances.length >= 3,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRate(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M/s`;
  return `${Math.round(value / 1_000)}k/s`;
}

function LabState({ blockId, error }: { blockId: string; error?: string }) {
  return (
    <div data-content-block={blockId}>
      <div
        className={`not-prose my-7 min-h-[640px] rounded-lg border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        aria-label={error ? 'Deployment envelope lab unavailable' : 'Loading deployment envelope lab'}
        role={error ? 'alert' : undefined}
      >
        {error ? (
          <>
            <p className="font-semibold">Deployment envelope lab unavailable</p>
            <p className="mt-2 opacity-80">{error}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BoundaryBar({
  label,
  value,
  boundary,
  unit,
  lowerIsBetter,
}: {
  label: string;
  value: number;
  boundary: number;
  unit: string;
  lowerIsBetter: boolean;
}) {
  const scale = Math.max(value, boundary) * 1.2 || 1;
  const valueWidth = clamp((value / scale) * 100, 0, 100);
  const boundaryPosition = clamp((boundary / scale) * 100, 0, 100);
  const passes = lowerIsBetter ? value <= boundary : value >= boundary;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
        <span className={passes ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
          {value.toFixed(1)}{unit} / {boundary}{unit}
        </span>
      </div>
      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
            passes ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          style={{ width: `${valueWidth}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-neutral-950 dark:bg-white"
          style={{ left: `${boundaryPosition}%` }}
        />
      </div>
    </div>
  );
}

export default function NeuromorphicComputingDeploymentEnvelopeLab({
  blockId = BLOCK_ID,
  dataFile = DEFAULT_DATA_FILE,
}: {
  blockId?: string;
  dataFile?: string;
}) {
  const [data, setData] = useState<DeploymentData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState('event-gesture');
  const [architectureId, setArchitectureId] = useState('native-event');
  const [disturbanceId, setDisturbanceId] = useState('nominal');
  const [activityPercent, setActivityPercent] = useState(18);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isDeploymentData(value)) {
          throw new Error('The deployment data does not match the expected contract.');
        }
        setData(value);
        setWorkloadId(value.defaults.workloadId);
        setArchitectureId(value.defaults.architectureId);
        setDisturbanceId(value.defaults.disturbanceId);
        setActivityPercent(value.defaults.activityPercent);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the deployment model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const architecture =
      data.architectures.find((item) => item.id === architectureId) ?? data.architectures[0];
    const disturbance =
      data.disturbances.find((item) => item.id === disturbanceId) ?? data.disturbances[0];
    if (!workload || !architecture || !disturbance) return null;

    const observedActivityShare = clamp(
      (activityPercent / 100) * disturbance.activityMultiplier,
      0,
      3.2,
    );
    const executionShare =
      architecture.mode === 'dense'
        ? 1
        : Math.max(observedActivityShare, architecture.minimumActivityShare);
    const routedWork =
      workload.denseEquivalentOpsPerSecond * executionShare * architecture.workMultiplier;
    const utilization = routedWork / architecture.capacityUnitsPerSecond;
    const queueLatencyMs =
      utilization <= 0.7
        ? utilization * 2
        : utilization <= 1
          ? 1.4 + (utilization - 0.7) * 20
          : 7.4 + (utilization - 1) * 55;
    const droppedShare =
      utilization <= 1
        ? 0
        : ((routedWork - architecture.capacityUnitsPerSecond) / routedWork) * 100;
    const latencyMs =
      architecture.baseLatencyMs +
      architecture.conversionLatencyMs +
      disturbance.latencyPenaltyMs +
      queueLatencyMs;
    const quality = clamp(
      workload.baselineQuality -
        architecture.qualityPenalty -
        disturbance.qualityPenalty -
        droppedShare * 0.3,
      0,
      100,
    );
    const energyIndex = clamp(
      architecture.fixedEnergyIndex +
        architecture.dynamicEnergyIndex * Math.min(utilization, 1.8) +
        Math.max(0, disturbance.activityMultiplier - 1) * 4,
      0,
      180,
    );
    const capacityPass = utilization <= 1;
    const latencyPass = latencyMs <= workload.deadlineMs;
    const qualityPass = quality >= workload.qualityFloor;
    const fits = capacityPass && latencyPass && qualityPass;

    let recommendation: string;
    if (fits) {
      recommendation =
        architecture.mode === 'dense'
          ? 'The dense baseline fits. Keep it as the comparison floor; specialized hardware still needs measured end-to-end evidence to replace it.'
          : 'The modeled path fits all three boundaries. Qualify it on target hardware across nominal, burst, and recovery traces before promotion.';
    } else if (!capacityPass) {
      recommendation =
        'Routing or execution capacity is exceeded. Filter noise earlier, reduce fan-out, repartition the network, or fall back before event loss becomes silent quality drift.';
    } else if (!qualityPass) {
      recommendation =
        'The path meets capacity but misses the task-quality floor. Use a hybrid back end, retrain with hardware constraints, or reject the mapping.';
    } else {
      recommendation =
        'The path misses the latency deadline. Remove format conversions, reduce sequential stages, or choose a simpler bounded fallback.';
    }

    return {
      architecture,
      capacityPass,
      disturbance,
      droppedShare,
      energyIndex,
      executionShare,
      fits,
      latencyMs,
      latencyPass,
      quality,
      qualityPass,
      recommendation,
      routedWork,
      utilization,
      workload,
    };
  }, [activityPercent, architectureId, data, disturbanceId, workloadId]);

  if (loadError) return <LabState blockId={blockId} error={loadError} />;
  if (!data) return <LabState blockId={blockId} />;
  if (!model) {
    return (
      <LabState
        blockId={blockId}
        error="The selected workload, architecture, or disturbance is missing."
      />
    );
  }

  const OutcomeIcon = model.fits ? CheckCircle2 : ShieldAlert;

  return (
    <div data-content-block={blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Deployment envelope lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="violet"
          onReset={() => {
            setWorkloadId(data.defaults.workloadId);
            setArchitectureId(data.defaults.architectureId);
            setDisturbanceId(data.defaults.disturbanceId);
            setActivityPercent(data.defaults.activityPercent);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={workload.id === model.workload.id}
                      label={workload.label}
                      detail={workload.detail}
                      icon={Activity}
                      accent="blue"
                      onClick={() => {
                        setWorkloadId(workload.id);
                        setActivityPercent(workload.defaultActivityPercent);
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution path
                </legend>
                <div className="mt-3 space-y-2">
                  {data.architectures.map((architecture) => (
                    <LabChoice
                      key={architecture.id}
                      selected={architecture.id === model.architecture.id}
                      label={architecture.label}
                      detail={architecture.detail}
                      icon={Cpu}
                      accent="violet"
                      onClick={() => setArchitectureId(architecture.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Disturbance
                </legend>
                <div className="mt-3 space-y-2">
                  {data.disturbances.map((disturbance) => (
                    <LabChoice
                      key={disturbance.id}
                      selected={disturbance.id === model.disturbance.id}
                      label={disturbance.label}
                      detail={disturbance.detail}
                      icon={disturbance.id === 'nominal' ? Waves : AlertTriangle}
                      accent={disturbance.id === 'nominal' ? 'emerald' : 'rose'}
                      onClick={() => setDisturbanceId(disturbance.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Observed activity"
                value={activityPercent}
                output={`${activityPercent}%`}
                min={4}
                max={100}
                step={2}
                accent="cyan"
                lowLabel="Sparse"
                highLabel="Dense"
                onChange={setActivityPercent}
              />
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                model.fits
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <OutcomeIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-70">Promotion decision</p>
                  <p className="mt-1 text-xl font-semibold">
                    {model.fits ? 'Inside the modeled envelope' : 'Hold or fall back'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{model.recommendation}</p>
                </div>
              </div>
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Boundary evidence
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
                    All three gates must pass for this modeled operating point.
                  </p>
                </div>
                <span className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {model.architecture.label}
                </span>
              </div>
              <div className="mt-5 space-y-5">
                <BoundaryBar
                  label="Routing utilization"
                  value={model.utilization * 100}
                  boundary={100}
                  unit="%"
                  lowerIsBetter
                />
                <BoundaryBar
                  label="End-to-end latency"
                  value={model.latencyMs}
                  boundary={model.workload.deadlineMs}
                  unit=" ms"
                  lowerIsBetter
                />
                <BoundaryBar
                  label="Task quality"
                  value={model.quality}
                  boundary={model.workload.qualityFloor}
                  unit="%"
                  lowerIsBetter={false}
                />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Routed work"
                value={formatRate(model.routedWork)}
                detail={`${Math.round(model.executionShare * 100)}% effective activity after path rules.`}
                icon={RadioTower}
                tone={model.capacityPass ? 'cyan' : 'rose'}
              />
              <LabMetric
                label="Latency"
                value={`${model.latencyMs.toFixed(1)} ms`}
                detail={`${model.workload.deadlineMs} ms workload deadline.`}
                icon={Clock3}
                tone={model.latencyPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Relative energy"
                value={`${Math.round(model.energyIndex)}`}
                detail="Planning index; dense baseline is approximately 100."
                icon={Zap}
                tone={model.energyIndex < 70 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Dropped work"
                value={`${model.droppedShare.toFixed(1)}%`}
                detail="Modeled overflow after the execution boundary."
                icon={Gauge}
                tone={model.droppedShare === 0 ? 'neutral' : 'rose'}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Capacity', pass: model.capacityPass },
                { label: 'Latency', pass: model.latencyPass },
                { label: 'Quality', pass: model.qualityPass },
              ].map((gate) => (
                <div
                  key={gate.label}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm font-semibold ${
                    gate.pass
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                  }`}
                >
                  {gate.pass ? (
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
                  )}
                  {gate.label}: {gate.pass ? 'pass' : 'fail'}
                </div>
              ))}
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Values are transparent planning assumptions, not measured hardware results. Replace capacity, conversion latency, quality penalties, and the relative-energy index with target-device traces collected at a matched task-quality boundary.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
