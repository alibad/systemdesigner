'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Grid3X3,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface RangeData {
  default: number;
  min: number;
  max: number;
  step: number;
}

interface DispatchCapacityData {
  title: string;
  description: string;
  riderRequestsPerMinute: RangeData;
  availableDrivers: RangeData;
  cellSizeKm: RangeData;
  matchingRadiusKm: RangeData;
  regionAreaKm2: number;
  matchingWindowMinutes: number;
  freshLocationShare: number;
  candidateWorkCapacityPerSecond: number;
  targetUtilization: number;
  cellLookupEquivalentChecks: number;
  pickupSpeedKmPerMinute: number;
  baseDecisionMinutes: number;
  targetWaitMinutes: number;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRangeData(value: unknown): value is RangeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RangeData>;
  return (
    isPositiveNumber(candidate.default) &&
    isPositiveNumber(candidate.min) &&
    isPositiveNumber(candidate.max) &&
    isPositiveNumber(candidate.step) &&
    candidate.min < candidate.max &&
    candidate.default >= candidate.min &&
    candidate.default <= candidate.max
  );
}

function isDispatchCapacityData(value: unknown): value is DispatchCapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DispatchCapacityData>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.description === 'string' &&
    isRangeData(candidate.riderRequestsPerMinute) &&
    isRangeData(candidate.availableDrivers) &&
    isRangeData(candidate.cellSizeKm) &&
    isRangeData(candidate.matchingRadiusKm) &&
    isPositiveNumber(candidate.regionAreaKm2) &&
    isPositiveNumber(candidate.matchingWindowMinutes) &&
    isPositiveNumber(candidate.freshLocationShare) &&
    candidate.freshLocationShare <= 1 &&
    isPositiveNumber(candidate.candidateWorkCapacityPerSecond) &&
    isPositiveNumber(candidate.targetUtilization) &&
    candidate.targetUtilization < 1 &&
    isPositiveNumber(candidate.cellLookupEquivalentChecks) &&
    isPositiveNumber(candidate.pickupSpeedKmPerMinute) &&
    isPositiveNumber(candidate.baseDecisionMinutes) &&
    isPositiveNumber(candidate.targetWaitMinutes)
  );
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function UberRidesharingDispatchCapacityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DispatchCapacityData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [riderRequestsPerMinute, setRiderRequestsPerMinute] = useState(0);
  const [availableDrivers, setAvailableDrivers] = useState(0);
  const [cellSizeKm, setCellSizeKm] = useState(0);
  const [matchingRadiusKm, setMatchingRadiusKm] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setLoadError(false);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Dispatch capacity request failed: ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDispatchCapacityData(payload)) {
          throw new Error('Dispatch capacity data is invalid');
        }
        setData(payload);
        setRiderRequestsPerMinute(payload.riderRequestsPerMinute.default);
        setAvailableDrivers(payload.availableDrivers.default);
        setCellSizeKm(payload.cellSizeKm.default);
        setMatchingRadiusKm(payload.matchingRadiusKm.default);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const freshDrivers = availableDrivers * data.freshLocationShare;
    const requestRate = riderRequestsPerMinute / 60;
    const demandInWindow = riderRequestsPerMinute * data.matchingWindowMinutes;
    const supplyCoverage = freshDrivers / demandInWindow;
    const radiusArea = Math.PI * matchingRadiusKm ** 2;
    const scannedArea = Math.min(
      data.regionAreaKm2,
      radiusArea + 4 * matchingRadiusKm * cellSizeKm + 4 * cellSizeKm ** 2,
    );
    const usefulCandidates = freshDrivers * Math.min(1, radiusArea / data.regionAreaKm2);
    const scannedCandidates = freshDrivers * Math.min(1, scannedArea / data.regionAreaKm2);
    const cellsPerSearch = Math.ceil((2 * matchingRadiusKm) / cellSizeKm + 2) ** 2;
    const workPerRequest =
      scannedCandidates + cellsPerSearch * data.cellLookupEquivalentChecks;
    const candidateWorkPerSecond = requestRate * workPerRequest;
    const plannedCapacity =
      data.candidateWorkCapacityPerSecond * data.targetUtilization;
    const candidatePressure = candidateWorkPerSecond / plannedCapacity;
    const falseCandidateShare =
      scannedCandidates === 0
        ? 0
        : Math.max(0, (scannedCandidates - usefulCandidates) / scannedCandidates);
    const unmatchedRequestsPerMinute = Math.max(
      0,
      riderRequestsPerMinute - freshDrivers / data.matchingWindowMinutes,
    );
    const queueGrowthRequestsPerMinute =
      candidatePressure <= 1
        ? 0
        : ((candidateWorkPerSecond - plannedCapacity) / workPerRequest) * 60;

    const expectedNearestKm =
      Math.sqrt(data.regionAreaKm2 / (Math.PI * Math.max(1, freshDrivers))) * 2.5;
    const pickupDistanceKm = Math.min(matchingRadiusKm * 0.65, expectedNearestKm);
    const pickupMinutes = pickupDistanceKm / data.pickupSpeedKmPerMinute;
    const candidatePenalty = clamp((8 - usefulCandidates) / 8, 0, 1) * 4;
    const supplyPenalty = clamp((1 / Math.max(0.1, supplyCoverage) - 1) * 2.4, 0, 18);
    const queuePenalty = clamp((candidatePressure - 0.7) * 6, 0, 20);
    const estimatedWaitMinutes =
      data.baseDecisionMinutes +
      pickupMinutes +
      candidatePenalty +
      supplyPenalty +
      queuePenalty;

    const overloaded = candidatePressure > 1;
    const supplyCrisis = supplyCoverage < 0.7;
    const lowRecall = usefulCandidates < 3;
    const tight =
      !overloaded &&
      !supplyCrisis &&
      (candidatePressure >= 0.82 ||
        supplyCoverage < 1 ||
        estimatedWaitMinutes > data.targetWaitMinutes);

    return {
      candidatePressure,
      candidateWorkPerSecond,
      cellsPerSearch,
      estimatedWaitMinutes,
      falseCandidateShare,
      freshDrivers,
      lowRecall,
      overloaded,
      pickupDistanceKm,
      plannedCapacity,
      queueGrowthRequestsPerMinute,
      scannedCandidates,
      supplyCoverage,
      supplyCrisis,
      tight,
      unmatchedRequestsPerMinute,
      usefulCandidates,
    };
  }, [
    availableDrivers,
    cellSizeKm,
    data,
    matchingRadiusKm,
    riderRequestsPerMinute,
  ]);

  if (loadError) {
    return (
      <div
        role="alert"
        className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      >
        The dispatch capacity model could not be loaded.
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading dispatch capacity model"
        className="min-h-[760px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      />
    );
  }

  const reset = () => {
    setRiderRequestsPerMinute(data.riderRequestsPerMinute.default);
    setAvailableDrivers(data.availableDrivers.default);
    setCellSizeKm(data.cellSizeKm.default);
    setMatchingRadiusKm(data.matchingRadiusKm.default);
  };

  const severity =
    model.overloaded || model.supplyCrisis || model.lowRecall
      ? 'danger'
      : model.tight
        ? 'warning'
        : 'healthy';
  const verdict = model.overloaded
    ? 'Candidate work is growing faster than dispatch can drain it'
    : model.supplyCrisis
      ? 'Fresh driver supply cannot cover the matching window'
      : model.lowRecall
        ? 'The search aperture finds too few viable drivers'
        : model.tight
          ? 'The marketplace fits, but little reserve remains'
          : 'The regional dispatch plan fits its operating envelope';
  const consequence = model.overloaded
    ? `${compact(model.queueGrowthRequestsPerMinute)} requests per minute join the dispatch queue. Narrow the radius, choose a better cell size, shed optional scoring, or add regional capacity before the wait target collapses.`
    : model.supplyCrisis
      ? `${compact(model.unmatchedRequestsPerMinute)} requests per minute exceed fresh supply in the ${data.matchingWindowMinutes}-minute window. Expanding search may find distant drivers, but pricing, incentives, and honest wait estimates must address the marketplace imbalance.`
      : model.lowRecall
        ? `Only ${model.usefulCandidates.toFixed(1)} fresh candidates are expected inside the radius. Expand carefully or return no match; stale or ineligible drivers are not valid capacity.`
        : model.tight
          ? `Estimated wait is ${model.estimatedWaitMinutes.toFixed(1)} minutes and candidate pressure is ${Math.round(model.candidatePressure * 100)}%. A demand spike, worker loss, or location-freshness drop can cross the target.`
          : `The model keeps wait near ${model.estimatedWaitMinutes.toFixed(1)} minutes, candidate work below the ${compact(model.plannedCapacity)}/s planning ceiling, and supply coverage above the matching-window demand.`;

  return (
    <div data-content-block="case-studies/uber-ridesharing-dispatch-capacity-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Dispatch and matching capacity lab"
          title={data.title}
          description={data.description}
          icon={Search}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <LabRange
                label="Rider demand"
                value={riderRequestsPerMinute}
                output={`${compact(riderRequestsPerMinute)}/min`}
                min={data.riderRequestsPerMinute.min}
                max={data.riderRequestsPerMinute.max}
                step={data.riderRequestsPerMinute.step}
                lowLabel="Ordinary period"
                highLabel="Event surge"
                onChange={setRiderRequestsPerMinute}
              />
              <LabRange
                label="Ready drivers"
                value={availableDrivers}
                output={compact(availableDrivers)}
                min={data.availableDrivers.min}
                max={data.availableDrivers.max}
                step={data.availableDrivers.step}
                accent="emerald"
                lowLabel="Thin supply"
                highLabel="Dense supply"
                onChange={setAvailableDrivers}
              />
              <LabRange
                label="Spatial cell size"
                value={cellSizeKm}
                output={`${cellSizeKm.toFixed(1)} km`}
                min={data.cellSizeKm.min}
                max={data.cellSizeKm.max}
                step={data.cellSizeKm.step}
                accent="violet"
                lowLabel="Many precise cells"
                highLabel="Few coarse cells"
                onChange={setCellSizeKm}
              />
              <LabRange
                label="Matching radius"
                value={matchingRadiusKm}
                output={`${matchingRadiusKm.toFixed(1)} km`}
                min={data.matchingRadiusKm.min}
                max={data.matchingRadiusKm.max}
                step={data.matchingRadiusKm.step}
                accent="amber"
                lowLabel="Local recall"
                highLabel="Wide recall"
                onChange={setMatchingRadiusKm}
              />
              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The planning ceiling uses {Math.round(data.targetUtilization * 100)}%
                of raw candidate capacity. Only locations inside the freshness window
                count as supply.
              </p>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric
              label="Estimated rider wait"
              value={`${model.estimatedWaitMinutes.toFixed(1)} min`}
              detail={`${data.targetWaitMinutes}-minute exercise target`}
              icon={Clock3}
              tone={
                model.estimatedWaitMinutes > data.targetWaitMinutes ? 'rose' : 'emerald'
              }
            />
            <LabMetric
              label="Useful candidates"
              value={model.usefulCandidates.toFixed(1)}
              detail={`${model.scannedCandidates.toFixed(0)} driver records scanned per request`}
              icon={MapPin}
              tone={model.lowRecall ? 'rose' : 'blue'}
            />
            <LabMetric
              label="Candidate pressure"
              value={`${Math.round(model.candidatePressure * 100)}%`}
              detail={`${compact(model.candidateWorkPerSecond)} work units/s`}
              icon={Gauge}
              tone={
                model.overloaded
                  ? 'rose'
                  : model.candidatePressure >= 0.82
                    ? 'amber'
                    : 'violet'
              }
            />
            <LabMetric
              label="Unmatched demand"
              value={`${compact(model.unmatchedRequestsPerMinute)}/min`}
              detail={`${Math.round(model.supplyCoverage * 100)}% fresh supply coverage`}
              icon={Users}
              tone={model.unmatchedRequestsPerMinute > 0 ? 'amber' : 'cyan'}
            />
          </div>

          <div className="mt-5 border-y border-neutral-200 py-5 dark:border-neutral-800">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Regional matching path
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <div className="min-w-0 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                <Activity aria-hidden="true" className="h-5 w-5" />
                <p className="mt-2 text-sm font-semibold">Demand window</p>
                <p className="mt-1 text-xs leading-5 opacity-75">
                  {compact(riderRequestsPerMinute * data.matchingWindowMinutes)} requests
                  over {data.matchingWindowMinutes} minutes
                </p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="hidden h-5 w-5 text-neutral-400 sm:block"
              />
              <div className="min-w-0 rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50">
                <Grid3X3 aria-hidden="true" className="h-5 w-5" />
                <p className="mt-2 text-sm font-semibold">Spatial aperture</p>
                <p className="mt-1 text-xs leading-5 opacity-75">
                  {model.cellsPerSearch} cells and {Math.round(model.falseCandidateShare * 100)}%
                  false candidate scans
                </p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="hidden h-5 w-5 text-neutral-400 sm:block"
              />
              <div className="min-w-0 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
                <MapPin aria-hidden="true" className="h-5 w-5" />
                <p className="mt-2 text-sm font-semibold">Fresh candidates</p>
                <p className="mt-1 text-xs leading-5 opacity-75">
                  {compact(model.freshDrivers)} fresh drivers, nearest pickup about{' '}
                  {model.pickupDistanceKm.toFixed(1)} km
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                Candidate pipeline operating pressure
              </span>
              <output className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                {Math.round(model.candidatePressure * 100)}%
              </output>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"
              role="progressbar"
              aria-label="Candidate pipeline pressure"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(model.candidatePressure * 100))}
            >
              <div
                className={`h-full transition-[width] duration-200 motion-reduce:transition-none ${
                  model.overloaded
                    ? 'bg-rose-500'
                    : model.candidatePressure >= 0.82
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, model.candidatePressure * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Very small cells multiply index lookups. Very large cells scan more
              drivers outside the exact radius. Radius growth increases both recall and
              work.
            </p>
          </div>

          <div
            className={`mt-5 rounded-md border p-5 ${
              severity === 'danger'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                : severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
            }`}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {severity === 'healthy' ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                />
              ) : (
                <CircleAlert
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    severity === 'danger'
                      ? 'text-rose-600 dark:text-rose-300'
                      : 'text-amber-600 dark:text-amber-300'
                  }`}
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Operational consequence
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {verdict}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  {consequence}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
