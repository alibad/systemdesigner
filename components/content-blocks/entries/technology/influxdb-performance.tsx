'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  Layers3,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type PlanningProfile = {
  id: string;
  label: string;
  detail: string;
  pointsPerSecond: number;
  retentionDays: number;
  bytesPerPoint: number;
  durableCopies: number;
  headroomPercent: number;
  storageBudgetTiB: number;
};

type CapacityPlanningModel = {
  note: string;
  constants: {
    secondsPerDay: number;
    bytesPerGiB: number;
    gibPerTiB: number;
  };
  bounds: {
    pointsPerSecond: Bound;
    retentionDays: Bound;
    bytesPerPoint: Bound;
    durableCopies: Bound;
    headroomPercent: Bound;
    storageBudgetTiB: Bound;
  };
  profiles: PlanningProfile[];
};

const DEFAULT_DATA_FILE =
  '/api/content/technology/influxdb/data/capacity-planning-model.json';

function isCapacityPlanningModel(value: unknown): value is CapacityPlanningModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityPlanningModel>;
  return Boolean(
    candidate.constants
      && candidate.bounds
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0,
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatStorage(gib: number) {
  if (gib >= 1024) {
    return `${(gib / 1024).toLocaleString('en-US', {
      maximumFractionDigits: gib >= 10_240 ? 1 : 2,
    })} TiB`;
  }

  return `${gib.toLocaleString('en-US', { maximumFractionDigits: 1 })} GiB`;
}

export default function InfluxDBPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityPlanningModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [pointsPerSecond, setPointsPerSecond] = useState(10_000);
  const [retentionDays, setRetentionDays] = useState(30);
  const [bytesPerPoint, setBytesPerPoint] = useState(48);
  const [durableCopies, setDurableCopies] = useState(2);
  const [headroomPercent, setHeadroomPercent] = useState(20);
  const [storageBudgetTiB, setStorageBudgetTiB] = useState(4);

  function applyProfile(profile: PlanningProfile) {
    setProfileId(profile.id);
    setPointsPerSecond(profile.pointsPerSecond);
    setRetentionDays(profile.retentionDays);
    setBytesPerPoint(profile.bytesPerPoint);
    setDurableCopies(profile.durableCopies);
    setHeadroomPercent(profile.headroomPercent);
    setStorageBudgetTiB(profile.storageBudgetTiB);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as unknown;
        if (!isCapacityPlanningModel(payload)) {
          throw new Error('The capacity planning model is incomplete.');
        }
        if (!active) return;
        setData(payload);
        applyProfile(payload.profiles[1] ?? payload.profiles[0]);
      } catch (loadError) {
        if (!active) return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the capacity planning model.',
        );
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;

    const pointsPerDay = pointsPerSecond * data.constants.secondsPerDay;
    const ingestMibPerSecond = (pointsPerSecond * bytesPerPoint) / 1024 ** 2;
    const logicalGibPerDay =
      (pointsPerDay * bytesPerPoint) / data.constants.bytesPerGiB;
    const retainedLogicalGib = logicalGibPerDay * retentionDays;
    const planningEnvelopeGib =
      retainedLogicalGib
      * durableCopies
      * (1 + headroomPercent / 100);
    const planningEnvelopeTiB =
      planningEnvelopeGib / data.constants.gibPerTiB;
    const budgetCoverage = planningEnvelopeTiB / storageBudgetTiB;

    if (budgetCoverage > 1) {
      return {
        pointsPerDay,
        ingestMibPerSecond,
        logicalGibPerDay,
        retainedLogicalGib,
        planningEnvelopeGib,
        budgetCoverage,
        status: 'Budget shortfall',
        tone: 'rose' as const,
        verdict: `The modeled envelope is ${formatStorage(
          planningEnvelopeGib - storageBudgetTiB * data.constants.gibPerTiB,
        )} above the stated budget. Shorten retention, reduce measured bytes per point, change the copy policy, or raise the budget before load testing.`,
      };
    }

    if (budgetCoverage > 0.8) {
      return {
        pointsPerDay,
        ingestMibPerSecond,
        logicalGibPerDay,
        retainedLogicalGib,
        planningEnvelopeGib,
        budgetCoverage,
        status: 'Thin budget margin',
        tone: 'amber' as const,
        verdict: `The planning envelope consumes ${Math.round(
          budgetCoverage * 100,
        )}% of the stated budget. Measure real stored bytes per point and transient compaction or WAL space before treating the remaining margin as usable.`,
      };
    }

    return {
      pointsPerDay,
      ingestMibPerSecond,
      logicalGibPerDay,
      retainedLogicalGib,
      planningEnvelopeGib,
      budgetCoverage,
      status: 'Fits the stated budget',
      tone: 'emerald' as const,
      verdict: `The modeled envelope consumes ${Math.round(
        budgetCoverage * 100,
      )}% of the stated budget. This is a planning bound, not a throughput or compression guarantee; validate it with representative writes and observed storage growth.`,
    };
  }, [
    bytesPerPoint,
    data,
    durableCopies,
    headroomPercent,
    pointsPerSecond,
    retentionDays,
    storageBudgetTiB,
  ]);

  function customize(update: () => void) {
    setProfileId('custom');
    update();
  }

  return (
    <div data-content-block="technology/influxdb-performance">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity planning lab"
          title="Turn a point stream into a storage envelope"
          description="Choose a starting workload, then expose every assumption. The model estimates logical retained bytes and a policy envelope; it does not predict compression, latency, RAM, or query speed."
          icon={Gauge}
          accent="cyan"
          onReset={
            data
              ? () => applyProfile(data.profiles[1] ?? data.profiles[0])
              : undefined
          }
        />

        {!data || !result ? (
          <LoadState
            error={error}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Editable starting points
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={
                          profile.id === 'sensor-fleet'
                            ? Activity
                            : profile.id === 'edge-pilot'
                              ? Boxes
                              : Database
                        }
                        accent="cyan"
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Point rate"
                  value={pointsPerSecond}
                  output={`${formatCount(pointsPerSecond)} points/s`}
                  {...data.bounds.pointsPerSecond}
                  accent="cyan"
                  lowLabel="Small stream"
                  highLabel="Dense stream"
                  onChange={(value) => customize(() => setPointsPerSecond(value))}
                />
                <LabRange
                  label="Raw retention"
                  value={retentionDays}
                  output={`${retentionDays} days`}
                  {...data.bounds.retentionDays}
                  accent="blue"
                  lowLabel="Short-lived"
                  highLabel="Long-lived"
                  onChange={(value) => customize(() => setRetentionDays(value))}
                />
                <LabRange
                  label="Observed bytes per point"
                  value={bytesPerPoint}
                  output={`${bytesPerPoint} B`}
                  {...data.bounds.bytesPerPoint}
                  accent="violet"
                  lowLabel="Compact point"
                  highLabel="Wide point"
                  onChange={(value) => customize(() => setBytesPerPoint(value))}
                />
                <LabRange
                  label="Modeled stored copies"
                  value={durableCopies}
                  output={`${durableCopies}`}
                  {...data.bounds.durableCopies}
                  accent="emerald"
                  lowLabel="One copy"
                  highLabel="Policy choice"
                  onChange={(value) => customize(() => setDurableCopies(value))}
                />
                <LabRange
                  label="Operational headroom"
                  value={headroomPercent}
                  output={`${headroomPercent}%`}
                  {...data.bounds.headroomPercent}
                  accent="amber"
                  lowLabel="No margin"
                  highLabel="Larger margin"
                  onChange={(value) => customize(() => setHeadroomPercent(value))}
                />
                <LabRange
                  label="Storage budget"
                  value={storageBudgetTiB}
                  output={`${storageBudgetTiB.toLocaleString()} TiB`}
                  {...data.bounds.storageBudgetTiB}
                  accent="rose"
                  lowLabel="Tight"
                  highLabel="Large"
                  onChange={(value) => customize(() => setStorageBudgetTiB(value))}
                />
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Points per day"
                value={formatCount(result.pointsPerDay)}
                detail={`${formatCount(pointsPerSecond)} points/s x ${data.constants.secondsPerDay.toLocaleString()} seconds`}
                icon={Activity}
                tone="cyan"
              />
              <LabMetric
                label="Input payload rate"
                value={`${result.ingestMibPerSecond.toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })} MiB/s`}
                detail="Point rate x assumed bytes per point"
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Logical retained"
                value={formatStorage(result.retainedLogicalGib)}
                detail={`${formatStorage(result.logicalGibPerDay)} per day x ${retentionDays} days`}
                icon={Database}
                tone="violet"
              />
              <LabMetric
                label="Planning envelope"
                value={formatStorage(result.planningEnvelopeGib)}
                detail={`${durableCopies} stored copies plus ${headroomPercent}% headroom`}
                icon={HardDrive}
                tone={result.tone}
              />
            </div>

            <div
              className={`mt-4 rounded-md border p-4 ${
                result.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
                  : result.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                {result.status}
              </div>
              <p className="mt-2 text-sm leading-6">{result.verdict}</p>
            </div>

            <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Transparent formulas
              </p>
              <div className="mt-3 space-y-2 font-mono text-xs leading-5 text-neutral-700 dark:text-neutral-300">
                <p>points/day = points/s x 86,400</p>
                <p>
                  logical GiB = points/day x retention days x bytes/point / 2^30
                </p>
                <p>
                  envelope = logical GiB x stored copies x (1 + headroom / 100)
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {data.note}
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <p>{error ?? 'Loading the planning model...'}</p>
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
