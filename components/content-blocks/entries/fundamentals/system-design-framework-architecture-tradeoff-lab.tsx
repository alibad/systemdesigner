'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  Route,
  Rows3,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type DecisionId = 'commit-first' | 'async-first' | 'transactional-store' | 'event-log' | 'cache' | 'outbox-queue' | 'strong-write' | 'eventual-read' | 'pending-after-commit' | 'labeled-stale';
type Scenario = {
  id: string;
  label: string;
  requirement: string;
  invariant: string;
  preferred: {
    path: DecisionId;
    source: DecisionId;
    boundary: DecisionId;
    consistency: DecisionId;
    failure: DecisionId;
  };
  components: Record<string, string>;
};
type TradeoffData = { scenarios: Scenario[] };

const BLOCK_ID = 'fundamentals/system-design-framework-architecture-tradeoff-lab';
const DEFAULT_DATA_FILE = '/api/content/fundamentals/system-design-framework/data/architecture-tradeoff-scenarios.json';

const options = {
  path: [
    { id: 'commit-first' as const, label: 'Commit before side effects', detail: 'Return only after the authoritative state is durable.' },
    { id: 'async-first' as const, label: 'Accept work asynchronously', detail: 'A worker produces the customer view after a durable event.' },
  ],
  source: [
    { id: 'transactional-store' as const, label: 'Transactional store', detail: 'A constraint or transaction protects a write invariant.' },
    { id: 'event-log' as const, label: 'Durable event log', detail: 'An ordered delivery-keyed stream drives a materialized view.' },
  ],
  boundary: [
    { id: 'cache' as const, label: 'Read-through cache', detail: 'Relieve repeat reads; explain staleness and invalidation.' },
    { id: 'outbox-queue' as const, label: 'Outbox and queue', detail: 'Retry slow side effects after the source-of-truth write.' },
  ],
  consistency: [
    { id: 'strong-write' as const, label: 'Read committed state', detail: 'The response confirms the invariant-protected write.' },
    { id: 'eventual-read' as const, label: 'Converging customer view', detail: 'A derived view may lag but exposes its update time.' },
  ],
  failure: [
    { id: 'pending-after-commit' as const, label: 'Pending after commit', detail: 'Keep the durable result and retry a delayed side effect.' },
    { id: 'labeled-stale' as const, label: 'Serve labeled stale data', detail: 'Show the last known view with a freshness marker.' },
  ],
};

export default function SystemDesignFrameworkArchitectureTradeoffLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TradeoffData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [path, setPath] = useState<DecisionId>('commit-first');
  const [source, setSource] = useState<DecisionId>('transactional-store');
  const [boundary, setBoundary] = useState<DecisionId>('outbox-queue');
  const [consistency, setConsistency] = useState<DecisionId>('strong-write');
  const [failure, setFailure] = useState<DecisionId>('pending-after-commit');
  const [pressure, setPressure] = useState<'time' | 'incident'>('time');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as TradeoffData;
        if (!Array.isArray(payload.scenarios) || payload.scenarios.length === 0) {
          throw new Error('The architecture lab has no decision scenarios.');
        }
        if (active) {
          setData(payload);
          applyScenario(payload.scenarios[0]);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load architecture data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const outcome = useMemo(() => {
    if (!scenario) return null;

    const choices = { path, source, boundary, consistency, failure };
    const matched = Object.entries(choices).filter(([key, value]) => scenario.preferred[key as keyof Scenario['preferred']] === value);
    const unexplained = [
      path !== scenario.preferred.path ? 'The request path does not match the user-visible completion point.' : null,
      source !== scenario.preferred.source ? 'The selected source of truth cannot directly defend the stated invariant or freshness contract.' : null,
      boundary !== scenario.preferred.boundary ? boundary === 'cache' ? 'The cache does not solve the critical write or delivery boundary.' : 'The queue has no named asynchronous side effect in this design.' : null,
      consistency !== scenario.preferred.consistency ? 'The chosen consistency contract conflicts with what the user is promised.' : null,
      failure !== scenario.preferred.failure ? 'The failure response hides or rejects a result that the contract should preserve.' : null,
    ].filter((item): item is string => Boolean(item));
    const incidentDebt = pressure === 'incident' && failure !== scenario.preferred.failure ? 2 : 0;
    const coverage = matched.length;
    const debt = unexplained.length * 2 + incidentDebt;
    const criticalPath = scenario.components[path] ?? 'Describe the path from client to durable state.';
    const nextDiscussion = coverage < 3
      ? 'Clarify the invariant and user-visible completion point before adding more components.'
      : pressure === 'incident'
        ? `Explain the user response when the selected boundary fails, then name the metric that detects it.`
        : `Defend why ${options.boundary.find((option) => option.id === boundary)?.label.toLowerCase()} earns its operational cost.`;

    return { coverage, criticalPath, debt, nextDiscussion, unexplained };
  }, [boundary, consistency, failure, path, pressure, scenario, source]);

  function applyScenario(nextScenario: Scenario) {
    setScenarioId(nextScenario.id);
    setPath(nextScenario.preferred.path);
    setSource(nextScenario.preferred.source);
    setBoundary(nextScenario.preferred.boundary);
    setConsistency(nextScenario.preferred.consistency);
    setFailure(nextScenario.preferred.failure);
    setPressure('time');
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Architecture and trade-off lab"
          title="Defend the path when the interviewer changes the constraint"
          description="Choose the source of truth, relief boundary, consistency contract, and failure response. The review separates coverage from accumulated design debt."
          icon={Route}
          accent="violet"
          onReset={data ? () => applyScenario(data.scenarios[0]) : undefined}
        />

        {!data || !scenario || !outcome ? (
          <LoadState error={error} onRetry={() => setReloadKey((current) => current + 1)} />
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Interview prompt</legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((option) => <LabChoice key={option.id} selected={scenario.id === option.id} label={option.label} detail={option.requirement} icon={Rows3} accent="violet" onClick={() => applyScenario(option)} />)}
                  </div>
                </fieldset>
                <ChoiceGroup label="2. Request path" items={options.path} selected={path} onChange={setPath} />
                <ChoiceGroup label="3. Source of truth" items={options.source} selected={source} onChange={setSource} />
                <ChoiceGroup label="4. Cache or queue boundary" items={options.boundary} selected={boundary} onChange={setBoundary} />
                <ChoiceGroup label="5. Read consistency" items={options.consistency} selected={consistency} onChange={setConsistency} />
                <ChoiceGroup label="6. Failure response" items={options.failure} selected={failure} onChange={setFailure} />
                <ChoiceGroup label="7. Interview pressure" items={[{ id: 'time' as const, label: 'Six minutes remain', detail: 'Prioritize the invariant and the critical path.' }, { id: 'incident' as const, label: 'Dependency incident', detail: 'Prioritize the user-visible degraded response.' }]} selected={pressure} onChange={setPressure} />
              </div>
            }
          >
            <div className="rounded-md border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
              <p className="text-xs font-semibold uppercase text-violet-800 dark:text-violet-200">Invariant to defend</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-violet-950 dark:text-violet-50">{scenario.invariant}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Requirement coverage" value={`${outcome.coverage}/5`} detail={outcome.coverage === 5 ? 'Every choice traces to the prompt' : 'At least one choice conflicts with the prompt'} icon={ShieldCheck} tone={outcome.coverage === 5 ? 'emerald' : 'amber'} />
              <LabMetric label="Unexplained components" value={`${outcome.unexplained.length}`} detail={outcome.unexplained.length === 0 ? 'No extra component debt' : 'A component or boundary lacks a reason'} icon={CircleAlert} tone={outcome.unexplained.length === 0 ? 'emerald' : 'rose'} />
              <LabMetric label="Trade-off debt" value={`${outcome.debt}`} detail={outcome.debt === 0 ? 'Decision is coherent for this prompt' : 'Explain or remove the mismatch'} icon={Gauge} tone={outcome.debt === 0 ? 'emerald' : 'amber'} />
              <LabMetric label="Pressure mode" value={pressure === 'time' ? '6 min' : 'Incident'} detail={pressure === 'time' ? 'Lead with the critical path' : 'Lead with user impact'} icon={Clock3} tone="blue" />
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Critical path</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">{outcome.criticalPath}</p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className={`rounded-md border p-4 ${outcome.unexplained.length === 0 ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'}`}>
                <p className="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-200">Design review</p>
                {outcome.unexplained.length === 0 ? <p className="mt-2 text-sm leading-6 text-neutral-800 dark:text-neutral-100">Each selected boundary protects a requirement in this prompt. Now name its measurement and failure behavior.</p> : <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-neutral-800 marker:text-neutral-500 dark:text-neutral-100 dark:marker:text-neutral-300">{outcome.unexplained.map((item) => <li key={item}>{item}</li>)}</ul>}
              </div>
              <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/40">
                <p className="text-xs font-semibold uppercase text-cyan-800 dark:text-cyan-200">Prioritized next discussion</p>
                <p className="mt-2 text-sm leading-6 text-cyan-950 dark:text-cyan-50">{outcome.nextDiscussion}</p>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends string>({ label, items, selected, onChange }: { label: string; items: Array<{ id: T; label: string; detail: string }>; selected: T; onChange: (value: T) => void }) {
  return <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend><div className="mt-3 space-y-2">{items.map((item) => <LabChoice key={item.id} selected={selected === item.id} label={item.label} detail={item.detail} icon={Database} accent="violet" onClick={() => onChange(item.id)} />)}</div></fieldset>;
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (error) {
    return <div className="min-h-[580px] p-6"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><TriangleAlert aria-hidden="true" className="h-5 w-5" /><p className="mt-3 font-semibold">Architecture data could not be loaded</p><p className="mt-1 leading-6">{error}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-rose-400 px-3 font-semibold hover:border-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</button></div></div>;
  }

  return <div className="flex min-h-[580px] items-center justify-center p-6" role="status"><div className="text-center text-sm text-neutral-600 dark:text-neutral-300"><CheckCircle2 aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" /><p className="mt-3">Loading architecture decisions...</p></div></div>;
}
