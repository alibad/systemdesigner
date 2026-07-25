'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BellRing,
  CircleAlert,
  Gauge,
  RadioTower,
  RefreshCw,
  Server,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

type Strategy = 'push' | 'pull' | 'hybrid';

const strategyCopy: Record<Strategy, { label: string; summary: string; tone: string }> = {
  push: {
    label: 'Fan-out on write',
    summary: 'Precompute follower timelines when the post is created.',
    tone: 'border-blue-400/40 bg-blue-400/10 text-blue-100',
  },
  pull: {
    label: 'Fan-out on read',
    summary: 'Fetch the author post when each follower reads their feed.',
    tone: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  },
  hybrid: {
    label: 'Hybrid fan-out',
    summary: 'Push ordinary posts and merge celebrity posts at read time.',
    tone: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  },
};

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

export default function NewsFeedFanoutLab() {
  const [followerExponent, setFollowerExponent] = useState(4.2);
  const [strategy, setStrategy] = useState<Strategy>('push');
  const [lagging, setLagging] = useState(false);

  const followers = Math.round(10 ** followerExponent);
  const recommended: Strategy = followers < 100_000 ? 'push' : followers > 5_000_000 ? 'hybrid' : 'hybrid';
  const model = useMemo(() => {
    const pushWrites = strategy === 'pull' ? 1 : strategy === 'hybrid' ? Math.min(followers, 250_000) : followers;
    const readSources = strategy === 'push' ? 1 : strategy === 'pull' ? Math.min(150, Math.max(4, followers / 100_000)) : 2;
    const queueSeconds = Math.max(0.02, pushWrites / (lagging ? 60_000 : 220_000));
    const readLatency = Math.round(28 + readSources * 7 + (lagging && strategy === 'push' ? 12 : 0));
    const pressure = Math.min(100, Math.round((pushWrites / 1_000_000) * (lagging ? 22 : 9)));
    return { pushWrites, readSources, queueSeconds, readLatency, pressure };
  }, [followers, lagging, strategy]);

  const healthy = model.pressure < 75 && model.readLatency < 200;
  const strategyInfo = strategyCopy[strategy];

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-neutral-950/10">
      <header className="border-b border-neutral-800 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <RadioTower aria-hidden="true" className="h-4 w-4" />
              Fan-out pressure lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Route an ordinary post and a celebrity post</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Increase the audience, compare strategies, and inject consumer lag. Watch write amplification move between the post path and the read path.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={lagging}
            onClick={() => setLagging((value) => !value)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold transition-colors ${
              lagging
                ? 'border-rose-400 bg-rose-400/15 text-rose-200'
                : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-rose-400/60 hover:text-white'
            }`}
          >
            <Activity aria-hidden="true" className="h-4 w-4" />
            {lagging ? 'Consumer lag active' : 'Inject consumer lag'}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="border-b border-neutral-800 bg-neutral-900/45 p-5 lg:border-b-0 lg:border-r md:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Author audience</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{compact(followers)}</p>
              <p className="mt-1 text-sm text-neutral-400">followers</p>
            </div>
            <Users aria-hidden="true" className="h-9 w-9 text-blue-300" />
          </div>
          <input
            type="range"
            min="2"
            max="8"
            step="0.1"
            value={followerExponent}
            onChange={(event) => setFollowerExponent(Number(event.target.value))}
            className="mt-5 h-2 w-full cursor-pointer accent-blue-400"
          />
          <div className="mt-2 flex justify-between text-xs text-neutral-500">
            <span>100</span>
            <span>100M</span>
          </div>

          <fieldset className="mt-7">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Delivery strategy</legend>
            <div className="mt-3 space-y-2">
              {(Object.keys(strategyCopy) as Strategy[]).map((id) => {
                const item = strategyCopy[id];
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={strategy === id}
                    onClick={() => setStrategy(id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      strategy === id ? item.tone : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {recommended === id ? (
                        <span className="rounded bg-emerald-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Fit
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-70">{item.summary}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Writes per post', value: compact(model.pushWrites), icon: Zap, tone: 'text-blue-300' },
              { label: 'Read sources', value: model.readSources.toFixed(0), icon: Server, tone: 'text-violet-300' },
              { label: 'Estimated p95', value: `${model.readLatency}ms`, icon: Gauge, tone: healthy ? 'text-emerald-300' : 'text-rose-300' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4">
                <metric.icon aria-hidden="true" className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.tone}`} />
                <p className="mt-3 text-lg font-bold tabular-nums sm:text-xl">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[650px] items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 p-5">
              <div className="w-32 rounded-md border border-blue-400/40 bg-blue-400/10 p-3">
                <Sparkles aria-hidden="true" className="h-5 w-5 text-blue-300" />
                <p className="mt-3 text-sm font-semibold">Post event</p>
                <p className="mt-1 text-xs text-neutral-500">One durable write</p>
              </div>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-600" />
              <div className={`w-40 rounded-md border p-3 ${strategyInfo.tone}`}>
                <RadioTower aria-hidden="true" className="h-5 w-5" />
                <p className="mt-3 text-sm font-semibold">{strategyInfo.label}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div
                    className={`h-full rounded-full transition-all ${healthy ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.max(8, model.pressure)}%` }}
                  />
                </div>
              </div>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-600" />
              <div className="flex flex-1 gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-violet-400/40 bg-violet-400/10 p-3">
                  <Server aria-hidden="true" className="h-5 w-5 text-violet-300" />
                  <p className="mt-3 text-sm font-semibold">Timeline cache</p>
                  <p className="mt-1 text-xs text-neutral-500">Push candidates</p>
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
                  <RefreshCw aria-hidden="true" className="h-5 w-5 text-amber-300" />
                  <p className="mt-3 text-sm font-semibold">Read merge</p>
                  <p className="mt-1 text-xs text-neutral-500">Pull candidates</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_250px]">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold">Fan-out queue pressure</span>
                <span className={`text-sm font-bold tabular-nums ${healthy ? 'text-emerald-300' : 'text-rose-300'}`}>{model.pressure}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${healthy ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{ width: `${Math.max(3, model.pressure)}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                At the modeled worker rate, this post drains in about {model.queueSeconds.toFixed(1)} seconds.
              </p>
            </div>

            <div className={`rounded-lg border p-4 ${healthy ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-rose-400/40 bg-rose-400/10'}`}>
              {healthy ? <BellRing aria-hidden="true" className="h-5 w-5 text-emerald-300" /> : <CircleAlert aria-hidden="true" className="h-5 w-5 text-rose-300" />}
              <p className="mt-3 text-sm font-semibold">{healthy ? 'Latency target protected' : 'Capacity boundary crossed'}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-400">
                {healthy
                  ? 'The selected strategy keeps write pressure and feed-read latency within the target.'
                  : 'Move high-follower authors to hybrid delivery or scale consumers before the backlog grows.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
