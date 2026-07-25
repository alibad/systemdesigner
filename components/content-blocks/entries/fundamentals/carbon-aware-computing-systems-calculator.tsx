'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CloudCog,
  Database,
  Gauge,
  Leaf,
  MapPin,
  RefreshCw,
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

type Workload = {
  id: string;
  label: string;
  detail: string;
  energyKwh: number;
  dataGb: number;
};

type RegionPolicy = {
  id: string;
  label: string;
  detail: string;
  allowedRegionIds: string[];
};

type Slot = {
  id: string;
  label: string;
  regionId: string;
  regionLabel: string;
  delayHours: number;
  intensityGPerKwh: number;
  detail: string;
};

type ShiftModel = {
  title: string;
  description: string;
  boundaryNote: string;
  assumptions: {
    homeRegionId: string;
    baselineSlotId: string;
    transferEnergyKwhPerGb: number;
    transferIntensityGPerKwh: number;
  };
  defaults: {
    workloadId: string;
    maxDelayHours: number;
    regionPolicyId: string;
  };
  delayOptionsHours: number[];
  workloads: Workload[];
  regionPolicies: RegionPolicy[];
  slots: Slot[];
};

type Candidate = Slot & {
  feasible: boolean;
  computeKg: number;
  transferEnergyKwh: number;
  transferKg: number;
  totalKg: number;
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/carbon-aware-computing-systems/data/time-region-shift-model.json';

function isShiftModel(value: unknown): value is ShiftModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ShiftModel>;

  return Boolean(
    model.title
      && model.description
      && model.boundaryNote
      && model.assumptions?.homeRegionId
      && model.assumptions.baselineSlotId
      && typeof model.assumptions.transferEnergyKwhPerGb === 'number'
      && typeof model.assumptions.transferIntensityGPerKwh === 'number'
      && model.defaults?.workloadId
      && typeof model.defaults.maxDelayHours === 'number'
      && model.defaults.regionPolicyId
      && Array.isArray(model.delayOptionsHours)
      && model.delayOptionsHours.length >= 3
      && Array.isArray(model.workloads)
      && model.workloads.length >= 3
      && model.workloads.every((workload) => (
        workload.id
        && workload.label
        && workload.detail
        && workload.energyKwh > 0
        && workload.dataGb >= 0
      ))
      && Array.isArray(model.regionPolicies)
      && model.regionPolicies.length >= 2
      && model.regionPolicies.every((policy) => (
        policy.id
        && policy.label
        && policy.detail
        && Array.isArray(policy.allowedRegionIds)
        && policy.allowedRegionIds.length > 0
      ))
      && Array.isArray(model.slots)
      && model.slots.length >= 4
      && model.slots.every((slot) => (
        slot.id
        && slot.label
        && slot.regionId
        && slot.regionLabel
        && slot.delayHours >= 0
        && slot.intensityGPerKwh > 0
        && slot.detail
      )),
  );
}

function formatMass(value: number) {
  return `${value.toFixed(value >= 100 ? 0 : 1)} kg CO2e`;
}

function estimateCandidate(
  slot: Slot,
  model: ShiftModel,
  energyKwh: number,
  dataGb: number,
  maxDelayHours: number,
  policy: RegionPolicy,
): Candidate {
  const crossesRegion = slot.regionId !== model.assumptions.homeRegionId;
  const transferEnergyKwh = crossesRegion
    ? dataGb * model.assumptions.transferEnergyKwhPerGb
    : 0;
  const computeKg = energyKwh * slot.intensityGPerKwh / 1_000;
  const transferKg = transferEnergyKwh
    * model.assumptions.transferIntensityGPerKwh
    / 1_000;

  return {
    ...slot,
    feasible: slot.delayHours <= maxDelayHours
      && policy.allowedRegionIds.includes(slot.regionId),
    computeKg,
    transferEnergyKwh,
    transferKg,
    totalKg: computeKg + transferKg,
  };
}

export default function CarbonAwareComputingSystemsCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ShiftModel | null>(null);
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
        if (!isShiftModel(payload)) {
          throw new Error('The time and region model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the scheduling model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Time and region shifting lab"
        title={model?.title ?? 'Load the scheduling candidates'}
        description={model?.description ?? 'The lesson-owned scenario assumptions are loading.'}
        icon={CloudCog}
        accent="emerald"
      />
      {!model ? (
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <ShiftLab model={model} />
      )}
    </LearningLab>
  );
}

function ShiftLab({ model }: { model: ShiftModel }) {
  const defaultWorkload = model.workloads.find(
    (workload) => workload.id === model.defaults.workloadId,
  ) ?? model.workloads[0];
  const [workloadId, setWorkloadId] = useState(defaultWorkload.id);
  const [energyKwh, setEnergyKwh] = useState(defaultWorkload.energyKwh);
  const [dataGb, setDataGb] = useState(defaultWorkload.dataGb);
  const [maxDelayHours, setMaxDelayHours] = useState(model.defaults.maxDelayHours);
  const [regionPolicyId, setRegionPolicyId] = useState(model.defaults.regionPolicyId);

  const workload = model.workloads.find((item) => item.id === workloadId)
    ?? model.workloads[0];
  const policy = model.regionPolicies.find((item) => item.id === regionPolicyId)
    ?? model.regionPolicies[0];

  const result = useMemo(() => {
    const candidates = model.slots.map((slot) => estimateCandidate(
      slot,
      model,
      energyKwh,
      dataGb,
      maxDelayHours,
      policy,
    ));
    const baseline = candidates.find(
      (candidate) => candidate.id === model.assumptions.baselineSlotId,
    ) ?? candidates[0];
    const feasible = candidates.filter((candidate) => candidate.feasible);
    const recommended = feasible.reduce<Candidate | null>(
      (best, candidate) => (!best || candidate.totalKg < best.totalKg ? candidate : best),
      null,
    );
    const avoidedKg = recommended ? Math.max(0, baseline.totalKg - recommended.totalKg) : 0;

    return {
      candidates,
      baseline,
      recommended,
      avoidedKg,
      maxKg: Math.max(...candidates.map((candidate) => candidate.totalKg)),
    };
  }, [dataGb, energyKwh, maxDelayHours, model, policy]);

  function selectWorkload(nextWorkload: Workload) {
    setWorkloadId(nextWorkload.id);
    setEnergyKwh(nextWorkload.energyKwh);
    setDataGb(nextWorkload.dataGb);
  }

  function reset() {
    selectWorkload(defaultWorkload);
    setMaxDelayHours(model.defaults.maxDelayHours);
    setRegionPolicyId(model.defaults.regionPolicyId);
  }

  return (
    <>
      <div className="border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs leading-5 text-neutral-600 md:px-6 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
        <strong className="font-semibold text-neutral-900 dark:text-white">
          Scenario boundary:
        </strong>{' '}
        {model.boundaryNote}
      </div>
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload preset
              </legend>
              <div className="mt-3 space-y-2">
                {model.workloads.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workload.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Database}
                    accent="emerald"
                    onClick={() => selectWorkload(item)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Measured job energy"
              value={energyKwh}
              output={`${energyKwh} kWh`}
              min={100}
              max={1_500}
              step={25}
              lowLabel="small batch"
              highLabel="large batch"
              accent="emerald"
              onChange={setEnergyKwh}
            />

            <LabRange
              label="Data copied across regions"
              value={dataGb}
              output={`${dataGb} GB`}
              min={0}
              max={1_000}
              step={25}
              lowLabel="no copy"
              highLabel="1 TB"
              accent="blue"
              onChange={setDataGb}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Latest allowed start
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {model.delayOptionsHours.map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    aria-pressed={hours === maxDelayHours}
                    onClick={() => setMaxDelayHours(hours)}
                    className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      hours === maxDelayHours
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                    }`}
                  >
                    {hours === 0 ? 'Run now' : `Within ${hours}h`}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Approved placement
              </legend>
              <div className="mt-3 space-y-2">
                {model.regionPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={MapPin}
                    accent="blue"
                    onClick={() => setRegionPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-700 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Reset assumptions
            </button>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section className="rounded-md border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50">
            <div className="flex items-start gap-3">
              <Leaf aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">
                  Lowest modeled feasible candidate
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {result.recommended
                    ? `${result.recommended.regionLabel}: ${result.recommended.label}`
                    : 'No candidate satisfies both constraints'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {result.recommended
                    ? `The estimate includes ${energyKwh} kWh of compute and ${
                      result.recommended.transferEnergyKwh.toFixed(1)
                    } kWh of modeled transfer energy. It is a scenario comparison, not a live carbon claim.`
                    : 'Expand the allowed start window or approve another placement. A scheduler must not silently ignore deadline or residency constraints.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Run-now baseline"
              value={formatMass(result.baseline.totalKg)}
              detail={`${energyKwh} kWh x ${result.baseline.intensityGPerKwh} gCO2e/kWh`}
              icon={Gauge}
              tone="neutral"
            />
            <LabMetric
              label="Selected estimate"
              value={result.recommended ? formatMass(result.recommended.totalKg) : 'No fit'}
              detail={result.recommended
                ? `Compute ${formatMass(result.recommended.computeKg)} + transfer ${
                  formatMass(result.recommended.transferKg)
                }`
                : 'No feasible time and region pair'}
              icon={Leaf}
              tone={result.recommended ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Modeled difference"
              value={result.recommended ? formatMass(result.avoidedKg) : '--'}
              detail="Baseline minus selected estimate; positive means lower"
              icon={ArrowRight}
              tone={result.avoidedKg > 0 ? 'blue' : 'amber'}
            />
            <LabMetric
              label="Start delay"
              value={result.recommended ? `${result.recommended.delayHours} h` : '--'}
              detail={`Constraint: no later than ${maxDelayHours} h`}
              icon={Clock3}
              tone="violet"
            />
          </div>

          <section>
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Candidate board
              </p>
              <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                Compare every slot against the same boundary
              </h4>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.candidates.map((candidate) => {
                const selected = candidate.id === result.recommended?.id;
                const width = Math.max(4, candidate.totalKg / result.maxKg * 100);

                return (
                  <article
                    key={candidate.id}
                    className={`min-w-0 rounded-md border p-4 ${
                      selected
                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                        : candidate.feasible
                          ? 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                          : 'border-neutral-200 bg-neutral-100 opacity-70 dark:border-neutral-800 dark:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          {candidate.regionLabel}
                        </p>
                        <h5 className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                          {candidate.label}
                        </h5>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        selected
                          ? 'border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-neutral-950 dark:text-emerald-200'
                          : candidate.feasible
                            ? 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                            : 'border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
                      }`}>
                        {selected ? 'Recommended' : candidate.feasible ? 'Feasible' : 'Blocked'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {candidate.detail}
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                          selected ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Intensity input</dt>
                        <dd className="mt-1 font-semibold text-neutral-900 dark:text-white">
                          {candidate.intensityGPerKwh} gCO2e/kWh
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500 dark:text-neutral-400">Total estimate</dt>
                        <dd className="mt-1 font-semibold text-neutral-900 dark:text-white">
                          {formatMass(candidate.totalKg)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
            <div className="flex items-start gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">
                  Assumptions used in every comparison
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6">
                  <li>
                    Compute: energy in kWh x slot intensity in gCO2e/kWh / 1,000.
                  </li>
                  <li>
                    Cross-region transfer: {dataGb} GB x {
                      model.assumptions.transferEnergyKwhPerGb
                    } kWh/GB x {model.assumptions.transferIntensityGPerKwh} gCO2e/kWh.
                  </li>
                  <li>
                    Only the selected start-window and approved-region policy determine feasibility.
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </>
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
    <div className="flex min-h-[280px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            Scheduling data could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <CloudCog
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-emerald-500 motion-reduce:animate-none"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading scheduling assumptions...
          </p>
        </div>
      )}
    </div>
  );
}
