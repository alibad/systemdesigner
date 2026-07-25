'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Gauge,
  Laptop,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type TierId = 'fallback' | 'compact' | 'quality';
type NetworkId = 'near' | 'regional' | 'congested';

type Tier = {
  id: TierId;
  label: string;
  eyebrow: string;
  description: string;
  inferenceMs: number;
  quality: number;
  capacity: number;
  cost: number;
  icon: LucideIcon;
  selectedClass: string;
};

const tiers: Tier[] = [
  {
    id: 'fallback',
    label: 'Local fallback',
    eyebrow: 'Fastest',
    description: 'A tiny phrase model for common, low-risk continuations.',
    inferenceMs: 6,
    quality: 54,
    capacity: 9200,
    cost: 0.08,
    icon: Laptop,
    selectedClass:
      'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50',
  },
  {
    id: 'compact',
    label: 'Compact transformer',
    eyebrow: 'Balanced',
    description: 'A quantized model sized for the default interactive path.',
    inferenceMs: 28,
    quality: 79,
    capacity: 2400,
    cost: 1,
    icon: Zap,
    selectedClass:
      'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50',
  },
  {
    id: 'quality',
    label: 'Quality transformer',
    eyebrow: 'Most capable',
    description: 'A larger model for rich context when the latency budget permits.',
    inferenceMs: 64,
    quality: 92,
    capacity: 760,
    cost: 3.4,
    icon: Sparkles,
    selectedClass:
      'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50',
  },
];

const networks: Array<{ id: NetworkId; label: string; description: string; ms: number }> = [
  { id: 'near', label: 'Near edge', description: 'Healthy nearby region', ms: 14 },
  { id: 'regional', label: 'Regional', description: 'Typical round trip', ms: 28 },
  { id: 'congested', label: 'Congested', description: 'Mobile or cross-region', ms: 52 },
];

const budgetTarget = 100;

export default function GmailSmartComposeLatencyLab() {
  const [tierId, setTierId] = useState<TierId>('compact');
  const [networkId, setNetworkId] = useState<NetworkId>('regional');
  const [contextTokens, setContextTokens] = useState(768);
  const [strictSafety, setStrictSafety] = useState(true);

  const model = useMemo(() => {
    const tier = tiers.find((item) => item.id === tierId) ?? tiers[1];
    const network = networks.find((item) => item.id === networkId) ?? networks[1];
    const contextMs = 4 + contextTokens / 128;
    const inferenceMs = tier.inferenceMs + (contextTokens / 1024) * (tierId === 'fallback' ? 2 : tierId === 'compact' ? 6 : 12);
    const segments = [
      { id: 'network', label: 'Network', ms: network.ms, color: 'bg-cyan-500' },
      { id: 'context', label: 'Context', ms: contextMs, color: 'bg-amber-500' },
      { id: 'model', label: 'Inference', ms: inferenceMs, color: 'bg-violet-500' },
      { id: 'safety', label: 'Safety', ms: strictSafety ? 13 : 7, color: 'bg-rose-500' },
      { id: 'client', label: 'Render', ms: 7, color: 'bg-emerald-500' },
    ];
    const total = segments.reduce((sum, segment) => sum + segment.ms, 0);
    const quality = Math.max(0, Math.round(tier.quality - Math.max(0, 1024 - contextTokens) / 256 * 2));
    const withinBudget = total <= budgetTarget;
    const qualityReady = quality >= 72;

    return { tier, network, segments, total, quality, withinBudget, qualityReady };
  }, [contextTokens, networkId, strictSafety, tierId]);

  const decision = model.withinBudget
    ? model.qualityReady
      ? 'Serve the suggestion'
      : 'Use only as a fallback'
    : 'Return no suggestion';

  const reset = () => {
    setTierId('compact');
    setNetworkId('regional');
    setContextTokens(768);
    setStrictSafety(true);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Timer aria-hidden="true" className="h-4 w-4" />
              Latency budget lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Route a suggestion through a 100 ms budget</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Choose a model, network path, and context size. The system should suppress a late suggestion instead of interrupting the writer.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[370px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose the serving tier</legend>
            <div className="mt-3 space-y-2">
              {tiers.map((tier) => {
                const Icon = tier.icon;
                const selected = tier.id === tierId;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTierId(tier.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? tier.selectedClass
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded ${selected ? 'bg-white/70 dark:bg-black/20' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{tier.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{selected ? 'Selected' : tier.eyebrow}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{tier.description}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Place the writer</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {networks.map((network) => (
                <button
                  key={network.id}
                  type="button"
                  aria-pressed={network.id === networkId}
                  onClick={() => setNetworkId(network.id)}
                  className={`min-w-0 rounded-md border px-2 py-3 text-center transition-colors ${
                    network.id === networkId
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50'
                      : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                >
                  <span className="block text-xs font-semibold">{network.label}</span>
                  <span className="mt-1 block text-[10px] opacity-70">{network.ms} ms</span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Context window</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{contextTokens.toLocaleString()} tokens</output>
            </span>
            <input
              type="range"
              min="256"
              max="2048"
              step="256"
              value={contextTokens}
              onChange={(event) => setContextTokens(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>Draft only</span><span>Draft + thread</span></span>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={strictSafety}
            onClick={() => setStrictSafety((value) => !value)}
            className="mt-6 flex w-full items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 text-left dark:border-neutral-800 dark:bg-neutral-950"
          >
            <span>
              <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Strict output safety</span>
              <span className="mt-1 block text-xs text-neutral-500">Adds checks before display.</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${strictSafety ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
              <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${strictSafety ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Modeled p95', value: `${Math.round(model.total)} ms`, icon: Gauge, tone: model.withinBudget ? 'text-emerald-500' : 'text-rose-500' },
              { label: 'Quality index', value: `${model.quality}/100`, icon: Sparkles, tone: 'text-violet-500' },
              { label: 'Replica capacity', value: `${model.tier.capacity.toLocaleString()}/s`, icon: Activity, tone: 'text-blue-500' },
              { label: 'Relative cost', value: `${model.tier.cost.toFixed(1)}x`, icon: Cloud, tone: 'text-amber-500' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <metric.icon aria-hidden="true" className={`h-4 w-4 ${metric.tone}`} />
                <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">End-to-end latency allocation</p>
                <p className="mt-1 text-xs text-neutral-500">Every segment consumes the same user-visible budget.</p>
              </div>
              <span className={`rounded px-2.5 py-1 text-xs font-bold ${model.withinBudget ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
                {model.withinBudget ? `${Math.round(budgetTarget - model.total)} ms spare` : `${Math.round(model.total - budgetTarget)} ms over`}
              </span>
            </div>

            <div className="mt-5 flex h-5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-label={`Modeled latency ${Math.round(model.total)} milliseconds`}>
              {model.segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`${segment.color} min-w-[3px] transition-[width] duration-300`}
                  style={{ width: `${Math.min(100, (segment.ms / budgetTarget) * 100)}%` }}
                  title={`${segment.label}: ${Math.round(segment.ms)} ms`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
              {model.segments.map((segment) => (
                <div key={segment.id} className="min-w-0">
                  <span className="flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${segment.color}`} />
                    {segment.label}
                  </span>
                  <span className="mt-1 block pl-[18px] text-xs tabular-nums text-neutral-500">{Math.round(segment.ms)} ms</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${model.withinBudget && model.qualityReady ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`}>
            <div className="flex items-start gap-3">
              {model.withinBudget && model.qualityReady ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Routing decision</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {!model.withinBudget
                    ? `The ${model.tier.label.toLowerCase()} misses the typing budget on the ${model.network.label.toLowerCase()} path. Suppress it or route to a faster tier.`
                    : !model.qualityReady
                      ? 'Latency is safe, but this tier should handle only predictable phrases because its quality score is below the default gate.'
                      : 'The selected route satisfies both the latency and quality gates. Keep no-suggestion as the fallback when live queueing changes this estimate.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              <strong>Design invariant:</strong> a late or low-confidence completion is optional. Privacy and safety checks are not optional stages to remove when the budget gets tight.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
