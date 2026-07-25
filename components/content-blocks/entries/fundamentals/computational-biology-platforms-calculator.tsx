'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  CircleAlert,
  Clock3,
  Cpu,
  Database,
  Dna,
  Gauge,
  HardDrive,
  Network,
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
type Profile = {
  id: string;
  label: string;
  detail: string;
  rawGibPerSample: number;
  derivedToRawRatio: number;
  workerSlotHoursPerSample: number;
};
type CapacityData = {
  title: string;
  description: string;
  assumptions: {
    networkUtilization: number;
    workerUtilization: number;
    note: string;
  };
  defaults: {
    profileId: string;
    samples: number;
    networkGbps: number;
    workerSlots: number;
    retainedCopies: number;
  };
  bounds: {
    samples: Bound;
    networkGbps: Bound;
    workerSlots: Bound;
  };
  profiles: Profile[];
};

const BLOCK_ID = 'fundamentals/computational-biology-platforms-calculator';
const GIB_BYTES = 1024 ** 3;
const GBIT_BYTES = 1_000_000_000 / 8;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bound>;
  return [item.min, item.max, item.step].every(
    (candidate) => typeof candidate === 'number' && Number.isFinite(candidate),
  );
}

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CapacityData>;
  return Boolean(
    item.title
      && item.description
      && item.assumptions?.note
      && typeof item.assumptions.networkUtilization === 'number'
      && typeof item.assumptions.workerUtilization === 'number'
      && item.defaults?.profileId
      && typeof item.defaults.samples === 'number'
      && typeof item.defaults.networkGbps === 'number'
      && typeof item.defaults.workerSlots === 'number'
      && typeof item.defaults.retainedCopies === 'number'
      && isBound(item.bounds?.samples)
      && isBound(item.bounds?.networkGbps)
      && isBound(item.bounds?.workerSlots)
      && Array.isArray(item.profiles)
      && item.profiles.length > 0,
  );
}

function formatStorage(gib: number) {
  if (gib >= 1024 ** 2) return `${(gib / 1024 ** 2).toFixed(2)} PiB`;
  if (gib >= 1024) return `${(gib / 1024).toFixed(1)} TiB`;
  return `${Math.round(gib).toLocaleString()} GiB`;
}

function formatDuration(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default function ComputationalBiologyPlatformsCalculator({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No cohort capacity model was supplied.');
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
        if (!isCapacityData(payload)) throw new Error('The cohort capacity model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the capacity model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState title="Capacity model unavailable" detail={error} error />;
  if (!data) return <LoadState title="Loading cohort model" detail="Reading planning assumptions..." />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [samples, setSamples] = useState<number>(data.defaults.samples);
  const [networkGbps, setNetworkGbps] = useState<number>(data.defaults.networkGbps);
  const [workerSlots, setWorkerSlots] = useState<number>(data.defaults.workerSlots);
  const [retainedCopies, setRetainedCopies] = useState<number>(data.defaults.retainedCopies);
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];

  const model = useMemo(() => {
    const rawGib = samples * profile.rawGibPerSample;
    const derivedGib = rawGib * profile.derivedToRawRatio;
    const retainedGib = (rawGib + derivedGib) * retainedCopies;
    const transferHours = rawGib * GIB_BYTES
      / (networkGbps * GBIT_BYTES * data.assumptions.networkUtilization)
      / 3600;
    const effectiveSlots = workerSlots * data.assumptions.workerUtilization;
    const slotHours = samples * profile.workerSlotHoursPerSample;
    const computeHours = slotHours / effectiveSlots;
    const samplesPerDay = effectiveSlots * 24 / profile.workerSlotHoursPerSample;
    const pressure = transferHours > computeHours ? 'transfer' : 'compute';
    return {
      rawGib,
      derivedGib,
      retainedGib,
      transferHours,
      slotHours,
      computeHours,
      samplesPerDay,
      pressure,
    };
  }, [data.assumptions, networkGbps, profile, retainedCopies, samples, workerSlots]);

  function reset() {
    setProfileId(data.defaults.profileId);
    setSamples(data.defaults.samples);
    setNetworkGbps(data.defaults.networkGbps);
    setWorkerSlots(data.defaults.workerSlots);
    setRetainedCopies(data.defaults.retainedCopies);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cohort capacity lab"
          title={data.title}
          description={data.description}
          icon={Dna}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Measured workload profile
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={profile.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'whole-genome' ? Dna : Binary}
                      accent="cyan"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Cohort samples"
                value={samples}
                output={samples.toLocaleString()}
                {...data.bounds.samples}
                lowLabel="Pilot"
                highLabel="Population cohort"
                accent="blue"
                onChange={setSamples}
              />
              <LabRange
                label="Sustained payload network"
                value={networkGbps}
                output={`${networkGbps} Gbit/s`}
                {...data.bounds.networkGbps}
                lowLabel="Measured floor"
                highLabel="Measured ceiling"
                accent="emerald"
                onChange={setNetworkGbps}
              />
              <LabRange
                label="Usable worker slots"
                value={workerSlots}
                output={workerSlots.toLocaleString()}
                {...data.bounds.workerSlots}
                lowLabel="Small pool"
                highLabel="Wide scatter"
                accent="violet"
                onChange={setWorkerSlots}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Retained complete copies
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={retainedCopies === count}
                      onClick={() => setRetainedCopies(count)}
                      className={`h-11 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        retainedCopies === count
                          ? 'border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
                          : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      {count}×
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Retained footprint" value={formatStorage(model.retainedGib)} detail={`${retainedCopies} copies of raw + derived`} icon={Database} tone="cyan" />
              <LabMetric label="Raw transfer bound" value={formatDuration(model.transferHours)} detail={`${Math.round(data.assumptions.networkUtilization * 100)}% sustained link utilization`} icon={Network} tone="emerald" />
              <LabMetric label="Compute slot bound" value={formatDuration(model.computeHours)} detail={`${Math.round(data.assumptions.workerUtilization * 100)}% effective slot use`} icon={Cpu} tone="violet" />
              <LabMetric label="Slot throughput" value={`${Math.round(model.samplesPerDay).toLocaleString()}/day`} detail="from measured slot-hours per sample" icon={Gauge} tone="amber" />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible arithmetic</p>
              </div>
              {[
                ['Raw data', `${samples.toLocaleString()} × ${profile.rawGibPerSample} GiB`, formatStorage(model.rawGib)],
                ['Derived data', `${formatStorage(model.rawGib)} × ${profile.derivedToRawRatio}`, formatStorage(model.derivedGib)],
                ['Worker demand', `${samples.toLocaleString()} × ${profile.workerSlotHoursPerSample} slot-hours`, `${model.slotHours.toLocaleString()} h`],
              ].map(([label, expression, value]) => (
                <div key={label} className="grid gap-1 border-b border-neutral-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center dark:border-neutral-900">
                  <span className="font-semibold text-neutral-950 dark:text-white">{label}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">{expression}</span>
                  <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</span>
                </div>
              ))}
            </section>

            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
              <div className="flex items-start gap-3">
                <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {model.pressure === 'transfer' ? 'Raw transfer is the longer standalone budget' : 'Worker-slot demand is the longer standalone budget'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    This comparison is diagnostic, not an elapsed-time promise. DAG barriers, queue waits, task skew, retries, and transfer/compute overlap require a traced representative run.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p><span className="font-semibold">Model boundary:</span> {data.assumptions.note}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) {
  return (
    <div className={`not-prose my-7 rounded-lg border p-6 ${error ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50' : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}>
      <div className="flex items-start gap-3">
        {error ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <HardDrive aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
        <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm opacity-75">{detail}</p></div>
      </div>
    </div>
  );
}
