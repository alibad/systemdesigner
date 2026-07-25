'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Image as ImageIcon,
  RefreshCw,
  Server,
  ShieldAlert,
  Workflow,
} from 'lucide-react';

type TierId = 'compact' | 'standard' | 'quality';

const tiers: Record<TierId, {
  label: string;
  summary: string;
  inferenceMs: number;
  requestsPerSecond: number;
  costWeight: number;
}> = {
  compact: {
    label: 'Compact',
    summary: 'Quantized model for common scenes and tight deadlines.',
    inferenceMs: 165,
    requestsPerSecond: 10,
    costWeight: 0.55,
  },
  standard: {
    label: 'Standard',
    summary: 'Default cloud tier with stronger object and relation coverage.',
    inferenceMs: 295,
    requestsPerSecond: 6,
    costWeight: 1,
  },
  quality: {
    label: 'Quality',
    summary: 'Larger batch-oriented model with richer decoding.',
    inferenceMs: 520,
    requestsPerSecond: 2.4,
    costWeight: 2.6,
  },
};

const tierIds = Object.keys(tiers) as TierId[];

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

export default function ImageCaptioningCapacityLab() {
  const [dailyMillions, setDailyMillions] = useState(100);
  const [interactiveShare, setInteractiveShare] = useState(30);
  const [tierId, setTierId] = useState<TierId>('standard');
  const [replicas, setReplicas] = useState(520);
  const [zoneFailure, setZoneFailure] = useState(false);

  const model = useMemo(() => {
    const tier = tiers[tierId];
    const averageQps = (dailyMillions * 1_000_000) / 86_400;
    const peakQps = averageQps * 4.3;
    const interactiveQps = peakQps * (interactiveShare / 100);
    const availableReplicas = Math.max(1, Math.floor(replicas * (zoneFailure ? 2 / 3 : 1)));
    const availableQps = availableReplicas * tier.requestsPerSecond;
    const utilization = interactiveQps / availableQps;
    const queuePenalty = utilization <= 0.65
      ? 18
      : Math.min(620, 18 + Math.pow((utilization - 0.65) * 5.2, 2) * 110);
    const p95 = Math.round(42 + tier.inferenceMs + queuePenalty);
    const requiredAvailable = Math.ceil(interactiveQps / (tier.requestsPerSecond * 0.7));
    const requiredProvisioned = Math.ceil(requiredAvailable / (zoneFailure ? 2 / 3 : 1));
    const capacityHealthy = replicas >= requiredProvisioned;
    const latencyHealthy = p95 <= 500;
    const ready = capacityHealthy && latencyHealthy;
    const relativeCost = replicas * tier.costWeight;

    return {
      averageQps,
      peakQps,
      interactiveQps,
      availableReplicas,
      availableQps,
      utilization,
      p95,
      requiredProvisioned,
      capacityHealthy,
      latencyHealthy,
      ready,
      relativeCost,
      tier,
    };
  }, [dailyMillions, interactiveShare, replicas, tierId, zoneFailure]);

  const reset = () => {
    setDailyMillions(100);
    setInteractiveShare(30);
    setTierId('standard');
    setReplicas(520);
    setZoneFailure(false);
  };

  const decision = model.ready
    ? 'Interactive target protected'
    : !model.latencyHealthy
      ? 'Route this tier to batch'
      : 'Add capacity or shed work';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-neutral-950/10">
      <header className="border-b border-neutral-800 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <Workflow aria-hidden="true" className="h-4 w-4" />
              Capacity routing lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Fit an interactive fleet inside 500 ms</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Change volume, routing, model tier, and provisioned replicas. The same daily workload can be healthy in batch and unsafe on an immediate response path.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-neutral-800 bg-neutral-900/55 p-5 lg:border-b-0 lg:border-r md:p-6">
          <label className="block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>Daily image volume</span>
              <output className="tabular-nums text-cyan-300">{dailyMillions}M</output>
            </span>
            <input
              aria-label="Daily image volume in millions"
              type="range"
              min="20"
              max="200"
              step="10"
              value={dailyMillions}
              onChange={(event) => setDailyMillions(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-cyan-400"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500"><span>20M</span><span>200M</span></span>
          </label>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>Interactive share</span>
              <output className="tabular-nums text-violet-300">{interactiveShare}%</output>
            </span>
            <input
              aria-label="Percentage of requests routed to the interactive path"
              type="range"
              min="10"
              max="90"
              step="5"
              value={interactiveShare}
              onChange={(event) => setInteractiveShare(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-400"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500"><span>10%</span><span>90%</span></span>
          </label>

          <fieldset className="mt-7">
            <legend className="text-sm font-semibold">Serving tier</legend>
            <div className="mt-3 space-y-2">
              {tierIds.map((id) => {
                const tier = tiers[id];
                const selected = tierId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTierId(id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${selected
                      ? 'border-cyan-400 bg-cyan-400/15 text-white ring-1 ring-cyan-400'
                      : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-600'}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{tier.label}</span>
                      <span className="text-xs tabular-nums text-neutral-400">{tier.inferenceMs} ms model</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-400">{tier.summary}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold">
              <span>Provisioned replicas</span>
              <output className="tabular-nums text-emerald-300">{replicas}</output>
            </span>
            <input
              aria-label="Provisioned serving replicas"
              type="range"
              min="100"
              max="1600"
              step="20"
              value={replicas}
              onChange={(event) => setReplicas(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-emerald-400"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500"><span>100</span><span>1,600</span></span>
          </label>

          <button
            type="button"
            aria-pressed={zoneFailure}
            onClick={() => setZoneFailure((value) => !value)}
            className={`mt-6 flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors ${zoneFailure
              ? 'border-rose-400 bg-rose-400/15 text-rose-100'
              : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-rose-400/60'}`}
          >
            <span>
              <span className="block text-sm font-semibold">One serving zone unavailable</span>
              <span className="mt-1 block text-xs text-neutral-400">Remove one third of live replicas.</span>
            </span>
            <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          </button>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              { label: 'Average traffic', value: `${compactNumber(model.averageQps)}/s`, Icon: ImageIcon, tone: 'text-blue-300' },
              { label: 'Peak interactive', value: `${compactNumber(model.interactiveQps)}/s`, Icon: Activity, tone: 'text-violet-300' },
              { label: 'Modeled p95', value: `${model.p95} ms`, Icon: Clock3, tone: model.latencyHealthy ? 'text-emerald-300' : 'text-rose-300' },
              { label: 'Needed replicas', value: model.requiredProvisioned.toLocaleString(), Icon: Server, tone: model.capacityHealthy ? 'text-cyan-300' : 'text-amber-300' },
            ].map(({ label, value, Icon, tone }) => (
              <div key={label} className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4">
                <Icon aria-hidden="true" className={`h-5 w-5 ${tone}`} />
                <p className="mt-3 text-lg font-bold tabular-nums sm:text-xl">{value}</p>
                <p className="mt-1 text-xs leading-4 text-neutral-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-neutral-800 bg-black/25 p-4 md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Interactive capacity envelope</p>
                <p className="mt-1 text-xs text-neutral-500">Target steady utilization is at most 70%.</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${model.utilization <= 0.7 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {(model.utilization * 100).toFixed(0)}% utilized
              </span>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded bg-neutral-800" aria-label={`Fleet utilization ${(model.utilization * 100).toFixed(0)} percent`}>
              <div
                className={`h-full rounded transition-[width] duration-300 ${model.utilization <= 0.7 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ width: `${Math.min(100, Math.max(2, model.utilization * 100))}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-neutral-400 sm:grid-cols-3">
              <span><strong className="text-neutral-200">{model.availableReplicas}</strong> replicas available</span>
              <span><strong className="text-neutral-200">{compactNumber(model.availableQps)}/s</strong> raw capacity</span>
              <span><strong className="text-neutral-200">{compactNumber(model.peakQps)}/s</strong> total peak traffic</span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[620px] items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              {[
                { label: 'Upload and decode', value: '42 ms', Icon: ImageIcon, tone: 'border-blue-400/40 bg-blue-400/10 text-blue-200' },
                { label: `${model.tier.label} inference`, value: `${model.tier.inferenceMs} ms`, Icon: Cpu, tone: 'border-violet-400/40 bg-violet-400/10 text-violet-200' },
                { label: 'Queue pressure', value: `${Math.max(18, model.p95 - 42 - model.tier.inferenceMs)} ms`, Icon: Gauge, tone: model.utilization <= 0.7 ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/40 bg-rose-400/10 text-rose-200' },
              ].map(({ label, value, Icon, tone }, index) => (
                <div key={label} className="contents">
                  {index > 0 ? <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-600" /> : null}
                  <div className={`min-w-0 flex-1 rounded-md border p-3 ${tone}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                    <p className="mt-3 text-sm font-semibold">{label}</p>
                    <p className="mt-1 text-xs tabular-nums text-neutral-400">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${model.ready
            ? 'border-emerald-400/50 bg-emerald-400/10'
            : 'border-rose-400/50 bg-rose-400/10'}`}
          >
            <div className="flex items-start gap-3">
              {model.ready
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />}
              <div>
                <p className="text-sm font-semibold text-neutral-300">Routing decision</p>
                <p className="mt-1 text-lg font-bold">{decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  {model.ready
                    ? `The selected fleet keeps p95 at ${model.p95} ms with zone-aware headroom. Relative fleet cost is ${model.relativeCost.toFixed(0)} units.`
                    : !model.latencyHealthy
                      ? `The ${model.tier.label.toLowerCase()} tier misses the deadline even before useful failure headroom. Keep it on the batch path or choose a faster tier.`
                      : `Provision at least ${model.requiredProvisioned.toLocaleString()} replicas for this route and failure assumption, or reduce the interactive share.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
