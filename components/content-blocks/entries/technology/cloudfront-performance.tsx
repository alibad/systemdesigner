'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleAlert,
  Cloud,
  Gauge,
  Network,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/cloudfront-performance';

type Profile = {
  id: string;
  label: string;
  detail: string;
  viewerRps: number;
  hitRate: number;
  duplicateMissPct: number;
  originCapacity: number;
};

const profiles: Profile[] = [
  {
    id: 'catalog',
    label: 'Versioned catalog assets',
    detail: 'Long-lived objects share a narrow cache key and are safe to reuse.',
    viewerRps: 50000,
    hitRate: 94,
    duplicateMissPct: 70,
    originCapacity: 5000,
  },
  {
    id: 'api',
    label: 'Read-heavy API',
    detail: 'Short freshness windows still permit caching, but variants need discipline.',
    viewerRps: 30000,
    hitRate: 72,
    duplicateMissPct: 45,
    originCapacity: 6000,
  },
  {
    id: 'fragmented',
    label: 'Fragmented cache key',
    detail: 'Forwarded values create duplicate objects even when the response is identical.',
    viewerRps: 40000,
    hitRate: 38,
    duplicateMissPct: 60,
    originCapacity: 8000,
  },
];

export default function CloudFrontPerformance() {
  const [profileId, setProfileId] = useState(profiles[0].id);
  const [viewerRps, setViewerRps] = useState(profiles[0].viewerRps);
  const [hitRate, setHitRate] = useState(profiles[0].hitRate);
  const [duplicateMissPct, setDuplicateMissPct] = useState(profiles[0].duplicateMissPct);
  const [originCapacity, setOriginCapacity] = useState(profiles[0].originCapacity);
  const [originShield, setOriginShield] = useState(true);

  const model = useMemo(() => {
    const edgeMissRps = viewerRps * (1 - hitRate / 100);
    const collapsibleMissRps = edgeMissRps * (duplicateMissPct / 100);
    const originRps = Math.max(
      0,
      edgeMissRps - (originShield ? collapsibleMissRps * 0.8 : 0),
    );
    const originPressurePct = (originRps / originCapacity) * 100;
    return {
      edgeHitRps: viewerRps - edgeMissRps,
      edgeMissRps,
      originRps,
      requestsAvoided: edgeMissRps - originRps,
      originPressurePct,
      healthy: originPressurePct < 75,
    };
  }, [duplicateMissPct, hitRate, originCapacity, originShield, viewerRps]);

  const applyProfile = (profile: Profile) => {
    setProfileId(profile.id);
    setViewerRps(profile.viewerRps);
    setHitRate(profile.hitRate);
    setDuplicateMissPct(profile.duplicateMissPct);
    setOriginCapacity(profile.originCapacity);
  };

  const reset = () => {
    applyProfile(profiles[0]);
    setOriginShield(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cache-miss pressure lab"
          title="Protect the origin, not only the average hit rate"
          description="Change traffic, cache reuse, and duplicate misses. The model keeps every assumption visible so you can see which requests still reach the origin."
          icon={Cloud}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload</p>
                <div className="mt-3 space-y-2">
                  {profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={Boxes}
                      accent="blue"
                      onClick={() => applyProfile(profile)}
                    />
                  ))}
                </div>
              </div>
              <LabRange
                label="Viewer traffic"
                value={viewerRps}
                output={`${viewerRps.toLocaleString()} req/s`}
                min={5000}
                max={100000}
                step={1000}
                lowLabel="normal"
                highLabel="event peak"
                accent="cyan"
                onChange={setViewerRps}
              />
              <LabRange
                label="Edge cache hit rate"
                value={hitRate}
                output={`${hitRate}%`}
                min={20}
                max={99}
                lowLabel="fragmented"
                highLabel="reused"
                accent="emerald"
                onChange={setHitRate}
              />
              <LabRange
                label="Duplicate share of misses"
                value={duplicateMissPct}
                output={`${duplicateMissPct}%`}
                min={0}
                max={90}
                step={5}
                lowLabel="unique objects"
                highLabel="same object burst"
                accent="violet"
                onChange={setDuplicateMissPct}
              />
              <LabRange
                label="Tested origin capacity"
                value={originCapacity}
                output={`${originCapacity.toLocaleString()} req/s`}
                min={1000}
                max={20000}
                step={500}
                lowLabel="small origin"
                highLabel="more headroom"
                accent="amber"
                onChange={setOriginCapacity}
              />
              <button
                type="button"
                aria-pressed={originShield}
                onClick={() => setOriginShield((value) => !value)}
                className={`w-full rounded-md border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  originShield
                    ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Network aria-hidden="true" className="h-4 w-4" />
                  Origin Shield {originShield ? 'enabled' : 'disabled'}
                </span>
                <span className="mt-1 block text-xs leading-5 opacity-75">
                  The teaching model collapses 80% of simultaneous duplicate misses when enabled.
                </span>
              </button>
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.healthy
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Origin verdict</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.healthy ? 'The miss path has measured headroom' : 'The origin is outside its tested envelope'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.healthy
                    ? `Modeled origin pressure is ${Math.round(model.originPressurePct)}%. Keep a cache-regression alarm because the origin must survive the failure state, not just today's average.`
                    : `Modeled origin pressure is ${Math.round(model.originPressurePct)}%. Narrow the cache key, restore reuse, shed optional work, or add tested origin capacity before the peak.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Edge hits" value={`${Math.round(model.edgeHitRps).toLocaleString()}/s`} detail="served without an origin request" icon={Activity} tone="emerald" />
            <LabMetric label="Edge misses" value={`${Math.round(model.edgeMissRps).toLocaleString()}/s`} detail="forwarded to the next cache layer" icon={Network} tone="amber" />
            <LabMetric label="Origin load" value={`${Math.round(model.originRps).toLocaleString()}/s`} detail={`${Math.round(model.originPressurePct)}% of tested capacity`} icon={Gauge} tone={model.healthy ? 'blue' : 'rose'} />
            <LabMetric label="Collapsed misses" value={`${Math.round(model.requestsAvoided).toLocaleString()}/s`} detail="teaching estimate, not an AWS guarantee" icon={ShieldCheck} tone="violet" />
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              <span>Request stage</span><span>Requests per second</span>
            </div>
            {[
              ['Viewer requests', viewerRps],
              ['Edge cache hits', model.edgeHitRps],
              ['Edge cache misses', model.edgeMissRps],
              ['Origin requests', model.originRps],
            ].map(([label, value]) => (
              <div key={String(label)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-neutral-100 px-4 py-3 text-sm last:border-b-0 dark:border-neutral-900">
                <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
                <span className="font-semibold tabular-nums text-neutral-950 dark:text-white">{Math.round(Number(value)).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
