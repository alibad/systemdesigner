'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  Code2,
  Database,
  FileWarning,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';

type ScenarioId = 'secret' | 'cross-tenant' | 'injection' | 'unsafe-patch';
type ControlId = 'secret-scan' | 'tenant-scope' | 'trust-labels' | 'output-gate' | 'confirmation';

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  attackStage: number;
  required: ControlId[];
  escaped: string;
  contained: string;
  icon: LucideIcon;
};

const scenarios: Scenario[] = [
  { id: 'secret', label: 'Secret in active file', detail: 'An API key appears near the cursor.', attackStage: 0, required: ['secret-scan'], escaped: 'The credential enters the prompt and may reach logs or output.', contained: 'The sensitive span is removed before prompt construction.', icon: KeyRound },
  { id: 'cross-tenant', label: 'Cross-tenant cache hit', detail: 'A similar query exists in another customer cache.', attackStage: 1, required: ['tenant-scope'], escaped: 'Private symbols from another tenant enter the response.', contained: 'Identity-bound retrieval and cache keys reject the foreign context.', icon: Database },
  { id: 'injection', label: 'Prompt injection in README', detail: 'Retrieved text asks the model to ignore tool policy.', attackStage: 2, required: ['trust-labels', 'confirmation'], escaped: 'Untrusted repository text can steer a privileged tool request.', contained: 'Source labels preserve instruction priority and confirmation blocks the side effect.', icon: FileWarning },
  { id: 'unsafe-patch', label: 'Vulnerable generated patch', detail: 'The candidate builds a query with raw user input.', attackStage: 3, required: ['output-gate'], escaped: 'A plausible but vulnerable patch reaches the developer as normal output.', contained: 'The output gate flags the vulnerable pattern before display.', icon: Code2 },
];

const controls: Array<{ id: ControlId; label: string; detail: string; icon: LucideIcon }> = [
  { id: 'secret-scan', label: 'Input secret scan', detail: 'Mask sensitive spans before generation.', icon: ScanSearch },
  { id: 'tenant-scope', label: 'Tenant-scoped retrieval', detail: 'Bind indexes and caches to authenticated identity.', icon: LockKeyhole },
  { id: 'trust-labels', label: 'Source trust labels', detail: 'Keep policy separate from untrusted repository text.', icon: Braces },
  { id: 'output-gate', label: 'Patch validation', detail: 'Scan syntax, security, and policy before display.', icon: ShieldCheck },
  { id: 'confirmation', label: 'Side-effect confirmation', detail: 'Require explicit approval before any tool acts.', icon: UserCheck },
];

const path = [
  { label: 'IDE context', detail: 'Code and intent', icon: Code2 },
  { label: 'Context index', detail: 'Scoped retrieval', icon: Database },
  { label: 'Prompt boundary', detail: 'Trust separation', icon: Braces },
  { label: 'Output gate', detail: 'Candidate checks', icon: ShieldCheck },
  { label: 'Developer', detail: 'Reviews and approves', icon: UserCheck },
];

export default function AiCodeAssistantTrustBoundaryLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('injection');
  const [enabled, setEnabled] = useState<Record<ControlId, boolean>>({
    'secret-scan': true,
    'tenant-scope': true,
    'trust-labels': true,
    'output-gate': true,
    confirmation: true,
  });

  const result = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[2];
    const missing = scenario.required.filter((id) => !enabled[id]);
    const contained = missing.length === 0;
    return { scenario, missing, contained, message: contained ? scenario.contained : scenario.escaped };
  }, [enabled, scenarioId]);

  const toggle = (id: ControlId) => setEnabled((current) => ({ ...current, [id]: !current[id] }));
  const reset = () => {
    setScenarioId('injection');
    setEnabled({ 'secret-scan': true, 'tenant-scope': true, 'trust-labels': true, 'output-gate': true, confirmation: true });
  };

  return (
    <section aria-labelledby="trust-lab-title" className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-rose-300 text-neutral-950"><FileWarning aria-hidden="true" className="size-5" /></span>
            <div>
              <p className="text-xs font-semibold text-rose-300">Trust-boundary failure lab</p>
              <h3 id="trust-lab-title" className="mt-1 text-xl font-semibold text-white sm:text-2xl">Inject an attack and find the control that stops it</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">Repository content and model output are both untrusted. Disable safeguards, inject a scenario, and trace whether the failure is contained before it reaches the developer.</p>
            </div>
          </div>
          <button type="button" onClick={reset} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 hover:border-neutral-500 hover:text-white"><RefreshCw aria-hidden="true" className="size-4" /> Reset</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50 sm:p-6 lg:border-b-0 lg:border-r">
          <fieldset>
            <legend className="text-sm font-semibold">1. Inject a failure</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {scenarios.map((scenario) => {
                const Icon = scenario.icon;
                const selected = scenario.id === scenarioId;
                return <button key={scenario.id} type="button" aria-pressed={selected} onClick={() => setScenarioId(scenario.id)} className={selected
                  ? 'rounded-md border border-rose-600 bg-rose-50 p-3 text-left text-rose-950 ring-1 ring-rose-600 dark:border-rose-300 dark:bg-rose-950 dark:text-rose-50 dark:ring-rose-300'
                  : 'rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}>
                  <span className="flex items-start gap-3"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span><span className="block text-sm font-semibold">{scenario.label}</span><span className="mt-1 block text-xs leading-5 opacity-75">{scenario.detail}</span></span></span>
                </button>;
              })}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 sm:p-6">
          <fieldset>
            <legend className="text-sm font-semibold">2. Place safeguards</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {controls.map((control) => {
                const Icon = control.icon;
                const active = enabled[control.id];
                const required = result.scenario.required.includes(control.id);
                return <button key={control.id} type="button" role="switch" aria-checked={active} onClick={() => toggle(control.id)} className={active
                  ? 'min-w-0 rounded-md border border-emerald-600 bg-emerald-50 p-3 text-left text-emerald-950 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-50'
                  : 'min-w-0 rounded-md border border-neutral-300 bg-neutral-100 p-3 text-left text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'}>
                  <span className="flex items-center justify-between gap-2"><Icon aria-hidden="true" className="size-4" /><span className="flex items-center gap-1 text-[11px] font-semibold">{required ? 'Needed' : 'Defense'} {active ? <Check aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}</span></span>
                  <span className="mt-3 block text-sm font-semibold">{control.label}</span><span className="mt-1 block text-xs leading-5 opacity-75">{control.detail}</span>
                </button>;
              })}
            </div>
          </fieldset>

          <div className="mt-6 overflow-x-auto pb-2">
            <ol className="flex min-w-[720px] items-stretch gap-2" aria-label="Trust boundary request path">
              {path.map((stage, index) => {
                const Icon = stage.icon;
                const attacked = index === result.scenario.attackStage;
                const breached = !result.contained && index >= result.scenario.attackStage;
                const blocked = result.contained && attacked;
                const style = breached
                  ? 'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-50'
                  : blocked
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-50'
                    : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200';
                return <li key={stage.label} className="flex min-w-0 flex-1 items-center gap-2">
                  <div className={`min-h-32 min-w-0 flex-1 rounded-md border p-3 ${style}`}><Icon aria-hidden="true" className="size-5" /><p className="mt-3 text-sm font-semibold">{stage.label}</p><p className="mt-1 text-xs leading-5 opacity-70">{stage.detail}</p>{attacked && <p className="mt-2 text-[11px] font-semibold">{blocked ? 'Attack stopped here' : 'Boundary breached'}</p>}</div>
                  {index < path.length - 1 && <span aria-hidden="true" className={breached ? 'h-0.5 w-4 shrink-0 bg-rose-500' : 'h-0.5 w-4 shrink-0 bg-neutral-300 dark:bg-neutral-700'} />}
                </li>;
              })}
            </ol>
          </div>

          <div className={result.contained
            ? 'mt-4 border-l-4 border-emerald-500 bg-emerald-50 p-4 dark:border-emerald-300 dark:bg-emerald-950/60'
            : 'mt-4 border-l-4 border-rose-500 bg-rose-50 p-4 dark:border-rose-300 dark:bg-rose-950/60'}>
            <div className="flex items-start gap-3">
              {result.contained ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-emerald-700 dark:text-emerald-200" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-rose-700 dark:text-rose-200" />}
              <div><p className="text-xs font-semibold">{result.contained ? 'Failure contained' : 'Unsafe path remains'}</p><h4 className="mt-1 text-lg font-semibold">{result.scenario.label}</h4><p className="mt-2 text-sm leading-6 opacity-85">{result.message}</p>{result.missing.length > 0 && <p className="mt-2 text-sm font-semibold">Restore: {result.missing.map((id) => controls.find((item) => item.id === id)?.label).join(' and ')}</p>}</div>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"><Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-300" /><div><p className="text-sm font-semibold">Design lesson</p><p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">No single filter owns trust. Identity controls retrieval, input controls protect prompts, output checks inspect candidates, and confirmation protects side effects.</p></div></div>
          <p className="sr-only" aria-live="polite">{result.contained ? 'Failure contained.' : 'Unsafe path remains.'} {result.message}</p>
        </div>
      </div>
    </section>
  );
}
