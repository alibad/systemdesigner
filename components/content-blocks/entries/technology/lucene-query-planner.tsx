'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  CircleAlert,
  Filter,
  GitBranch,
  ListTree,
  Search,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Requirement = 'analysis' | 'exact' | 'positions' | 'numeric' | 'prefix' | 'humanSyntax' | 'filter';

type QueryIntent = {
  id: string;
  label: string;
  detail: string;
  input: string;
  fieldContract: string;
  requirements: Requirement[];
  recommendedPlanId: string;
};

type QueryPlan = {
  id: string;
  label: string;
  detail: string;
  api: string;
  supports: Requirement[];
  rewrite: string;
  guardrail: string;
  trace: string[];
};

type QueryDecisionModel = {
  title: string;
  description: string;
  defaults: {
    intentId: string;
    planId: string;
  };
  requirementLabels: Record<Requirement, string>;
  intents: QueryIntent[];
  plans: QueryPlan[];
};

const BLOCK_ID = 'technology/lucene-query-planner';
const DEFAULT_DATA_FILE = '/api/content/technology/lucene/data/query-decision-model.json';

function isQueryDecisionModel(value: unknown): value is QueryDecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryDecisionModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.intentId
      && candidate.defaults.planId
      && candidate.requirementLabels
      && Array.isArray(candidate.intents)
      && candidate.intents.length >= 3
      && candidate.intents.every((intent) => (
        typeof intent.id === 'string'
        && Array.isArray(intent.requirements)
        && intent.requirements.length > 0
      ))
      && Array.isArray(candidate.plans)
      && candidate.plans.length >= 3
      && candidate.plans.every((plan) => (
        typeof plan.id === 'string'
        && typeof plan.api === 'string'
        && Array.isArray(plan.supports)
        && Array.isArray(plan.trace)
        && plan.trace.length >= 3
      )),
  );
}

export default function LuceneQueryPlanner({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<QueryDecisionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        if (!isQueryDecisionModel(payload)) throw new Error('The Lucene query-decision model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the query-decision model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <QueryWorkbench data={data} />;
}

function QueryWorkbench({ data }: { data: QueryDecisionModel }) {
  const [intentId, setIntentId] = useState(data.defaults.intentId);
  const [planId, setPlanId] = useState(data.defaults.planId);
  const intent = data.intents.find((item) => item.id === intentId) ?? data.intents[0];
  const plan = data.plans.find((item) => item.id === planId) ?? data.plans[0];

  const result = useMemo(() => {
    const supported = intent.requirements.filter((item) => plan.supports.includes(item));
    const missing = intent.requirements.filter((item) => !plan.supports.includes(item));
    const recommended = intent.recommendedPlanId === plan.id;

    if (missing.length > 0) {
      return {
        detail: `${missing.map((item) => data.requirementLabels[item]).join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing from this plan. Choose an API whose semantics match the field and input.`,
        missing,
        recommended,
        supported,
        tone: 'rose' as const,
        verdict: 'The query plan changes the requested meaning',
      };
    }

    if (!recommended) {
      const preferred = data.plans.find((item) => item.id === intent.recommendedPlanId)?.label;
      return {
        detail: `This plan can represent the intent, but ${preferred ?? 'the recommended API'} sets a clearer boundary and avoids unnecessary parsing or expansion.`,
        missing,
        recommended,
        supported,
        tone: 'amber' as const,
        verdict: 'The plan works, but its contract is wider than needed',
      };
    }

    return {
      detail: 'The input boundary, field representation, and query semantics agree. Keep the stated guardrail in the production request path.',
      missing,
      recommended,
      supported,
      tone: 'emerald' as const,
      verdict: 'The query plan preserves the product intent',
    };
  }, [data.plans, data.requirementLabels, intent, plan]);

  const reset = () => {
    setIntentId(data.defaults.intentId);
    setPlanId(data.defaults.planId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Query contract lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Request intent
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.intents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === intent.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Search}
                      accent="cyan"
                      onClick={() => setIntentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Candidate query plan
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.plans.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === plan.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.supports.includes('filter') ? Filter : Braces}
                      accent="violet"
                      onClick={() => setPlanId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Intent coverage"
                value={`${result.supported.length} / ${intent.requirements.length}`}
                detail="Required query semantics preserved"
                icon={CheckCircle2}
                tone={result.missing.length ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Field contract"
                value={intent.fieldContract}
                detail="The index representation this request expects"
                icon={ListTree}
                tone="blue"
              />
              <LabMetric
                label="Plan choice"
                value={result.missing.length ? 'Reject' : result.recommended ? 'Use' : 'Review'}
                detail="Semantic decision, not a latency estimate"
                icon={GitBranch}
                tone={result.missing.length ? 'rose' : result.recommended ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Boundary"
                value={plan.supports.includes('humanSyntax') ? 'Human text' : 'Application data'}
                detail="Who owns query construction"
                icon={ShieldCheck}
                tone="violet"
              />
            </div>

            <section className={`rounded-md border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                : result.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request trace</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">From input to executable query</h4>
                </div>
                <code className="max-w-full overflow-x-auto rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {intent.input}
                </code>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-[repeat(7,minmax(0,1fr))] md:items-stretch">
                {plan.trace.map((step, index) => (
                  <div key={step} className="contents">
                    <div className="flex min-h-24 min-w-0 flex-col rounded-md border border-cyan-200 bg-cyan-50 p-3 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
                      <span className="text-xs font-semibold uppercase opacity-65">Step {index + 1}</span>
                      <span className="mt-2 break-words text-sm font-semibold leading-5">{step}</span>
                    </div>
                    {index < plan.trace.length - 1 ? <FlowArrow /> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Lucene API</p>
                <code className="mt-3 block overflow-x-auto rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {plan.api}
                </code>
                <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Rewrite or execution shape</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{plan.rewrite}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="text-xs font-semibold uppercase opacity-65">Production guardrail</p>
                <p className="mt-2 text-sm font-semibold leading-6">{plan.guardrail}</p>
                <ul className="mt-4 space-y-2">
                  {intent.requirements.map((requirement) => (
                    <li key={requirement} className="flex items-center gap-2 text-sm">
                      {plan.supports.includes(requirement) ? (
                        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                      ) : (
                        <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
                      )}
                      <span>{data.requirementLabels[requirement]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <div data-content-block={BLOCK_ID} className="my-7 min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
        <p className="font-semibold">The query-contract lab could not be loaded.</p>
        <p className="mt-2 leading-6 opacity-80">{error}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
          Retry
        </button>
      </div>
    );
  }
  return (
    <div data-content-block={BLOCK_ID} className="my-7 min-h-[620px] animate-pulse rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading Lucene query-contract lab" />
  );
}
