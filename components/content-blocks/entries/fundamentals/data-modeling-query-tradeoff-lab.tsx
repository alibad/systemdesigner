'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Database,
  History,
  Search,
  TableProperties,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type QueryId = 'checkout' | 'history' | 'reporting';
type StoragePlan = 'normalized' | 'projection';

const queries: Record<QueryId, { label: string; detail: string; index: string; normalRows: number; projectionRows: number }> = {
  checkout: {
    label: 'Complete checkout',
    detail: 'Write an order, reserve its item facts, and preserve the transaction.',
    index: 'Primary and foreign keys',
    normalRows: 4,
    projectionRows: 2,
  },
  history: {
    label: 'Show recent orders',
    detail: 'Return one customer\'s latest 20 orders from a 10 million-order table.',
    index: '(customer_id, created_at DESC)',
    normalRows: 60,
    projectionRows: 20,
  },
  reporting: {
    label: 'Read daily revenue',
    detail: 'Serve a dashboard aggregate across millions of completed order items.',
    index: 'Daily aggregate refresh key',
    normalRows: 2_000_000,
    projectionRows: 30,
  },
};

const plans: Array<{ id: StoragePlan; label: string; detail: string }> = [
  { id: 'normalized', label: 'Normalized source', detail: 'Each business fact has one authoritative home; reads can join or aggregate.' },
  { id: 'projection', label: 'Derived read projection', detail: 'A rebuildable copy serves a specific query with extra write and freshness work.' },
];

function formatRows(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M` : value.toLocaleString();
}

export default function DataModelingQueryTradeoffLab() {
  const [queryId, setQueryId] = useState<QueryId>('history');
  const [plan, setPlan] = useState<StoragePlan>('normalized');
  const [hasAccessPath, setHasAccessPath] = useState(true);

  const query = queries[queryId];
  const result = useMemo(() => {
    const isProjection = plan === 'projection';
    const baseRows = isProjection ? query.projectionRows : query.normalRows;
    const rowsRead = hasAccessPath || queryId === 'checkout' ? baseRows : 10_000_000;
    const writes = isProjection ? 2 : 1;
    const staleRisk = isProjection && queryId !== 'checkout';
    const unsafeWrite = isProjection && queryId === 'checkout';
    const fullScan = !hasAccessPath && queryId !== 'checkout';
    const status = unsafeWrite
      ? 'Incorrect write boundary'
      : fullScan
        ? 'Full scan risk'
        : staleRisk
          ? 'Projection needs freshness operations'
          : 'The modeled path fits';
    const explanation = unsafeWrite
      ? 'A checkout must commit normalized facts transactionally. A projection can update afterward, but should not become the only payment or inventory record.'
      : fullScan
        ? `Without ${query.index}, this read may inspect the 10M-row order population to return a small result.`
        : staleRisk
          ? 'The read is cheap because it is derived. Monitor event lag and keep a rebuild path from the normalized source.'
          : 'The source of truth and access path match this modeled operation. Measure a real query plan before treating the estimate as a service target.';
    return { rowsRead, writes, staleRisk, unsafeWrite, fullScan, status, explanation };
  }, [hasAccessPath, plan, query, queryId]);

  const reset = () => {
    setQueryId('history');
    setPlan('normalized');
    setHasAccessPath(true);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Query and normalization lab"
        title="Choose a source of truth and pay for the read deliberately"
        description="Select a workload, a storage plan, and its access path. The model compares rows read, write work, freshness obligations, and unsafe boundaries."
        icon={TableProperties}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Important operation</legend>
              <div className="mt-3 space-y-2">
                {(Object.keys(queries) as QueryId[]).map((id) => (
                  <LabChoice
                    key={id}
                    selected={queryId === id}
                    label={queries[id].label}
                    detail={queries[id].detail}
                    icon={id === 'checkout' ? Database : id === 'history' ? History : BarChart3}
                    accent="violet"
                    onClick={() => setQueryId(id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Storage plan</legend>
              <div className="mt-3 space-y-2">
                {plans.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={plan === item.id}
                    label={item.label}
                    detail={item.detail}
                    accent="cyan"
                    onClick={() => setPlan(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Provide the matching access path</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Modeled key or index: {query.index}</span>
              </span>
              <input
                type="checkbox"
                checked={hasAccessPath}
                onChange={(event) => setHasAccessPath(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600"
              />
            </label>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric label="Modeled rows read" value={formatRows(result.rowsRead)} detail={result.fullScan ? 'The full order population' : 'Work for the selected operation'} icon={Search} tone={result.fullScan ? 'rose' : 'emerald'} />
            <LabMetric label="Writes per change" value={`${result.writes}x`} detail={plan === 'projection' ? 'Source plus projection update' : 'One authoritative write'} icon={Database} tone={plan === 'projection' ? 'amber' : 'neutral'} />
            <LabMetric label="Freshness contract" value={result.staleRisk ? 'Monitor lag' : 'Transactional'} detail={result.staleRisk ? 'Projection can fall behind' : 'Source facts commit together'} icon={result.staleRisk ? CircleAlert : CheckCircle2} tone={result.staleRisk ? 'amber' : 'emerald'} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex min-w-[480px] items-center gap-3">
              <PathNode label="Application" detail={query.label} icon={Search} tone="cyan" />
              <span className="text-neutral-400" aria-hidden="true">-&gt;</span>
              <PathNode label="Normalized tables" detail={queryId === 'checkout' ? 'Write transaction' : 'Authoritative facts'} icon={Database} tone="violet" />
              {plan === 'projection' ? <><span className="text-neutral-400" aria-hidden="true">-&gt;</span><PathNode label="Read projection" detail={result.staleRisk ? 'Derived and monitored' : 'Not a write authority'} icon={TableProperties} tone="amber" /></> : null}
              <span className="text-neutral-400" aria-hidden="true">-&gt;</span>
              <PathNode label="Query result" detail={hasAccessPath ? query.index : 'No matching access path'} icon={BarChart3} tone={result.fullScan ? 'rose' : 'emerald'} />
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${result.unsafeWrite || result.fullScan ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50' : result.staleRisk ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'}`}>
            <div className="flex items-start gap-3">
              {result.unsafeWrite || result.fullScan ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.status}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PathNode({ label, detail, icon: Icon, tone }: { label: string; detail: string; icon: typeof Database; tone: 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose' }) {
  const toneClass = {
    cyan: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40',
    violet: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
  }[tone];

  return (
    <div className={`w-36 shrink-0 rounded-md border p-3 ${toneClass}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xs leading-4 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}
