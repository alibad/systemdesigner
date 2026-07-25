'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CircleAlert,
  Gauge,
  LoaderCircle,
  ShieldCheck,
  TimerReset,
  Waves,
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
type BurstProfile = {
  id: string;
  label: string;
  detail: string;
  arrivalRate: number;
  durationSeconds: number;
  refillRate: number;
  capacity: number;
};
type BurstModel = {
  title: string;
  description: string;
  bounds: {
    arrivalRate: Bound;
    durationSeconds: Bound;
    refillRate: Bound;
    capacity: Bound;
  };
  profiles: BurstProfile[];
};
type Tick = {
  second: number;
  tokensBefore: number;
  admitted: number;
  rejected: number;
  tokensAfter: number;
};

const BLOCK_ID = 'technology/rate-limiting-impact';
const DEFAULT_DATA_FILE = '/api/content/technology/rate-limiting/data/token-bucket-bursts.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isProfile(value: unknown): value is BurstProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BurstProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isFiniteNumber(candidate.arrivalRate)
      && isFiniteNumber(candidate.durationSeconds)
      && isFiniteNumber(candidate.refillRate)
      && isFiniteNumber(candidate.capacity),
  );
}

function isBurstModel(value: unknown): value is BurstModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BurstModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.bounds
      && isBound(candidate.bounds.arrivalRate)
      && isBound(candidate.bounds.durationSeconds)
      && isBound(candidate.bounds.refillRate)
      && isBound(candidate.bounds.capacity)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 3
      && candidate.profiles.every(isProfile),
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function RateLimitingImpact({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BurstModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [arrivalRate, setArrivalRate] = useState(24);
  const [durationSeconds, setDurationSeconds] = useState(6);
  const [refillRate, setRefillRate] = useState(10);
  const [capacity, setCapacity] = useState(30);

  function applyProfile(profile: BurstProfile) {
    setProfileId(profile.id);
    setArrivalRate(profile.arrivalRate);
    setDurationSeconds(profile.durationSeconds);
    setRefillRate(profile.refillRate);
    setCapacity(profile.capacity);
  }

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isBurstModel(payload)) throw new Error('The burst model is incomplete.');
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the burst model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    const ticks: Tick[] = [];
    let tokens = capacity;

    for (let second = 0; second < durationSeconds; second += 1) {
      if (second > 0) tokens = Math.min(capacity, tokens + refillRate);
      const tokensBefore = tokens;
      const admitted = Math.min(arrivalRate, Math.floor(tokensBefore));
      const rejected = arrivalRate - admitted;
      tokens = tokensBefore - admitted;
      ticks.push({ second, tokensBefore, admitted, rejected, tokensAfter: tokens });
    }

    const incoming = arrivalRate * durationSeconds;
    const admitted = ticks.reduce((total, tick) => total + tick.admitted, 0);
    const rejected = incoming - admitted;
    const acceptancePct = incoming === 0 ? 100 : (admitted / incoming) * 100;
    const tokenSupply = capacity + refillRate * Math.max(0, durationSeconds - 1);

    return {
      acceptancePct,
      admitted,
      incoming,
      rejected,
      ticks,
      tokenSupply,
    };
  }, [arrivalRate, capacity, durationSeconds, refillRate]);

  const selectedProfile = data?.profiles.find((profile) => profile.id === profileId);
  const tone = result.rejected === 0 ? 'emerald' : result.acceptancePct >= 80 ? 'amber' : 'rose';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Burst admission lab"
          title={data?.title ?? 'What will this token bucket admit?'}
          description={data?.description ?? 'Loading the burst model.'}
          icon={Waves}
          accent="cyan"
          onReset={data ? () => applyProfile(data.profiles[0]) : undefined}
        />

        {!data ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Traffic shape
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={profile.id === 'steady-client' ? Activity : profile.id === 'webhook-recovery' ? TimerReset : Waves}
                        accent={profile.id === 'steady-client' ? 'emerald' : profile.id === 'webhook-recovery' ? 'amber' : 'cyan'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange label="Requests each second" value={arrivalRate} output={`${arrivalRate}/s`} {...data.bounds.arrivalRate} accent="rose" lowLabel="Light arrival" highLabel="Sharp burst" onChange={(value) => { setProfileId(''); setArrivalRate(value); }} />
                <LabRange label="Burst duration" value={durationSeconds} output={`${durationSeconds}s`} {...data.bounds.durationSeconds} accent="violet" lowLabel="Short" highLabel="Sustained" onChange={(value) => { setProfileId(''); setDurationSeconds(value); }} />
                <LabRange label="Token refill" value={refillRate} output={`${refillRate}/s`} {...data.bounds.refillRate} accent="blue" lowLabel="Lower average" highLabel="Higher average" onChange={(value) => { setProfileId(''); setRefillRate(value); }} />
                <LabRange label="Bucket capacity" value={capacity} output={`${capacity} tokens`} {...data.bounds.capacity} accent="cyan" lowLabel="Small burst" highLabel="Large burst" onChange={(value) => { setProfileId(''); setCapacity(value); }} />
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className={`rounded-md border p-5 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}>
                <div className="flex items-start gap-3">
                  {result.rejected === 0 ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Ban aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-70">Admission verdict</p>
                    <h4 className="mt-1 text-lg font-semibold">
                      {result.rejected === 0 ? 'The modeled burst fits' : `${compact(result.rejected)} requests exceed available tokens`}
                    </h4>
                    <p className="mt-2 text-sm leading-6 opacity-85">
                      {result.rejected === 0
                        ? 'The full bucket absorbs the opening burst, and refill keeps every later tick inside the policy.'
                        : 'Increasing capacity absorbs a larger opening burst. Increasing refill changes the sustainable rate. They protect different parts of the traffic shape.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Incoming" value={compact(result.incoming)} detail={`${arrivalRate}/s for ${durationSeconds}s`} icon={Activity} tone="neutral" />
                <LabMetric label="Admitted" value={compact(result.admitted)} detail="Requests that consumed a token" icon={ShieldCheck} tone="emerald" />
                <LabMetric label="Rejected" value={compact(result.rejected)} detail="Requests that found no token" icon={Ban} tone={result.rejected > 0 ? 'rose' : 'neutral'} />
                <LabMetric label="Accepted" value={`${Math.round(result.acceptancePct)}%`} detail="Admitted divided by incoming" icon={Gauge} tone={tone} />
              </div>

              <div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Second-by-second trace</p>
                    <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Watch stored burst credit drain</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">The bucket starts full; refill occurs before ticks after t=0.</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {result.ticks.map((tick) => {
                    const admittedPct = arrivalRate === 0 ? 100 : (tick.admitted / arrivalRate) * 100;
                    return (
                      <div key={tick.second} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">t={tick.second}s</span>
                          <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">{Math.floor(tick.tokensBefore)} ready</span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-200 dark:bg-rose-950">
                          <div className="h-full bg-emerald-500" style={{ width: `${admittedPct}%` }} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <span className="text-emerald-700 dark:text-emerald-300"><strong>{tick.admitted}</strong> allowed</span>
                          <span className="text-right text-rose-700 dark:text-rose-300"><strong>{tick.rejected}</strong> denied</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50">
                <div className="flex items-start gap-3">
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">The arithmetic is explicit</p>
                    <p className="mt-1 text-sm leading-6 opacity-85">
                      This discrete trace can expose at most <strong>{compact(result.tokenSupply)} tokens</strong>: {capacity} initially stored plus {refillRate} for each later second. Unused refill is capped by bucket capacity, so actual admissions can be lower when traffic is quiet.
                    </p>
                    {selectedProfile ? <p className="mt-2 text-xs opacity-70">Profile: {selectedProfile.label}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6" role={error ? 'alert' : 'status'}>
      <div className="max-w-md text-center">
        {error ? <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" /> : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-cyan-500 motion-reduce:animate-none" />}
        <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{error ? 'Burst model unavailable' : 'Loading burst model'}</p>
        <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{error ?? 'Preparing the token trace.'}</p>
        {error ? <button type="button" onClick={onRetry} className="mt-4 h-10 rounded-md border border-neutral-300 px-4 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100">Retry</button> : null}
      </div>
    </div>
  );
}
