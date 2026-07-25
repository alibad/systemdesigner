'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Cpu,
  Gauge,
  HardDrive,
  Ruler,
  ShieldCheck,
  Timer,
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
  '/api/content/ml-systems/edge-ml-deployment/data/device-envelope-profiles.json';
const BLOCK_ID = 'ml-systems/edge-ml-deployment-calculator';

type Range = {
  min: number;
  max: number;
  step: number;
};

type DeviceProfile = {
  id: string;
  label: string;
  detail: string;
  availableMemoryMib: number;
  appBaselineMib: number;
  modelPeakMib: number;
  memoryReservePct: number;
  freeStorageMib: number;
  candidateBundleMib: number;
  rollbackBundleMib: number;
  measuredP95Ms: number;
  deadlineMs: number;
};

type EnvelopeData = {
  title: string;
  description: string;
  measurementNote: string;
  ranges: Record<
    | 'availableMemoryMib'
    | 'appBaselineMib'
    | 'modelPeakMib'
    | 'memoryReservePct'
    | 'freeStorageMib'
    | 'candidateBundleMib'
    | 'measuredP95Ms'
    | 'deadlineMs',
    Range
  >;
  profiles: DeviceProfile[];
};

const requiredRangeKeys = [
  'availableMemoryMib',
  'appBaselineMib',
  'modelPeakMib',
  'memoryReservePct',
  'freeStorageMib',
  'candidateBundleMib',
  'measuredP95Ms',
  'deadlineMs',
] as const;

function isEnvelopeData(value: unknown): value is EnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<EnvelopeData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.measurementNote === 'string'
      && data.ranges
      && requiredRangeKeys.every((key) => {
        const range = data.ranges?.[key];
        return Boolean(
          range
            && typeof range.min === 'number'
            && typeof range.max === 'number'
            && typeof range.step === 'number',
        );
      })
      && Array.isArray(data.profiles)
      && data.profiles.length >= 2
      && data.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && requiredRangeKeys.every((key) => typeof profile[key] === 'number')
        && typeof profile.rollbackBundleMib === 'number'
      )),
  );
}

function formatMib(value: number) {
  return `${Math.round(value).toLocaleString()} MiB`;
}

export default function EdgeMlDeploymentCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState('budget-phone');
  const [availableMemoryMib, setAvailableMemoryMib] = useState(384);
  const [appBaselineMib, setAppBaselineMib] = useState(176);
  const [modelPeakMib, setModelPeakMib] = useState(152);
  const [memoryReservePct, setMemoryReservePct] = useState(20);
  const [freeStorageMib, setFreeStorageMib] = useState(256);
  const [candidateBundleMib, setCandidateBundleMib] = useState(48);
  const [rollbackBundleMib, setRollbackBundleMib] = useState(44);
  const [measuredP95Ms, setMeasuredP95Ms] = useState(62);
  const [deadlineMs, setDeadlineMs] = useState(50);

  function applyProfile(profile: DeviceProfile) {
    setProfileId(profile.id);
    setAvailableMemoryMib(profile.availableMemoryMib);
    setAppBaselineMib(profile.appBaselineMib);
    setModelPeakMib(profile.modelPeakMib);
    setMemoryReservePct(profile.memoryReservePct);
    setFreeStorageMib(profile.freeStorageMib);
    setCandidateBundleMib(profile.candidateBundleMib);
    setRollbackBundleMib(profile.rollbackBundleMib);
    setMeasuredP95Ms(profile.measuredP95Ms);
    setDeadlineMs(profile.deadlineMs);
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEnvelopeData(payload)) throw new Error('Device-envelope data is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    const memoryCeilingMib = availableMemoryMib * (1 - memoryReservePct / 100);
    const memoryDemandMib = appBaselineMib + modelPeakMib;
    const memoryMarginMib = memoryCeilingMib - memoryDemandMib;
    const storageDemandMib = candidateBundleMib + rollbackBundleMib;
    const storageMarginMib = freeStorageMib - storageDemandMib;
    const latencyMarginMs = deadlineMs - measuredP95Ms;
    const memoryPass = memoryMarginMib >= 0;
    const storagePass = storageMarginMib >= 0;
    const latencyPass = latencyMarginMs >= 0;
    const passedGates = [memoryPass, storagePass, latencyPass].filter(Boolean).length;

    return {
      latencyMarginMs,
      latencyPass,
      memoryCeilingMib,
      memoryDemandMib,
      memoryMarginMib,
      memoryPass,
      passedGates,
      storageDemandMib,
      storageMarginMib,
      storagePass,
    };
  }, [
    appBaselineMib,
    availableMemoryMib,
    candidateBundleMib,
    deadlineMs,
    freeStorageMib,
    measuredP95Ms,
    memoryReservePct,
    modelPeakMib,
    rollbackBundleMib,
  ]);

  if (!data) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'h-96 animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading device-envelope lab'}
      >
        {error}
      </div>
    );
  }

  const activeProfile = data.profiles.find((profile) => profile.id === profileId) ?? data.profiles[0];
  const allPass = result.passedGates === 3;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Device evidence lab"
          title={data.title}
          description={data.description}
          icon={Ruler}
          accent="cyan"
          onReset={() => applyProfile(activeProfile)}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Load an illustrative measurement set
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={Cpu}
                      accent={profile.id === 'budget-phone' ? 'cyan' : profile.id === 'premium-phone' ? 'violet' : 'amber'}
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Replace examples with profiler output
                </p>
                <LabRange
                  label="Memory available to the process"
                  value={availableMemoryMib}
                  output={formatMib(availableMemoryMib)}
                  {...data.ranges.availableMemoryMib}
                  accent="blue"
                  lowLabel="Tight ceiling"
                  highLabel="Larger ceiling"
                  onChange={setAvailableMemoryMib}
                />
                <LabRange
                  label="App baseline before model load"
                  value={appBaselineMib}
                  output={formatMib(appBaselineMib)}
                  {...data.ranges.appBaselineMib}
                  accent="violet"
                  lowLabel="Measured idle"
                  highLabel="Heavy host app"
                  onChange={setAppBaselineMib}
                />
                <LabRange
                  label="Peak model working set"
                  value={modelPeakMib}
                  output={formatMib(modelPeakMib)}
                  {...data.ranges.modelPeakMib}
                  accent="rose"
                  lowLabel="Weights + tensors"
                  highLabel="Peak allocation"
                  onChange={setModelPeakMib}
                />
                <LabRange
                  label="Memory reserve"
                  value={memoryReservePct}
                  output={`${memoryReservePct}%`}
                  {...data.ranges.memoryReservePct}
                  accent="amber"
                  lowLabel="Little headroom"
                  highLabel="More resilience"
                  onChange={setMemoryReservePct}
                />
                <LabRange
                  label="Free storage at update time"
                  value={freeStorageMib}
                  output={formatMib(freeStorageMib)}
                  {...data.ranges.freeStorageMib}
                  accent="emerald"
                  lowLabel="Storage pressure"
                  highLabel="Room for rollback"
                  onChange={setFreeStorageMib}
                />
                <LabRange
                  label="Candidate install bundle"
                  value={candidateBundleMib}
                  output={formatMib(candidateBundleMib)}
                  {...data.ranges.candidateBundleMib}
                  accent="cyan"
                  lowLabel="Model + runtime delta"
                  highLabel="Large update"
                  onChange={setCandidateBundleMib}
                />
                <LabRange
                  label="Measured warm p95 latency"
                  value={measuredP95Ms}
                  output={`${measuredP95Ms} ms`}
                  {...data.ranges.measuredP95Ms}
                  accent="rose"
                  lowLabel="Faster observation"
                  highLabel="Slower tail"
                  onChange={setMeasuredP95Ms}
                />
                <LabRange
                  label="Product deadline"
                  value={deadlineMs}
                  output={`${deadlineMs} ms`}
                  {...data.ranges.deadlineMs}
                  accent="blue"
                  lowLabel="Interactive path"
                  highLabel="Looser deadline"
                  onChange={setDeadlineMs}
                />
              </div>
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${
              allPass
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                {allPass ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Envelope verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {allPass ? 'The measured envelope clears all three gates' : `${3 - result.passedGates} deployment gate${3 - result.passedGates === 1 ? '' : 's'} fail`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {allPass
                      ? 'This candidate can proceed to device-cohort testing. It still needs quality, energy, sustained thermal, compatibility, and rollback evidence.'
                      : 'Do not infer a fix from model size alone. Re-profile the candidate after changing its graph, runtime, delegate, input shape, or host-app behavior.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Memory margin"
                value={`${result.memoryMarginMib >= 0 ? '+' : ''}${Math.round(result.memoryMarginMib)} MiB`}
                detail={`${formatMib(result.memoryDemandMib)} demand vs ${formatMib(result.memoryCeilingMib)} guarded ceiling`}
                icon={Cpu}
                tone={result.memoryPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Storage margin"
                value={`${result.storageMarginMib >= 0 ? '+' : ''}${Math.round(result.storageMarginMib)} MiB`}
                detail={`${formatMib(result.storageDemandMib)} keeps candidate and ${formatMib(rollbackBundleMib)} rollback`}
                icon={HardDrive}
                tone={result.storagePass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Latency margin"
                value={`${result.latencyMarginMs >= 0 ? '+' : ''}${result.latencyMarginMs} ms`}
                detail={`${measuredP95Ms} ms observed vs ${deadlineMs} ms deadline`}
                icon={Timer}
                tone={result.latencyPass ? 'emerald' : 'rose'}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <EnvelopeBar
                label="Guarded runtime memory"
                used={result.memoryDemandMib}
                total={result.memoryCeilingMib}
                pass={result.memoryPass}
                detail={`${formatMib(appBaselineMib)} host app + ${formatMib(modelPeakMib)} measured model peak`}
                icon={Gauge}
              />
              <EnvelopeBar
                label="Update storage"
                used={result.storageDemandMib}
                total={freeStorageMib}
                pass={result.storagePass}
                detail={`${formatMib(candidateBundleMib)} candidate + ${formatMib(rollbackBundleMib)} known-good version`}
                icon={Box}
              />
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="text-sm font-semibold">Not calculated: accuracy, energy, heat, or operator support</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{data.measurementNote}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EnvelopeBar({
  label,
  used,
  total,
  pass,
  detail,
  icon: Icon,
}: {
  label: string;
  used: number;
  total: number;
  pass: boolean;
  detail: string;
  icon: typeof Gauge;
}) {
  const percentage = Math.min(100, Math.max(0, (used / Math.max(total, 1)) * 100));

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </p>
        <span className={`text-xs font-semibold uppercase ${pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {pass ? 'Fits' : 'Over limit'}
        </span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${pass ? 'bg-emerald-500' : 'bg-rose-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
