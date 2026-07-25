'use client';

import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  Headphones,
  LockKeyhole,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

type UseCaseId = 'support' | 'copilot' | 'briefing';
type LatencyId = 'instant' | 'interactive' | 'deliberate';
type FreshnessId = 'stable' | 'hourly' | 'live';

interface UseCase {
  label: string;
  description: string;
  icon: LucideIcon;
}

const USE_CASES: Record<UseCaseId, UseCase> = {
  support: {
    label: 'Support assistant',
    description: 'Answer from approved product and account knowledge.',
    icon: Headphones,
  },
  copilot: {
    label: 'Code copilot',
    description: 'Suggest code using repository-local context.',
    icon: Braces,
  },
  briefing: {
    label: 'News briefing',
    description: 'Synthesize recent reporting with source citations.',
    icon: Newspaper,
  },
};

const LATENCY_OPTIONS: Array<{ id: LatencyId; label: string; budget: string }> = [
  { id: 'instant', label: 'Instant', budget: '< 300 ms' },
  { id: 'interactive', label: 'Interactive', budget: '< 2 s' },
  { id: 'deliberate', label: 'Deliberate', budget: '< 8 s' },
];

const FRESHNESS_OPTIONS: Array<{ id: FreshnessId; label: string }> = [
  { id: 'stable', label: 'Weekly' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'live', label: 'Near real time' },
];

export default function GenaiInterviewFrameworkArchitectureLab() {
  const [useCaseId, setUseCaseId] = useState<UseCaseId>('support');
  const [latencyId, setLatencyId] = useState<LatencyId>('interactive');
  const [freshnessId, setFreshnessId] = useState<FreshnessId>('hourly');
  const [sensitiveData, setSensitiveData] = useState(true);
  const [takesActions, setTakesActions] = useState(false);

  const recommendation = getRecommendation({
    useCaseId,
    latencyId,
    freshnessId,
    sensitiveData,
    takesActions,
  });

  return (
    <section
      aria-labelledby="architecture-lab-title"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950"
    >
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white dark:border-neutral-700 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-md bg-cyan-400 text-neutral-950">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Architecture decision lab</p>
            <h3 id="architecture-lab-title" className="mt-1 text-xl font-semibold text-white sm:text-2xl">
              Make constraints choose the system
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              Change the product contract. Watch the grounding, model tier, serving boundary, and control path respond together.
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="min-w-0 space-y-6 border-b border-neutral-200 p-5 dark:border-neutral-700 sm:p-6 lg:border-b-0 lg:border-r">
          <fieldset className="min-w-0">
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">1. Choose the product task</legend>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {(Object.entries(USE_CASES) as Array<[UseCaseId, UseCase]>).map(([id, option]) => {
                const Icon = option.icon;
                const selected = useCaseId === id;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected
                      ? 'min-h-28 min-w-0 rounded-md border border-cyan-600 bg-cyan-50 p-3 text-left text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50 dark:ring-cyan-400'
                      : 'min-h-28 min-w-0 rounded-md border border-neutral-200 bg-white p-3 text-left text-neutral-800 transition-colors hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500'}
                    key={id}
                    onClick={() => setUseCaseId(id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <Icon aria-hidden="true" className="size-5" />
                      {selected && <Check aria-label="Selected" className="size-4" />}
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-80">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
              <Clock3 aria-hidden="true" className="size-4 text-violet-600 dark:text-violet-300" />
              2. Set the response budget
            </legend>
            <div className="mt-3 grid min-w-0 grid-cols-3 rounded-md border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-900">
              {LATENCY_OPTIONS.map((option) => {
                const selected = latencyId === option.id;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected
                      ? 'min-w-0 rounded bg-violet-700 px-2 py-2 text-sm font-semibold text-white shadow-sm dark:bg-violet-400 dark:text-violet-950'
                      : 'min-w-0 rounded px-2 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white'}
                    key={option.id}
                    onClick={() => setLatencyId(option.id)}
                    type="button"
                  >
                    <span className="block">{option.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal opacity-80">{option.budget}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
              <Database aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-300" />
              3. Set knowledge freshness
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FRESHNESS_OPTIONS.map((option) => {
                const selected = freshnessId === option.id;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected
                      ? 'rounded-md border border-amber-600 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100'
                      : 'rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-500'}
                    key={option.id}
                    onClick={() => setFreshnessId(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Toggle
              checked={sensitiveData}
              description="Prompts or retrieved records contain private data."
              icon={LockKeyhole}
              label="Sensitive data"
              onChange={setSensitiveData}
            />
            <Toggle
              checked={takesActions}
              description="The model may write, purchase, send, or delete."
              icon={Wrench}
              label="Takes real actions"
              onChange={setTakesActions}
            />
          </div>
        </div>

        <div className="min-w-0 bg-neutral-50 p-5 dark:bg-neutral-900 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Recommended design</p>
              <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{recommendation.pattern}</h4>
            </div>
            <span className={recommendation.pressure === 'High'
              ? 'rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200'
              : recommendation.pressure === 'Medium'
                ? 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                : 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}>
              {recommendation.pressure} constraint pressure
            </span>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <ol className="flex min-w-[660px] items-stretch gap-2" aria-label="Recommended request path">
              {recommendation.path.map((node, index) => {
                const Icon = node.icon;
                return (
                  <li className="flex min-w-0 flex-1 items-center gap-2" key={node.label}>
                    <div className="h-full min-w-0 flex-1 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                      <Icon aria-hidden="true" className="size-5 text-cyan-700 dark:text-cyan-300" />
                      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{node.label}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{node.detail}</p>
                    </div>
                    {index < recommendation.path.length - 1 && (
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Decision label="Grounding" value={recommendation.grounding} />
            <Decision label="Model strategy" value={recommendation.model} />
            <Decision label="Serving boundary" value={recommendation.boundary} />
            <Decision label="Primary control" value={recommendation.control} />
          </div>

          <div className="mt-5 border-l-4 border-cyan-500 bg-cyan-50 px-4 py-3 dark:border-cyan-300 dark:bg-cyan-950/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-950 dark:text-cyan-100">
              <Gauge aria-hidden="true" className="size-4" />
              Defend this trade-off
            </p>
            <p className="mt-1 text-sm leading-6 text-cyan-900 dark:text-cyan-100">{recommendation.tradeoff}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  description,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-neutral-600 dark:text-neutral-300" />
          <div>
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{description}</p>
          </div>
        </div>
        <button
          aria-checked={checked}
          aria-label={`${label}: ${checked ? 'on' : 'off'}`}
          className={checked
            ? 'relative h-6 w-11 shrink-0 rounded-full bg-cyan-600 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-cyan-600 dark:bg-cyan-400 dark:ring-offset-neutral-900'
            : 'relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:bg-neutral-600 dark:ring-offset-neutral-900'}
          onClick={() => onChange(!checked)}
          role="switch"
          type="button"
        >
          <span className={checked
            ? 'absolute left-0.5 top-0.5 size-5 translate-x-5 rounded-full bg-white shadow transition-transform'
            : 'absolute left-0.5 top-0.5 size-5 translate-x-0 rounded-full bg-white shadow transition-transform'} />
        </button>
      </div>
    </div>
  );
}

function Decision({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t-2 border-neutral-300 pt-3 dark:border-neutral-600">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function getRecommendation({
  useCaseId,
  latencyId,
  freshnessId,
  sensitiveData,
  takesActions,
}: {
  useCaseId: UseCaseId;
  latencyId: LatencyId;
  freshnessId: FreshnessId;
  sensitiveData: boolean;
  takesActions: boolean;
}) {
  const liveKnowledge = freshnessId === 'live';
  const strictLatency = latencyId === 'instant';
  const deliberate = latencyId === 'deliberate';
  const grounding = useCaseId === 'copilot'
    ? 'Repository retrieval with permission filtering'
    : liveKnowledge
      ? 'Live retrieval with source timestamps'
      : freshnessId === 'hourly'
        ? 'Indexed retrieval with freshness checks'
        : 'Versioned prompt context or compact retrieval';
  const model = strictLatency
    ? 'Small specialized model with an asynchronous fallback'
    : deliberate
      ? 'Quality-routed model with a bounded reasoning budget'
      : 'Fast default model with escalation for hard requests';
  const boundary = sensitiveData
    ? 'Regional gateway with redacted logs and scoped retrieval'
    : 'Managed multi-region gateway with request caching';
  const control = takesActions
    ? 'Typed tools, least privilege, and confirmation before side effects'
    : 'Input policy plus grounded-output and citation checks';
  const pressureScore = Number(strictLatency) + Number(liveKnowledge) + Number(sensitiveData) + Number(takesActions);
  const pressure = pressureScore >= 3 ? 'High' : pressureScore === 2 ? 'Medium' : 'Low';
  const pattern = takesActions
    ? deliberate
      ? 'Bounded agent with an approval gate'
      : 'Grounded assistant with constrained tools'
    : strictLatency
      ? 'Fast path with asynchronous enrichment'
      : 'Retrieval-routed generation';
  const tradeoff = strictLatency && liveKnowledge
    ? 'Fresh retrieval competes directly with the response budget. Precompute likely context, stream only after evidence arrives, and degrade to a clearly labeled cached answer rather than silently skipping grounding.'
    : takesActions
      ? 'Tool use raises the cost of a model mistake from bad text to a real side effect. Keep authorization and confirmation deterministic even if that adds latency.'
      : sensitiveData
        ? 'The privacy boundary narrows vendor and logging choices. State what is redacted, retained, region-locked, and excluded from training before discussing model quality.'
        : 'The flexible boundary favors managed services, but the interview answer should still name fallback behavior, evidence freshness, and the metric that justifies a larger model.';

  return {
    pattern,
    pressure,
    grounding,
    model,
    boundary,
    control,
    tradeoff,
    path: [
      { icon: FileSearch, label: useCaseId === 'copilot' ? 'IDE context' : 'User request', detail: USE_CASES[useCaseId].label },
      { icon: Database, label: 'Evidence layer', detail: grounding },
      { icon: Bot, label: 'Generation', detail: model },
      { icon: takesActions ? Wrench : ShieldCheck, label: takesActions ? 'Action gate' : 'Output gate', detail: control },
    ],
  };
}
