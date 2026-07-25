'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Film,
  Focus,
  Layers3,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  Video,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';

type StrategyId = 'frames' | 'windows' | 'storyboard';
type ComplexityId = 'single' | 'camera' | 'ensemble';
type IncidentId = 'none' | 'worker' | 'identity' | 'policy';

type Strategy = {
  id: StrategyId;
  label: string;
  description: string;
  baseCoherence: number;
  cost: number;
  retryScope: string;
  icon: LucideIcon;
};

const strategies: Strategy[] = [
  {
    id: 'frames',
    label: 'Independent frames',
    description: 'Condition every frame on the prompt only.',
    baseCoherence: 49,
    cost: 0.72,
    retryScope: 'Individual frames, but continuity is not recoverable',
    icon: Film,
  },
  {
    id: 'windows',
    label: 'Overlapping windows',
    description: 'Share latent context at temporal boundaries.',
    baseCoherence: 79,
    cost: 1,
    retryScope: 'One window plus boundary overlap',
    icon: Layers3,
  },
  {
    id: 'storyboard',
    label: 'Storyboard and anchors',
    description: 'Plan shots and carry explicit entity state.',
    baseCoherence: 90,
    cost: 1.2,
    retryScope: 'One planned shot plus its transition',
    icon: WandSparkles,
  },
];

const complexities: Array<{
  id: ComplexityId;
  label: string;
  description: string;
  penalty: number;
  cost: number;
  icon: LucideIcon;
}> = [
  { id: 'single', label: 'Single subject', description: 'Locked camera', penalty: 0, cost: 1, icon: Focus },
  { id: 'camera', label: 'Moving camera', description: 'Occlusion and parallax', penalty: 8, cost: 1.16, icon: Video },
  { id: 'ensemble', label: 'Multiple characters', description: 'Identity and interaction', penalty: 15, cost: 1.32, icon: Users },
];

const incidents: Array<{ id: IncidentId; label: string; detail: string; icon: LucideIcon }> = [
  { id: 'none', label: 'Healthy run', detail: 'No injected failure', icon: CheckCircle2 },
  { id: 'worker', label: 'Worker loss', detail: 'Lease expires mid-window', icon: RotateCcw },
  { id: 'identity', label: 'Identity drift', detail: 'Subject changes after occlusion', icon: TriangleAlert },
  { id: 'policy', label: 'Unsafe transition', detail: 'Sequence policy fails', icon: ShieldAlert },
];

const timelineLabels = ['Plan', 'Anchor A', 'Motion', 'Anchor B', 'Transition', 'Release'];

export default function TextToVideoContinuityLab() {
  const [strategyId, setStrategyId] = useState<StrategyId>('windows');
  const [complexityId, setComplexityId] = useState<ComplexityId>('camera');
  const [anchorSeconds, setAnchorSeconds] = useState(4);
  const [incidentId, setIncidentId] = useState<IncidentId>('none');

  const model = useMemo(() => {
    const strategy = strategies.find((item) => item.id === strategyId) ?? strategies[1];
    const complexity = complexities.find((item) => item.id === complexityId) ?? complexities[1];
    const cadenceEffect =
      strategyId === 'frames'
        ? 0
        : Math.max(0, 4 - anchorSeconds) * 1.4 - Math.max(0, anchorSeconds - 4) * 2.1;
    const incidentPenalty = incidentId === 'identity' ? 20 : incidentId === 'worker' ? 4 : 0;
    const coherence = Math.max(18, Math.min(98, strategy.baseCoherence - complexity.penalty + cadenceEffect - incidentPenalty));
    const cadenceCost = strategyId === 'frames' ? 1 : 1 + Math.max(0, 6 - anchorSeconds) * 0.035;
    const relativeCost = strategy.cost * complexity.cost * cadenceCost;
    const affected = new Map<number, 'failed' | 'degraded' | 'blocked'>();

    if (incidentId === 'worker') affected.set(3, 'failed');
    if (incidentId === 'identity') {
      affected.set(3, 'degraded');
      affected.set(4, 'degraded');
    }
    if (incidentId === 'policy') affected.set(4, 'blocked');

    let decision = 'Ready for sequence validation';
    let explanation = 'The timeline preserves enough context to continue to full-sequence quality and safety checks.';

    if (incidentId === 'policy') {
      decision = 'Quarantine the clip';
      explanation = 'A sequence-level policy failure blocks publication. Keep the asset isolated and return an auditable failure state.';
    } else if (incidentId === 'worker') {
      decision = strategyId === 'frames' ? 'Restart with a coherent strategy' : 'Resume the bounded checkpoint';
      explanation = strategyId === 'frames'
        ? 'Independent frames provide no reliable temporal state to resume, so cheap retries do not repair the sequence.'
        : `Retry ${strategy.retryScope.toLowerCase()} while preserving the approved plan, seed, and earlier checkpoints.`;
    } else if (incidentId === 'identity' || coherence < 78) {
      decision = strategyId === 'storyboard' ? 'Regenerate the affected shot' : 'Strengthen anchors before release';
      explanation = strategyId === 'storyboard'
        ? 'Use the stable entity anchor and regenerate only the affected shot plus transition overlap.'
        : 'The selected temporal context does not contain drift. Increase continuity constraints before spending on final encoding.';
    }

    return { strategy, complexity, coherence, relativeCost, affected, decision, explanation };
  }, [anchorSeconds, complexityId, incidentId, strategyId]);

  const reset = () => {
    setStrategyId('windows');
    setComplexityId('camera');
    setAnchorSeconds(4);
    setIncidentId('none');
  };

  const decisionTone =
    model.decision === 'Ready for sequence validation'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.decision === 'Quarantine the clip'
        ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
        : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Continuity incident lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Contain a failure on the generated timeline</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Choose how the model shares state, set anchor cadence, and inject a failure. The release response should protect both continuity and policy.
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

      <div className="grid lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Choose a temporal strategy</legend>
            <div className="mt-3 grid gap-2">
              {strategies.map((strategy) => {
                const Icon = strategy.icon;
                const selected = strategy.id === strategyId;
                return (
                  <button
                    key={strategy.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStrategyId(strategy.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded ${selected ? 'bg-white/70 dark:bg-black/20' : 'bg-neutral-100 dark:bg-neutral-900'}`}>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{strategy.label}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{selected ? 'Selected' : `${strategy.cost.toFixed(2)}x`}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">{strategy.description}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Set scene complexity</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {complexities.map((complexity) => {
                const Icon = complexity.icon;
                const selected = complexity.id === complexityId;
                return (
                  <button
                    key={complexity.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setComplexityId(complexity.id)}
                    className={`min-w-0 rounded-md border p-2.5 text-left transition-colors ${
                      selected
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="mt-2 block break-words text-xs font-semibold leading-4">{complexity.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className={`mt-6 block ${strategyId === 'frames' ? 'opacity-50' : ''}`}>
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Anchor spacing</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">Every {anchorSeconds}s</output>
            </span>
            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={anchorSeconds}
              disabled={strategyId === 'frames'}
              onChange={(event) => setAnchorSeconds(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500 disabled:cursor-not-allowed"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>Tighter control</span><span>More freedom</span></span>
          </label>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">3. Inject an incident</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {incidents.map((incident) => {
                const Icon = incident.icon;
                const selected = incident.id === incidentId;
                const danger = incident.id === 'identity' || incident.id === 'policy';
                return (
                  <button
                    key={incident.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setIncidentId(incident.id)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? danger
                          ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-50'
                          : incident.id === 'none'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-50'
                            : 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-50'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="mt-2 block text-xs font-semibold">{incident.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">{incident.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-violet-500" />
              <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{Math.round(model.coherence)}/100</p>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">Modeled coherence</p>
            </div>
            <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <Activity aria-hidden="true" className="h-4 w-4 text-cyan-500" />
              <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{model.relativeCost.toFixed(2)}x</p>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">Relative generation cost</p>
            </div>
            <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
              <Layers3 aria-hidden="true" className="h-4 w-4 text-emerald-500" />
              <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{strategyId === 'frames' ? 'None' : `${anchorSeconds}s`}</p>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500 sm:text-xs">State refresh cadence</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Generated timeline</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">Status markers show where context, identity, or policy stops the release path.</p>
              </div>
              <span className="rounded bg-neutral-200 px-2.5 py-1 text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{model.strategy.label}</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {timelineLabels.map((label, index) => {
                const state = model.affected.get(index);
                const className =
                  state === 'blocked'
                    ? 'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-100'
                    : state === 'failed'
                      ? 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100'
                      : state === 'degraded'
                        ? 'border-orange-400 bg-orange-100 text-orange-950 dark:border-orange-700 dark:bg-orange-950/70 dark:text-orange-100'
                        : 'border-emerald-300 bg-white text-neutral-800 dark:border-emerald-900 dark:bg-neutral-950 dark:text-neutral-200';
                return (
                  <div key={label} className={`relative min-h-[82px] rounded-md border p-2.5 ${className}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{String(index + 1).padStart(2, '0')}</span>
                    <p className="mt-2 break-words text-xs font-semibold leading-4">{label}</p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider opacity-70">{state ?? 'stable'}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Continuity state carried</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {strategyId === 'frames' ? 'Prompt only' : strategyId === 'windows' ? 'Neighboring latent context' : 'Shot plan, entity anchors, and overlap'}
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Retry boundary</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">{model.strategy.retryScope}</p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${decisionTone}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {model.decision === 'Ready for sequence validation' ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : model.decision === 'Quarantine the clip' ? (
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Release response</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{model.decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6"><strong>Invariant:</strong> a cheap retry is useful only when it preserves approved identity and scene state. A policy failure is different: it quarantines the complete asset instead of finding a cheaper publication path.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
