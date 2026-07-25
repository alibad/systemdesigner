'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Radio,
  RefreshCw,
  Router,
  TriangleAlert,
  Wifi,
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

type Bound = { min: number; max: number; step: number };
type WorkloadProfile = {
  id: string;
  label: string;
  detail: string;
  deadlineMs: number;
  localComputeMs: number;
  cloudComputeMs: number;
  mustOperateOffline: boolean;
  evidence: string;
};
type PlacementModel = {
  uplinkMbps: number;
  defaults: {
    profileId: string;
    eventsPerSecond: number;
    payloadKb: number;
    localReductionPercent: number;
    wanRoundTripMs: number;
  };
  bounds: {
    eventsPerSecond: Bound;
    payloadKb: Bound;
    localReductionPercent: Bound;
    wanRoundTripMs: Bound;
  };
  profiles: WorkloadProfile[];
};

const BLOCK_ID = 'fundamentals/edge-computing-systems-placement-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/edge-computing-systems/data/workload-placement-model.json';

function isPlacementModel(value: unknown): value is PlacementModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<PlacementModel>;
  return Boolean(
    model.uplinkMbps
      && model.defaults?.profileId
      && model.bounds?.eventsPerSecond
      && model.bounds?.payloadKb
      && model.bounds?.localReductionPercent
      && model.bounds?.wanRoundTripMs
      && Array.isArray(model.profiles)
      && model.profiles.length >= 2,
  );
}

function profileIcon(profileId: string) {
  if (profileId === 'safety-loop') return Zap;
  if (profileId === 'camera-safety') return Radio;
  if (profileId === 'inventory-sync') return Router;
  return Cloud;
}

function formatMbps(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} Mbps`;
}

function formatMs(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ms`;
}

export default function EdgeComputingSystemsPlacementLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PlacementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [eventsPerSecond, setEventsPerSecond] = useState(120);
  const [payloadKb, setPayloadKb] = useState(350);
  const [localReductionPercent, setLocalReductionPercent] = useState(96);
  const [wanRoundTripMs, setWanRoundTripMs] = useState(85);

  function reset(model: PlacementModel) {
    setProfileId(model.defaults.profileId);
    setEventsPerSecond(model.defaults.eventsPerSecond);
    setPayloadKb(model.defaults.payloadKb);
    setLocalReductionPercent(model.defaults.localReductionPercent);
    setWanRoundTripMs(model.defaults.wanRoundTripMs);
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
        if (!isPlacementModel(payload)) throw new Error('The workload placement model is incomplete.');
        setData(payload);
        reset(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load placement data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const view = useMemo(() => {
    if (!data) return null;
    const profile = data.profiles.find((candidate) => candidate.id === profileId) ?? data.profiles[0];
    const rawMbps = eventsPerSecond * payloadKb * 8 / 1000;
    const upstreamMbps = rawMbps * (1 - localReductionPercent / 100);
    const localLatencyMs = profile.localComputeMs + 4;
    const transferMs = payloadKb * 8 / data.uplinkMbps;
    const cloudLatencyMs = wanRoundTripMs + profile.cloudComputeMs + transferMs;
    const localMeetsDeadline = localLatencyMs <= profile.deadlineMs;
    const cloudMeetsDeadline = cloudLatencyMs <= profile.deadlineMs;
    const rawLinkOverloaded = rawMbps > data.uplinkMbps;
    const filteredLinkOverloaded = upstreamMbps > data.uplinkMbps;

    let recommendation = 'Redesign the path';
    let tone: 'emerald' | 'amber' | 'rose' | 'blue' = 'rose';
    let reason = 'Neither execution path meets the declared deadline with the current assumptions.';

    if (profile.mustOperateOffline && localMeetsDeadline) {
      recommendation = 'Edge-primary, cloud-coordinated';
      tone = filteredLinkOverloaded ? 'amber' : 'emerald';
      reason = filteredLinkOverloaded
        ? 'Local decisions survive disconnection, but the selected evidence stream still exceeds the uplink.'
        : 'The local path meets the deadline and remains available without the WAN; the cloud can coordinate policy, models, and history.';
    } else if (localMeetsDeadline && (!cloudMeetsDeadline || rawLinkOverloaded)) {
      recommendation = 'Hybrid edge and cloud';
      tone = filteredLinkOverloaded ? 'amber' : 'blue';
      reason = 'Use local filtering or decisions to protect the deadline and uplink, then forward selected evidence for global work.';
    } else if (cloudMeetsDeadline && !rawLinkOverloaded) {
      recommendation = 'Cloud-primary';
      tone = 'blue';
      reason = 'The network and centralized compute meet the deadline, so fleet-wide elastic execution can remain centralized.';
    }

    return {
      profile,
      rawMbps,
      upstreamMbps,
      localLatencyMs,
      cloudLatencyMs,
      localMeetsDeadline,
      cloudMeetsDeadline,
      rawLinkOverloaded,
      filteredLinkOverloaded,
      recommendation,
      reason,
      tone,
    };
  }, [data, eventsPerSecond, localReductionPercent, payloadKb, profileId, wanRoundTripMs]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Workload placement lab"
          title="Put the deadline and the uplink on the same decision"
          description="Choose a workload, then change event volume, payload size, local reduction, and WAN latency. The model compares a bounded local path with a cloud round trip instead of treating edge placement as a slogan."
          icon={Router}
          accent="cyan"
          onReset={data ? () => reset(data) : undefined}
        />

        {!data || !view ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                  Placement data could not be loaded
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading workload model...</p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Workload contract
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === view.profile.id}
                        label={profile.label}
                        detail={profile.detail}
                        icon={profileIcon(profile.id)}
                        accent={profile.mustOperateOffline ? 'cyan' : 'blue'}
                        onClick={() => setProfileId(profile.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Events per second"
                  value={eventsPerSecond}
                  output={`${eventsPerSecond}/s`}
                  {...data.bounds.eventsPerSecond}
                  accent="blue"
                  lowLabel="quiet site"
                  highLabel="dense stream"
                  onChange={setEventsPerSecond}
                />
                <LabRange
                  label="Payload per event"
                  value={payloadKb}
                  output={`${payloadKb} KB`}
                  {...data.bounds.payloadKb}
                  accent="violet"
                  lowLabel="telemetry"
                  highLabel="rich media"
                  onChange={setPayloadKb}
                />
                <LabRange
                  label="Local reduction"
                  value={localReductionPercent}
                  output={`${localReductionPercent}%`}
                  {...data.bounds.localReductionPercent}
                  accent="emerald"
                  lowLabel="forward raw"
                  highLabel="events only"
                  onChange={setLocalReductionPercent}
                />
                <LabRange
                  label="WAN round trip"
                  value={wanRoundTripMs}
                  output={formatMs(wanRoundTripMs)}
                  {...data.bounds.wanRoundTripMs}
                  accent="amber"
                  lowLabel="near region"
                  highLabel="degraded link"
                  onChange={setWanRoundTripMs}
                />
              </div>
            }
          >
            <div aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Raw source traffic"
                  value={formatMbps(view.rawMbps)}
                  detail={`Compared with a ${formatMbps(data.uplinkMbps)} site uplink.`}
                  icon={Radio}
                  tone={view.rawLinkOverloaded ? 'rose' : 'blue'}
                />
                <LabMetric
                  label="Selected upstream"
                  value={formatMbps(view.upstreamMbps)}
                  detail={`${localReductionPercent}% is filtered, aggregated, or discarded locally.`}
                  icon={Wifi}
                  tone={view.filteredLinkOverloaded ? 'rose' : 'emerald'}
                />
                <LabMetric
                  label="Local decision"
                  value={formatMs(view.localLatencyMs)}
                  detail={`${view.localMeetsDeadline ? 'Within' : 'Outside'} the ${formatMs(view.profile.deadlineMs)} deadline.`}
                  icon={Cpu}
                  tone={view.localMeetsDeadline ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Cloud round trip"
                  value={formatMs(view.cloudLatencyMs)}
                  detail={`${view.cloudMeetsDeadline ? 'Within' : 'Outside'} the same deadline.`}
                  icon={Cloud}
                  tone={view.cloudMeetsDeadline ? 'blue' : 'amber'}
                />
              </div>

              <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Compare the two execution paths</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                      A passed deadline does not automatically provide offline autonomy.
                    </p>
                  </div>
                  <span className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                    Deadline {formatMs(view.profile.deadlineMs)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div className={`rounded-md border p-4 ${view.localMeetsDeadline ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      <Radio aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      Device
                      <ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" />
                      <Cpu aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Edge action
                    </div>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {view.profile.mustOperateOffline ? 'Remains available during a WAN outage.' : 'Available locally, but offline execution is not required by this workload.'}
                    </p>
                  </div>
                  <div className={`rounded-md border p-4 ${view.cloudMeetsDeadline ? 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30' : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      <Radio aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      Device
                      <ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" />
                      <Cloud aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Cloud result
                    </div>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      Includes WAN latency and transmission time for one raw event.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    <span>Uplink after local processing</span>
                    <span className="tabular-nums">{formatMbps(view.upstreamMbps)} / {formatMbps(data.uplinkMbps)}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${view.filteredLinkOverloaded ? 'bg-rose-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, view.upstreamMbps / data.uplinkMbps * 100)}%` }}
                    />
                  </div>
                </div>
              </section>

              <section className={`mt-5 rounded-md border p-4 ${view.tone === 'rose' ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : view.tone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : view.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'}`}>
                <div className="flex items-start gap-3">
                  {view.tone === 'rose' || view.tone === 'amber' ? (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">{view.recommendation}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{view.reason}</p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{view.profile.evidence}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
