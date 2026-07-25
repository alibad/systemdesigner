'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Database,
  Gauge,
  Layers3,
  RefreshCw,
  Route,
  ShieldCheck,
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

type TrafficProfile = {
  id: string;
  label: string;
  detail: string;
  redirectRps: number;
  defaultHitRate: number;
  burstMultiplier: number;
  hotKeyShare: number;
};

type MissProtection = {
  id: string;
  label: string;
  detail: string;
  hotKeyReduction: number;
  burstReduction: number;
};

type PressureModel = {
  storeCapacityRps: number;
  storeBaseP99Ms: number;
  cacheP99Ms: number;
  defaults: {
    profileId: string;
    protectionId: string;
  };
  profiles: TrafficProfile[];
  protections: MissProtection[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/url-shortener-read-path/data/read-path-pressure-model.json';

function isPressureModel(value: unknown): value is PressureModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<PressureModel>;
  return (
    typeof model.storeCapacityRps === 'number'
    && typeof model.storeBaseP99Ms === 'number'
    && typeof model.cacheP99Ms === 'number'
    && !!model.defaults
    && typeof model.defaults.profileId === 'string'
    && typeof model.defaults.protectionId === 'string'
    && Array.isArray(model.profiles)
    && model.profiles.length > 0
    && Array.isArray(model.protections)
    && model.protections.length > 0
  );
}

function formatRate(value: number) {
  return `${Math.round(value).toLocaleString()}/s`;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
            The pressure model could not be loaded
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center" role="status">
          <Activity
            aria-hidden="true"
            className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none"
          />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Loading the read-path model...
          </p>
        </div>
      )}
    </div>
  );
}

export default function UrlShortenerReadPathPressureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<PressureModel | null>(null);
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
        if (!isPressureModel(payload)) {
          throw new Error('The read-path pressure model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the pressure model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block="fundamentals/url-shortener-read-path-pressure-lab">
        <LearningLab>
          <LearningLabHeader
            eyebrow="Cache pressure lab"
            title="See when a small miss ratio becomes a large origin load"
            description="Change traffic, hit rate, and hot-key protection. The model keeps the redirect total fixed while exposing storage demand and burst risk."
            icon={Gauge}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      </div>
    );
  }

  return <PressureWorkbench model={model} />;
}

function PressureWorkbench({ model }: { model: PressureModel }) {
  const defaultProfile =
    model.profiles.find((item) => item.id === model.defaults.profileId) ?? model.profiles[0];
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [protectionId, setProtectionId] = useState(model.defaults.protectionId);
  const [hitRate, setHitRate] = useState(defaultProfile.defaultHitRate);

  const profile = model.profiles.find((item) => item.id === profileId) ?? model.profiles[0];
  const protection =
    model.protections.find((item) => item.id === protectionId) ?? model.protections[0];

  const result = useMemo(() => {
    const missRate = (100 - hitRate) / 100;
    const cacheHits = profile.redirectRps * (hitRate / 100);
    const unprotectedMisses = profile.redirectRps * missRate;
    const hotMisses = unprotectedMisses * (profile.hotKeyShare / 100);
    const coldMisses = unprotectedMisses - hotMisses;
    const protectedHotMisses = hotMisses * (1 - protection.hotKeyReduction);
    const steadyOriginRps = coldMisses + protectedHotMisses;
    const burstFactor =
      1 + (profile.burstMultiplier - 1) * (1 - protection.burstReduction);
    const burstOriginRps = steadyOriginRps * burstFactor;
    const rawBurstOriginRps = unprotectedMisses * profile.burstMultiplier;
    const utilization = burstOriginRps / model.storeCapacityRps;
    const protectedReads = Math.max(0, rawBurstOriginRps - burstOriginRps);

    let missP99Ms = model.storeBaseP99Ms;
    if (utilization > 1) {
      missP99Ms = model.storeBaseP99Ms * (3 + (utilization - 1) * 12);
    } else if (utilization > 0.7) {
      missP99Ms =
        model.storeBaseP99Ms * (1 + ((utilization - 0.7) / 0.3) * 2);
    }

    const state =
      utilization > 1
        ? {
            label: 'Origin overload',
            detail:
              'Burst misses exceed store capacity. Queueing and timeouts can amplify retries.',
            tone: 'rose' as const,
          }
        : utilization > 0.7
          ? {
              label: 'Thin headroom',
              detail:
                'The store can absorb this modelled burst, but normal variance can exhaust the margin.',
              tone: 'amber' as const,
            }
          : {
              label: 'Bounded miss path',
              detail:
                'Burst origin demand remains below 70% of the declared store capacity.',
              tone: 'emerald' as const,
            };

    return {
      cacheHits,
      unprotectedMisses,
      burstOriginRps,
      utilization,
      protectedReads,
      missP99Ms,
      state,
    };
  }, [hitRate, model, profile, protection]);

  function chooseProfile(nextProfile: TrafficProfile) {
    setProfileId(nextProfile.id);
    setHitRate(nextProfile.defaultHitRate);
  }

  function reset() {
    setProfileId(defaultProfile.id);
    setHitRate(defaultProfile.defaultHitRate);
    setProtectionId(model.defaults.protectionId);
  }

  return (
    <div data-content-block="fundamentals/url-shortener-read-path-pressure-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cache pressure lab"
          title="See when a small miss ratio becomes a large origin load"
          description="Change traffic, hit rate, and hot-key protection. The model keeps the redirect total fixed while exposing storage demand and burst risk."
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Traffic shape
                </legend>
                <div className="mt-3 space-y-2">
                  {model.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={profile.id === item.id}
                      label={item.label}
                      detail={`${item.detail} ${formatRate(item.redirectRps)}.`}
                      icon={Route}
                      accent="cyan"
                      onClick={() => chooseProfile(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Cache hit rate"
                value={hitRate}
                output={`${hitRate}%`}
                min={65}
                max={99}
                step={1}
                accent="cyan"
                lowLabel="Cold or ineffective"
                highLabel="Highly effective"
                onChange={setHitRate}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Miss protection
                </legend>
                <div className="mt-3 space-y-2">
                  {model.protections.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={protection.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent="emerald"
                      onClick={() => setProtectionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Cache hits"
                value={formatRate(result.cacheHits)}
                detail={`${hitRate}% of redirects avoid durable storage.`}
                icon={Layers3}
                tone="cyan"
              />
              <LabMetric
                label="Burst origin reads"
                value={formatRate(result.burstOriginRps)}
                detail={`${formatRate(result.unprotectedMisses)} steady misses before burst protection.`}
                icon={Database}
                tone={result.state.tone}
              />
              <LabMetric
                label="Store utilization"
                value={`${Math.round(result.utilization * 100)}%`}
                detail={`${formatRate(model.storeCapacityRps)} declared read capacity.`}
                icon={Gauge}
                tone={result.state.tone}
              />
              <LabMetric
                label="Modelled miss p99"
                value={`${Math.round(result.missP99Ms)} ms`}
                detail="Teaching estimate for a cache miss, not the cache-hit path."
                icon={Activity}
                tone={result.state.tone}
              />
            </div>

            <section
              className={`mt-5 rounded-md border p-4 ${
                result.state.tone === 'rose'
                  ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                  : result.state.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.state.tone === 'rose' ? (
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300"
                  />
                ) : (
                  <ShieldCheck
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      result.state.tone === 'amber'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950 dark:text-white">
                    {result.state.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.state.detail}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Miss-path protection
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Reads prevented at the burst peak by the selected teaching model.
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatRate(result.protectedReads)}
                </span>
              </div>
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  <Layers3 aria-hidden="true" className="h-4 w-4" />
                  Cache
                  <span aria-hidden="true" className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
                  <Database aria-hidden="true" className="h-4 w-4" />
                  Store
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {protection.id === 'none'
                    ? 'Each miss independently crosses the storage boundary, so hot-key and synchronized-expiry bursts are fully amplified.'
                    : `${protection.label} reduces duplicate work, but ${formatRate(result.burstOriginRps)} still reaches durable storage and must fit its real capacity.`}
                </p>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
