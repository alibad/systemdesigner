'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  Search,
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

type SearchProfile = {
  id: string;
  label: string;
  detail: string;
  preprocessingChoices: number;
  modelFamilies: number;
  parameterSamples: number;
};

type SearchBudgetData = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    wallClockMinutes: number;
    pilotFitMinutes: number;
    folds: number;
    workers: number;
    reservePercent: number;
  };
  bounds: {
    wallClockMinutes: Bound;
    pilotFitMinutes: Bound;
    folds: Bound;
    workers: Bound;
    reservePercent: Bound;
  };
  profiles: SearchProfile[];
};

const BLOCK_ID = 'technology/automl-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/automl/data/search-budget-model.json';

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return (
    isFinitePositive(candidate.min)
    && isFinitePositive(candidate.max)
    && isFinitePositive(candidate.step)
    && candidate.min <= candidate.max
  );
}

function isSearchBudgetData(value: unknown): value is SearchBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SearchBudgetData>;
  const defaults = candidate.defaults;
  const bounds = candidate.bounds;

  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.profileId
      && isFinitePositive(defaults.wallClockMinutes)
      && isFinitePositive(defaults.pilotFitMinutes)
      && isFinitePositive(defaults.folds)
      && isFinitePositive(defaults.workers)
      && isFinitePositive(defaults.reservePercent)
      && isBound(bounds?.wallClockMinutes)
      && isBound(bounds?.pilotFitMinutes)
      && isBound(bounds?.folds)
      && isBound(bounds?.workers)
      && isBound(bounds?.reservePercent)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && isFinitePositive(profile.preprocessingChoices)
        && isFinitePositive(profile.modelFamilies)
        && isFinitePositive(profile.parameterSamples)
      )),
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes.toFixed(minutes % 1 === 0 ? 0 : 1)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export default function AutoMLPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<SearchBudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSearchBudgetData(payload)) {
          throw new Error('The AutoML search-budget model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the search budget.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Experiment budget lab"
            title="Budget a bounded pipeline search"
            description="Loading the transparent capacity model."
            icon={Calculator}
            accent="violet"
          />
          <LearningLabBody>
            <div className="flex min-h-44 items-center justify-center">
              {error ? (
                <div className="max-w-md text-center">
                  <CircleAlert
                    aria-hidden="true"
                    className="mx-auto h-6 w-6 text-rose-500"
                  />
                  <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((value) => value + 1)}
                    className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                  <Search aria-hidden="true" className="h-5 w-5 animate-pulse" />
                  Loading search assumptions
                </div>
              )}
            </div>
          </LearningLabBody>
        </LearningLab>
      ) : (
        <SearchBudgetLab data={data} />
      )}
    </div>
  );
}

function SearchBudgetLab({ data }: { data: SearchBudgetData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [wallClockMinutes, setWallClockMinutes] = useState(data.defaults.wallClockMinutes);
  const [pilotFitMinutes, setPilotFitMinutes] = useState(data.defaults.pilotFitMinutes);
  const [folds, setFolds] = useState(data.defaults.folds);
  const [workers, setWorkers] = useState(data.defaults.workers);
  const [reservePercent, setReservePercent] = useState(data.defaults.reservePercent);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const result = useMemo(() => {
    const searchSpace = (
      profile.preprocessingChoices
      * profile.modelFamilies
      * profile.parameterSamples
    );
    const reservedMinutes = wallClockMinutes * reservePercent / 100;
    const searchMinutes = wallClockMinutes - reservedMinutes;
    const workerMinutes = searchMinutes * workers;
    const fitSlots = Math.floor(workerMinutes / pilotFitMinutes);
    const candidateCapacity = Math.floor(fitSlots / folds);
    const completeCandidates = Math.min(searchSpace, candidateCapacity);
    const coveragePercent = searchSpace === 0
      ? 0
      : completeCandidates / searchSpace * 100;
    const usedWorkerMinutes = completeCandidates * folds * pilotFitMinutes;
    const headroomWorkerMinutes = Math.max(0, workerMinutes - usedWorkerMinutes);

    return {
      candidateCapacity,
      completeCandidates,
      coveragePercent,
      fitSlots,
      headroomWorkerMinutes,
      reservedMinutes,
      searchMinutes,
      searchSpace,
      workerMinutes,
    };
  }, [
    folds,
    pilotFitMinutes,
    profile,
    reservePercent,
    wallClockMinutes,
    workers,
  ]);

  const coversSpace = result.completeCandidates === result.searchSpace;

  function reset() {
    setProfileId(data.defaults.profileId);
    setWallClockMinutes(data.defaults.wallClockMinutes);
    setPilotFitMinutes(data.defaults.pilotFitMinutes);
    setFolds(data.defaults.folds);
    setWorkers(data.defaults.workers);
    setReservePercent(data.defaults.reservePercent);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Experiment budget lab"
        title={data.title}
        description={data.description}
        icon={Calculator}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Declared search space
              </legend>
              <div className="mt-3 grid gap-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setProfileId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Wall-clock budget"
                value={wallClockMinutes}
                output={formatMinutes(wallClockMinutes)}
                {...data.bounds.wallClockMinutes}
                lowLabel="Short experiment"
                highLabel="Long experiment"
                accent="blue"
                onChange={setWallClockMinutes}
              />
              <LabRange
                label="Observed pilot fit"
                value={pilotFitMinutes}
                output={`${pilotFitMinutes}m per fold fit`}
                {...data.bounds.pilotFitMinutes}
                lowLabel="Measured fast fit"
                highLabel="Measured slow fit"
                accent="cyan"
                onChange={setPilotFitMinutes}
              />
              <LabRange
                label="Validation folds"
                value={folds}
                output={`${folds} folds`}
                {...data.bounds.folds}
                accent="emerald"
                onChange={setFolds}
              />
              <LabRange
                label="Parallel workers"
                value={workers}
                output={`${workers} workers`}
                {...data.bounds.workers}
                accent="amber"
                onChange={setWorkers}
              />
              <LabRange
                label="Refit and evaluation reserve"
                value={reservePercent}
                output={`${reservePercent}%`}
                {...data.bounds.reservePercent}
                lowLabel="Search-heavy"
                highLabel="More reserve"
                accent="rose"
                onChange={setReservePercent}
              />
            </div>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section
            className={`rounded-md border p-5 ${
              coversSpace
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {coversSpace ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <Search aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Capacity consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {coversSpace
                    ? 'The idealized capacity covers the declared space'
                    : 'The budget can sample only part of the declared space'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {coversSpace
                    ? 'Use remaining capacity as resilience for slower candidates, failed trials, scheduling overhead, or a smaller search budget.'
                    : 'Narrow the space, increase measured capacity, or use a sampling and stopping strategy. No candidate count predicts the winning score.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Declared configurations"
              value={result.searchSpace.toLocaleString()}
              detail={`${profile.preprocessingChoices} preprocessing x ${profile.modelFamilies} families x ${profile.parameterSamples} samples`}
              icon={Boxes}
              tone="violet"
            />
            <LabMetric
              label="Complete candidates"
              value={result.completeCandidates.toLocaleString()}
              detail={`${folds} fold fits per candidate`}
              icon={CheckCircle2}
              tone={coversSpace ? 'emerald' : 'blue'}
            />
            <LabMetric
              label="Search worker-time"
              value={formatMinutes(result.workerMinutes)}
              detail={`${formatMinutes(result.searchMinutes)} wall time x ${workers} workers`}
              icon={Cpu}
              tone="cyan"
            />
            <LabMetric
              label="Reserved wall time"
              value={formatMinutes(result.reservedMinutes)}
              detail="Held outside candidate search"
              icon={Clock3}
              tone="amber"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Search-space coverage
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.completeCandidates.toLocaleString()} of{' '}
                  {result.searchSpace.toLocaleString()} configurations
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                {result.coveragePercent.toFixed(result.coveragePercent < 10 ? 1 : 0)}%
              </p>
            </div>
            <div
              className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
              role="progressbar"
              aria-label="Declared search-space coverage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(result.coveragePercent)}
            >
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] motion-reduce:transition-none dark:bg-violet-400"
                style={{ width: `${Math.min(100, result.coveragePercent)}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <Equation
                label="Fit slots"
                value={`${Math.floor(result.workerMinutes)} / ${pilotFitMinutes} = ${result.fitSlots}`}
                detail="worker-minutes / observed fit minutes"
              />
              <Equation
                label="Candidate capacity"
                value={`${result.fitSlots} / ${folds} = ${result.candidateCapacity}`}
                detail="fit slots / validation folds"
              />
              <Equation
                label="Unused headroom"
                value={formatMinutes(result.headroomWorkerMinutes)}
                detail="idealized worker-time after complete candidates"
              />
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-3">
            <Boundary
              icon={Gauge}
              title="Measured input"
              detail="Pilot-fit duration must come from representative data, code, and hardware."
            />
            <Boundary
              icon={Cpu}
              title="Idealized arithmetic"
              detail="The model assumes usable workers and equal fit durations; real schedulers add variance."
            />
            <Boundary
              icon={CircleAlert}
              title="No quality estimate"
              detail="Accuracy, loss, calibration, fairness, and deployability remain measured outcomes."
            />
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function Equation({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-1 break-words font-mono text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}

function Boundary({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Gauge;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-5 w-5 text-violet-600 dark:text-violet-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        {detail}
      </p>
    </div>
  );
}
