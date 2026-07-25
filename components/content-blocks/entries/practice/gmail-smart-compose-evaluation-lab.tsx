'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  CircleAlert,
  FlaskConical,
  Gauge,
  Languages,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

type CandidateId = 'compact' | 'balanced' | 'expressive';
type SliceId = 'general' | 'enterprise' | 'multilingual' | 'sensitive';

type Candidate = {
  id: CandidateId;
  label: string;
  description: string;
  acceptance: number;
  relevance: number;
  unsafePpm: number;
  latency: number;
};

type Slice = {
  id: SliceId;
  label: string;
  description: string;
  acceptanceDelta: number;
  relevanceDelta: number;
  unsafeMultiplier: number;
  icon: LucideIcon;
};

const candidates: Candidate[] = [
  {
    id: 'compact',
    label: 'Candidate A',
    description: 'Conservative compact model',
    acceptance: 28,
    relevance: 77,
    unsafePpm: 5,
    latency: 78,
  },
  {
    id: 'balanced',
    label: 'Candidate B',
    description: 'Balanced quality and speed',
    acceptance: 34,
    relevance: 86,
    unsafePpm: 12,
    latency: 94,
  },
  {
    id: 'expressive',
    label: 'Candidate C',
    description: 'Longer, more expressive output',
    acceptance: 39,
    relevance: 92,
    unsafePpm: 25,
    latency: 128,
  },
];

const slices: Slice[] = [
  {
    id: 'general',
    label: 'General mail',
    description: 'Representative traffic',
    acceptanceDelta: 0,
    relevanceDelta: 0,
    unsafeMultiplier: 1,
    icon: Users,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    description: 'Formal and policy-bound',
    acceptanceDelta: -3,
    relevanceDelta: -2,
    unsafeMultiplier: 1.35,
    icon: LockKeyhole,
  },
  {
    id: 'multilingual',
    label: 'Multilingual',
    description: 'Lower-resource languages',
    acceptanceDelta: -6,
    relevanceDelta: -8,
    unsafeMultiplier: 1.55,
    icon: Languages,
  },
  {
    id: 'sensitive',
    label: 'Sensitive context',
    description: 'Health and financial language',
    acceptanceDelta: -5,
    relevanceDelta: -5,
    unsafeMultiplier: 2.2,
    icon: ShieldAlert,
  },
];

export default function GmailSmartComposeEvaluationLab() {
  const [candidateId, setCandidateId] = useState<CandidateId>('balanced');
  const [sliceId, setSliceId] = useState<SliceId>('general');
  const [threshold, setThreshold] = useState(72);
  const [redTeam, setRedTeam] = useState(false);

  const model = useMemo(() => {
    const candidate = candidates.find((item) => item.id === candidateId) ?? candidates[1];
    const slice = slices.find((item) => item.id === sliceId) ?? slices[0];
    const strictness = (threshold - 50) / 45;
    const challengeMultiplier = redTeam ? 2.25 : 1;
    const acceptance = Math.max(0, candidate.acceptance + slice.acceptanceDelta - strictness * 7 - (redTeam ? 2 : 0));
    const relevance = Math.max(0, candidate.relevance + slice.relevanceDelta - strictness * 2);
    const unsafePpm = Math.max(0.1, candidate.unsafePpm * slice.unsafeMultiplier * challengeMultiplier * (1 - strictness * 0.84));
    const displayRate = Math.max(15, 76 - strictness * 34);
    const gates = [
      { id: 'acceptance', label: 'Acceptance', value: `${acceptance.toFixed(1)}%`, target: '>= 26%', pass: acceptance >= 26 },
      { id: 'relevance', label: 'Rater relevance', value: `${Math.round(relevance)}/100`, target: '>= 78', pass: relevance >= 78 },
      { id: 'safety', label: 'Unsafe output', value: `${unsafePpm.toFixed(1)} ppm`, target: '<= 10 ppm', pass: unsafePpm <= 10 },
      { id: 'latency', label: 'Serving p95', value: `${candidate.latency} ms`, target: '<= 100 ms', pass: candidate.latency <= 100 },
    ];
    const failures = gates.filter((gate) => !gate.pass);
    const safetyFailed = gates.find((gate) => gate.id === 'safety')?.pass === false;
    const decision = failures.length === 0 ? 'Launch canary' : safetyFailed || failures.length >= 2 ? 'Hold release' : 'Shadow test';

    return { candidate, slice, acceptance, relevance, unsafePpm, displayRate, gates, failures, decision };
  }, [candidateId, redTeam, sliceId, threshold]);

  const reset = () => {
    setCandidateId('balanced');
    setSliceId('general');
    setThreshold(72);
    setRedTeam(false);
  };

  const decisionTone =
    model.decision === 'Launch canary'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.decision === 'Shadow test'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <FlaskConical aria-hidden="true" className="h-4 w-4" />
              Release gate simulator
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Decide whether a model is safe to expose</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Aggregate quality can hide a failing user slice. Choose a candidate, test a slice, and tighten the display threshold until every launch gate is explicit.
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

      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Select a candidate</legend>
            <div className="mt-3 grid gap-2">
              {candidates.map((candidate) => {
                const selected = candidate.id === candidateId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCandidateId(candidate.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{candidate.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{selected ? 'Selected' : `${candidate.latency} ms`}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{candidate.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Inspect an evaluation slice</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {slices.map((slice) => {
                const Icon = slice.icon;
                const selected = slice.id === sliceId;
                return (
                  <button
                    key={slice.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSliceId(slice.id)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="mt-2 block text-xs font-semibold">{slice.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">{slice.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Display confidence</span>
              <output className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{threshold}%</output>
            </span>
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>Show more</span><span>Suppress more</span></span>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={redTeam}
            onClick={() => setRedTeam((value) => !value)}
            className={`mt-6 flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors ${
              redTeam
                ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
            }`}
          >
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <ShieldAlert aria-hidden="true" className="h-4 w-4 text-rose-500" />
                Red-team challenge set
              </span>
              <span className="mt-1 block text-xs text-neutral-500">Inject ambiguous and adversarial prompts.</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${redTeam ? 'bg-rose-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
              <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${redTeam ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {model.gates.map((gate) => (
              <div key={gate.id} className={`min-w-0 rounded-md border p-3 ${gate.pass ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'}`}>
                <div className="flex items-center justify-between gap-2">
                  {gate.pass ? <Check aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <X aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />}
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${gate.pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{gate.pass ? 'Pass' : 'Fail'}</span>
                </div>
                <p className="mt-3 text-lg font-bold tabular-nums text-neutral-950 dark:text-white sm:text-xl">{gate.value}</p>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{gate.label}</p>
                <p className="mt-2 text-[10px] text-neutral-500">Gate {gate.target}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Threshold consequences</p>
                  <p className="mt-1 text-xs text-neutral-500">A stricter gate trades coverage for lower risk.</p>
                </div>
                <span className="rounded bg-neutral-200 px-2 py-1 text-xs font-bold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {model.displayRate.toFixed(0)}% display rate
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between gap-3 text-xs"><span className="font-semibold text-neutral-700 dark:text-neutral-300">Suggestions displayed</span><span className="tabular-nums text-neutral-500">{model.displayRate.toFixed(0)}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded bg-blue-500 transition-[width] duration-300" style={{ width: `${model.displayRate}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between gap-3 text-xs"><span className="font-semibold text-neutral-700 dark:text-neutral-300">Accepted when shown</span><span className="tabular-nums text-neutral-500">{model.acceptance.toFixed(1)}%</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded bg-violet-500 transition-[width] duration-300" style={{ width: `${model.acceptance}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between gap-3 text-xs"><span className="font-semibold text-neutral-700 dark:text-neutral-300">Safety headroom</span><span className="tabular-nums text-neutral-500">{Math.max(0, 10 - model.unsafePpm).toFixed(1)} ppm</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"><div className={`h-full rounded transition-[width] duration-300 ${model.unsafePpm <= 10 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.max(3, (model.unsafePpm / 10) * 100))}%` }} /></div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white dark:border-neutral-800">
              <Activity aria-hidden="true" className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Active slice</p>
              <p className="mt-1 font-semibold">{model.slice.label}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-400">{model.slice.description}</p>
              <div className="mt-5 border-t border-neutral-800 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Why slice it?</p>
                <p className="mt-2 text-xs leading-5 text-neutral-300">The aggregate can pass while language, domain, or policy-sensitive traffic fails.</p>
              </div>
            </div>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${decisionTone}`}>
            <div className="flex items-start gap-3">
              {model.decision === 'Launch canary' ? (
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${model.decision === 'Shadow test' ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`} />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Release decision</p>
                <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{model.decision}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {model.failures.length === 0
                    ? 'All modeled gates pass for this slice. Start with a small user-level canary and retain automated rollback thresholds.'
                    : `Failed gates: ${model.failures.map((gate) => gate.label.toLowerCase()).join(', ')}. ${model.decision === 'Hold release' ? 'Do not expose the candidate until safety and quality regressions are resolved.' : 'Collect production-shaped measurements without showing its output to users.'}`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6"><strong>Evaluation rule:</strong> launch requires a useful effect, acceptable latency, and every safety guardrail. Higher average acceptance never buys permission to violate a hard safety gate.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
