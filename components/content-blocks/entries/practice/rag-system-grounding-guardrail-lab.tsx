'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  Fingerprint,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

type ScenarioId = 'healthy' | 'revoked' | 'conflict' | 'missing' | 'injection';

type Scenario = {
  id: ScenarioId;
  label: string;
  description: string;
  support: number;
  unauthorized: boolean;
  conflict: boolean;
  injection: boolean;
  icon: LucideIcon;
};

const scenarios: Scenario[] = [
  {
    id: 'healthy',
    label: 'Healthy evidence',
    description: 'Current, permitted sources agree.',
    support: 92,
    unauthorized: false,
    conflict: false,
    injection: false,
    icon: CheckCircle2,
  },
  {
    id: 'revoked',
    label: 'Revoked access',
    description: 'A strong result is no longer permitted.',
    support: 88,
    unauthorized: true,
    conflict: false,
    injection: false,
    icon: LockKeyhole,
  },
  {
    id: 'conflict',
    label: 'Conflicting policy',
    description: 'Two current sources disagree.',
    support: 63,
    unauthorized: false,
    conflict: true,
    injection: false,
    icon: FileWarning,
  },
  {
    id: 'missing',
    label: 'No useful source',
    description: 'Retrieval finds only weak matches.',
    support: 29,
    unauthorized: false,
    conflict: false,
    injection: false,
    icon: Ban,
  },
  {
    id: 'injection',
    label: 'Prompt injection',
    description: 'A document tells the model to ignore policy.',
    support: 84,
    unauthorized: false,
    conflict: false,
    injection: true,
    icon: TriangleAlert,
  },
];

export default function RagSystemGroundingGuardrailLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('healthy');
  const [preFilterAcl, setPreFilterAcl] = useState(true);
  const [isolateInstructions, setIsolateInstructions] = useState(true);
  const [claimGate, setClaimGate] = useState(true);
  const [minimumSupport, setMinimumSupport] = useState(72);

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const visibleSupport = scenario.unauthorized && preFilterAcl ? 22 : scenario.support;
    const privacyViolation = scenario.unauthorized && !preFilterAcl;
    const instructionHijack = scenario.injection && !isolateInstructions;
    const unsupported = visibleSupport < minimumSupport || scenario.conflict;
    const detectedByGate = claimGate && (privacyViolation || instructionHijack || unsupported);
    const shouldAnswer = !detectedByGate;
    const unsafeAnswer = shouldAnswer && (privacyViolation || instructionHijack || unsupported);

    let verdict = 'Answer with citations';
    let explanation = 'Authorized evidence clears the support threshold, so the model can answer and cite the source set.';
    if (!shouldAnswer) {
      verdict = privacyViolation
        ? 'Blocked too late: private evidence crossed the boundary'
        : instructionHijack
          ? 'Blocked too late: source text became instruction'
          : scenario.unauthorized && preFilterAcl
            ? 'Abstain: no authorized evidence'
            : 'Abstain and explain the evidence gap';
      explanation = privacyViolation
        ? 'The claim gate prevented output, but post-retrieval blocking cannot undo private evidence entering the model context.'
        : instructionHijack
          ? 'The output gate caught the answer, but the prompt boundary already failed. Retrieved commands must remain quoted data.'
          : scenario.unauthorized && preFilterAcl
        ? 'Filtering before ranking removes the revoked document. A weaker authorized result must not be disguised as confidence.'
        : scenario.injection && isolateInstructions
          ? 'The retrieved instruction is treated as untrusted data, and the claim gate blocks the resulting unsupported answer.'
          : scenario.conflict
            ? 'Current sources conflict. Ask for clarification or route to an owner instead of selecting one silently.'
            : 'The evidence does not meet the release threshold, so the healthy response is an explicit abstention.';
    } else if (unsafeAnswer) {
      verdict = privacyViolation ? 'Unsafe: access boundary crossed' : instructionHijack ? 'Unsafe: document controls the model' : 'Unsafe: unsupported answer released';
      explanation = privacyViolation
        ? 'Post-retrieval filtering is too late: the model has already received evidence the caller cannot access.'
        : instructionHijack
          ? 'Retrieved text entered the instruction channel and overrode system behavior.'
          : 'Without a claim-support gate, model fluency is being mistaken for evidence.';
    }

    const controls = [
      { label: 'Authorization', pass: !privacyViolation, detail: preFilterAcl ? 'Before ranking' : 'After retrieval' },
      { label: 'Instruction boundary', pass: !instructionHijack, detail: isolateInstructions ? 'Sources are data' : 'Sources can instruct' },
      { label: 'Claim support', pass: !unsupported, detail: `${visibleSupport}% vs ${minimumSupport}% gate` },
    ];

    return { scenario, visibleSupport, privacyViolation, instructionHijack, unsupported, shouldAnswer, unsafeAnswer, verdict, explanation, controls };
  }, [claimGate, isolateInstructions, minimumSupport, preFilterAcl, scenarioId]);

  const safe = !model.privacyViolation && !model.instructionHijack && !model.unsafeAnswer;

  const reset = () => {
    setScenarioId('healthy');
    setPreFilterAcl(true);
    setIsolateInstructions(true);
    setClaimGate(true);
    setMinimumSupport(72);
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Fingerprint aria-hidden="true" className="h-4 w-4" />
              Grounding guardrail lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Decide when the system must abstain</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Inject an evidence failure, move the security boundaries, and observe whether the system answers, abstains, or leaks.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 border-b border-neutral-200 p-5 md:p-6 lg:border-b-0 lg:border-r dark:border-neutral-800">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Inject an evidence condition</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                const selected = scenario.id === scenarioId;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScenarioId(scenario.id)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="mt-3 block text-sm font-semibold">{scenario.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{scenario.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <GuardrailSwitch
              title="Pre-filter authorization"
              description="Apply tenant and document ACLs before candidates reach ranking or generation."
              checked={preFilterAcl}
              onChange={() => setPreFilterAcl((value) => !value)}
            />
            <GuardrailSwitch
              title="Isolate source instructions"
              description="Treat retrieved commands as quoted data, never as system or developer instructions."
              checked={isolateInstructions}
              onChange={() => setIsolateInstructions((value) => !value)}
            />
            <GuardrailSwitch
              title="Require claim support"
              description="Block release when evidence is weak, conflicting, private, or instruction-shaped."
              checked={claimGate}
              onChange={() => setClaimGate((value) => !value)}
            />
          </div>

          <label className="mt-6 block rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Minimum evidence support</span>
                <span className="mt-1 block text-xs text-neutral-500">Raise the gate for high-consequence answers.</span>
              </span>
              <output className="text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{minimumSupport}%</output>
            </span>
            <input
              type="range"
              min="50"
              max="90"
              step="2"
              value={minimumSupport}
              onChange={(event) => setMinimumSupport(Number(event.target.value))}
              className="mt-4 h-2 w-full cursor-pointer accent-violet-600"
            />
            <span className="mt-2 flex justify-between text-[10px] text-neutral-500"><span>More coverage</span><span>More evidence required</span></span>
          </label>

          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence release path</p>
                <p className="mt-1 text-xs text-neutral-500">Each gate must protect a different boundary.</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-neutral-950 dark:text-white">{model.visibleSupport}% visible support</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {model.controls.map((control, index) => (
                <div key={control.label} className="relative rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                  <span className={`flex h-8 w-8 items-center justify-center rounded ${control.pass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>
                    {control.pass ? <ShieldCheck aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{index + 1}. {control.label}</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">{control.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="bg-neutral-50 p-5 md:p-6 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Observed outcome</p>
          <div className={`mt-4 rounded-lg border p-5 ${safe ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`}>
            {safe ? <ShieldCheck aria-hidden="true" className="h-6 w-6 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="h-6 w-6 text-rose-600 dark:text-rose-300" />}
            <p className="mt-4 text-xl font-bold text-neutral-950 dark:text-white">{model.verdict}</p>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.explanation}</p>
          </div>

          <dl className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            <OutcomeRow label="Source access" value={model.privacyViolation ? 'Violated' : 'Protected'} danger={model.privacyViolation} />
            <OutcomeRow label="Prompt boundary" value={model.instructionHijack ? 'Overridden' : 'Protected'} danger={model.instructionHijack} />
            <OutcomeRow label="Release action" value={model.shouldAnswer ? 'Answer' : 'Abstain'} danger={model.unsafeAnswer} />
          </dl>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">
              A citation is not a security control. Authorization must happen before retrieval results enter the model context.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function GuardrailSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex min-h-32 flex-col justify-between rounded-md border p-4 text-left transition-colors ${checked ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'}`}
    >
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{description}</span>
      </span>
      <span className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider">{checked ? 'Enforced' : 'Disabled'}</span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </span>
    </button>
  );
}

function OutcomeRow({ label, value, danger }: { label: string; value: string; danger: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`text-right font-semibold ${danger ? 'text-rose-600 dark:text-rose-300' : 'text-neutral-950 dark:text-white'}`}>{value}</dd>
    </div>
  );
}
