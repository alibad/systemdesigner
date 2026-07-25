'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  MapPinned,
  RadioTower,
  ScanSearch,
  Server,
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

type DensityProfile = {
  id: string;
  label: string;
  driversPerCell: number;
  detail: string;
};

type DispatchModel = {
  defaults: {
    onlineDrivers: number;
    updateIntervalSeconds: number;
    peakMatchRequestsPerSecond: number;
    searchRings: number;
    densityProfileId: string;
    geoShards: number;
    matcherWorkers: number;
  };
  bounds: {
    onlineDrivers: { min: number; max: number; step: number };
    updateIntervalSeconds: { min: number; max: number; step: number };
    peakMatchRequestsPerSecond: { min: number; max: number; step: number };
    searchRings: { min: number; max: number; step: number };
    geoShards: { min: number; max: number; step: number };
    matcherWorkers: { min: number; max: number; step: number };
  };
  assumptions: {
    locationPayloadBytes: number;
    locationUpdatesPerShard: number;
    candidateScoresPerWorker: number;
    candidateScoreCapPerRequest: number;
    targetUtilizationPercent: number;
  };
  densityProfiles: DensityProfile[];
};

function isDispatchModel(value: unknown): value is DispatchModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as DispatchModel;
  const bounds = candidate.bounds;
  const assumptions = candidate.assumptions;
  const validBound = (bound: { min: number; max: number; step: number } | undefined) => Boolean(
    bound
      && Number.isFinite(bound.min)
      && Number.isFinite(bound.max)
      && Number.isFinite(bound.step),
  );
  return Boolean(
    candidate.defaults
      && typeof candidate.defaults.onlineDrivers === 'number'
      && typeof candidate.defaults.updateIntervalSeconds === 'number'
      && typeof candidate.defaults.peakMatchRequestsPerSecond === 'number'
      && typeof candidate.defaults.searchRings === 'number'
      && typeof candidate.defaults.densityProfileId === 'string'
      && typeof candidate.defaults.geoShards === 'number'
      && typeof candidate.defaults.matcherWorkers === 'number'
      && bounds
      && validBound(bounds.onlineDrivers)
      && validBound(bounds.updateIntervalSeconds)
      && validBound(bounds.peakMatchRequestsPerSecond)
      && validBound(bounds.searchRings)
      && validBound(bounds.geoShards)
      && validBound(bounds.matcherWorkers)
      && assumptions
      && Number.isFinite(assumptions.locationPayloadBytes)
      && Number.isFinite(assumptions.locationUpdatesPerShard)
      && Number.isFinite(assumptions.candidateScoresPerWorker)
      && Number.isFinite(assumptions.candidateScoreCapPerRequest)
      && Number.isFinite(assumptions.targetUtilizationPercent)
      && Array.isArray(candidate.densityProfiles)
      && candidate.densityProfiles.length > 0
      && candidate.densityProfiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.driversPerCell === 'number'
        && typeof profile.detail === 'string'
      )),
  );
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return Math.round(value).toLocaleString();
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

export default function RideSharingDispatchCapacityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<DispatchModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onlineDrivers, setOnlineDrivers] = useState(2_000_000);
  const [updateIntervalSeconds, setUpdateIntervalSeconds] = useState(4);
  const [peakMatchRequestsPerSecond, setPeakMatchRequestsPerSecond] = useState(1_200);
  const [searchRings, setSearchRings] = useState(1);
  const [densityProfileId, setDensityProfileId] = useState('urban');
  const [geoShards, setGeoShards] = useState(8);
  const [matcherWorkers, setMatcherWorkers] = useState(12);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The dispatch capacity model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((model) => {
        if (!isDispatchModel(model)) throw new Error('The dispatch capacity model is invalid.');
        setData(model);
        setOnlineDrivers(model.defaults.onlineDrivers);
        setUpdateIntervalSeconds(model.defaults.updateIntervalSeconds);
        setPeakMatchRequestsPerSecond(model.defaults.peakMatchRequestsPerSecond);
        setSearchRings(model.defaults.searchRings);
        setDensityProfileId(model.defaults.densityProfileId);
        setGeoShards(model.defaults.geoShards);
        setMatcherWorkers(model.defaults.matcherWorkers);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the dispatch capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const calculations = useMemo(() => {
    if (!data) return null;
    const density = data.densityProfiles.find((profile) => profile.id === densityProfileId)
      ?? data.densityProfiles[0];
    const locationUpdatesPerSecond = onlineDrivers / updateIntervalSeconds;
    const locationIngressMbPerSecond = (
      locationUpdatesPerSecond * data.assumptions.locationPayloadBytes
    ) / 1_000_000;
    const cellsVisited = 1 + 3 * searchRings * (searchRings + 1);
    const rawCandidatesPerRequest = cellsVisited * density.driversPerCell;
    const scoredCandidatesPerRequest = Math.min(
      rawCandidatesPerRequest,
      data.assumptions.candidateScoreCapPerRequest,
    );
    const candidateScoresPerSecond = peakMatchRequestsPerSecond * scoredCandidatesPerRequest;
    const locationUtilization = (
      locationUpdatesPerSecond / (geoShards * data.assumptions.locationUpdatesPerShard)
    ) * 100;
    const matcherUtilization = (
      candidateScoresPerSecond / (matcherWorkers * data.assumptions.candidateScoresPerWorker)
    ) * 100;
    const highestUtilization = Math.max(locationUtilization, matcherUtilization);
    const status = highestUtilization > 100 ? 'overloaded' : highestUtilization > data.assumptions.targetUtilizationPercent ? 'tight' : 'healthy';

    return {
      density,
      locationUpdatesPerSecond,
      locationIngressMbPerSecond,
      cellsVisited,
      rawCandidatesPerRequest,
      scoredCandidatesPerRequest,
      candidateScoresPerSecond,
      locationUtilization,
      matcherUtilization,
      status,
    };
  }, [data, densityProfileId, geoShards, matcherWorkers, onlineDrivers, peakMatchRequestsPerSecond, searchRings, updateIntervalSeconds]);

  if (loadError) {
    return (
      <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">Dispatch model unavailable</p>
        <p className="mt-2 opacity-80">{loadError}</p>
      </div>
    );
  }

  if (!data || !calculations) {
    return (
      <div
        className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading dispatch capacity model"
      />
    );
  }

  const reset = () => {
    setOnlineDrivers(data.defaults.onlineDrivers);
    setUpdateIntervalSeconds(data.defaults.updateIntervalSeconds);
    setPeakMatchRequestsPerSecond(data.defaults.peakMatchRequestsPerSecond);
    setSearchRings(data.defaults.searchRings);
    setDensityProfileId(data.defaults.densityProfileId);
    setGeoShards(data.defaults.geoShards);
    setMatcherWorkers(data.defaults.matcherWorkers);
  };
  const statusStyle = calculations.status === 'healthy'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
    : calculations.status === 'tight'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50';
  const StatusIcon = calculations.status === 'healthy' ? CheckCircle2 : AlertTriangle;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Geospatial dispatch capacity lab"
        title="Find the first bottleneck before a rider requests a car"
        description="Change location cadence, regional supply, search radius, and provisioned workers. The model keeps location ingestion and candidate scoring separate so one average cannot hide the overloaded stage."
        icon={MapPinned}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Concurrently online drivers"
              value={onlineDrivers}
              output={compact(onlineDrivers)}
              {...data.bounds.onlineDrivers}
              accent="cyan"
              lowLabel="quiet region set"
              highLabel="global peak set"
              onChange={setOnlineDrivers}
            />
            <LabRange
              label="Location interval"
              value={updateIntervalSeconds}
              output={`${updateIntervalSeconds}s`}
              {...data.bounds.updateIntervalSeconds}
              accent="blue"
              lowLabel="fresher, more writes"
              highLabel="older, fewer writes"
              onChange={setUpdateIntervalSeconds}
            />
            <LabRange
              label="Peak match requests"
              value={peakMatchRequestsPerSecond}
              output={`${compact(peakMatchRequestsPerSecond)}/s`}
              {...data.bounds.peakMatchRequestsPerSecond}
              accent="violet"
              lowLabel="normal demand"
              highLabel="citywide spike"
              onChange={setPeakMatchRequestsPerSecond}
            />
            <LabRange
              label="Neighbor rings"
              value={searchRings}
              output={`${searchRings}`}
              {...data.bounds.searchRings}
              accent="amber"
              lowLabel="pickup cell only"
              highLabel="wide expansion"
              onChange={setSearchRings}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Supply density</legend>
              <div className="mt-3 space-y-2">
                {data.densityProfiles.map((profile) => (
                  <LabChoice
                    key={profile.id}
                    selected={densityProfileId === profile.id}
                    label={`${profile.label}: ${profile.driversPerCell} drivers/cell`}
                    detail={profile.detail}
                    icon={Users}
                    accent={profile.id === 'event' ? 'rose' : profile.id === 'urban' ? 'violet' : 'blue'}
                    onClick={() => setDensityProfileId(profile.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Geo-index shards"
              value={geoShards}
              output={`${geoShards}`}
              {...data.bounds.geoShards}
              accent="emerald"
              lowLabel="less capacity"
              highLabel="more ownership splits"
              onChange={setGeoShards}
            />
            <LabRange
              label="Matcher workers"
              value={matcherWorkers}
              output={`${matcherWorkers}`}
              {...data.bounds.matcherWorkers}
              accent="emerald"
              lowLabel="small pool"
              highLabel="large pool"
              onChange={setMatcherWorkers}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <LabMetric
            label="Location updates"
            value={`${compact(calculations.locationUpdatesPerSecond)}/s`}
            detail={`${calculations.locationIngressMbPerSecond.toFixed(1)} MB/s before replication and protocol overhead`}
            icon={RadioTower}
            tone="cyan"
          />
          <LabMetric
            label="Geo cells visited"
            value={`${calculations.cellsVisited}`}
            detail={`${compact(calculations.rawCandidatesPerRequest)} raw candidates at ${calculations.density.label.toLowerCase()} density`}
            icon={ScanSearch}
            tone="amber"
          />
          <LabMetric
            label="Candidate scoring"
            value={`${compact(calculations.candidateScoresPerSecond)}/s`}
            detail={`${calculations.scoredCandidatesPerRequest} candidates/request after the ${data.assumptions.candidateScoreCapPerRequest} candidate cap`}
            icon={Activity}
            tone="violet"
          />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 dark:border-neutral-800">
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Provisioned capacity envelope</p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">The 70% target leaves modeled room for skew, retries, failover, and deployments.</p>
          </div>
          <div className="space-y-5 p-4">
            {[
              { label: 'Location shard utilization', value: calculations.locationUtilization, icon: Server },
              { label: 'Matcher worker utilization', value: calculations.matcherUtilization, icon: Gauge },
            ].map((item) => {
              const pressure = item.value > 100 ? 'bg-rose-600 dark:bg-rose-400' : item.value > data.assumptions.targetUtilizationPercent ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-400';
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                      <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {item.label}
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">{percent(item.value)}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="progressbar" aria-label={item.label} aria-valuenow={Math.min(100, Math.round(item.value))} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${pressure}`} style={{ width: `${Math.min(100, Math.max(2, item.value))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['1. Ingest', 'Accept a sequenced location and reject packets older than the driver cursor.'],
            ['2. Index', 'Move the driver between regional cells and refresh the availability lease.'],
            ['3. Expand', `Read ${calculations.cellsVisited} cells, stopping when the candidate budget is sufficient.`],
            ['4. Score', 'Apply eligibility filters, calculate pickup ETA, then make one durable claim.'],
          ].map(([title, detail]) => (
            <li key={title} className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{title}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{detail}</p>
            </li>
          ))}
        </ol>

        <div className={`mt-5 rounded-md border p-4 ${statusStyle}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                {calculations.status === 'healthy' ? 'Headroom preserved' : calculations.status === 'tight' ? 'Headroom target crossed' : 'Provisioned stage overloaded'}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {calculations.status === 'healthy'
                  ? 'Both modeled stages remain below the target. Validate the per-shard and per-worker assumptions with production-shaped benchmarks.'
                  : calculations.locationUtilization >= calculations.matcherUtilization
                    ? 'Location ingestion is the first pressure point. Add regional ownership capacity, reduce unnecessary cadence, or shed stale sessions before matching is affected.'
                    : 'Candidate scoring is the first pressure point. Apply cheap eligibility filters, cap candidates, stop ring expansion early, or add matcher workers.'}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
