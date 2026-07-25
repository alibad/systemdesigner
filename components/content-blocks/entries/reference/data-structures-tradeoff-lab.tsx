'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  Cpu,
  Gauge,
  GitBranch,
  HardDrive,
  Hash,
  Link2,
  MemoryStick,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type ModelId = 'array' | 'linked-list' | 'hash-table' | 'balanced-tree' | 'bloom-filter';

type Model = {
  id: ModelId;
  name: string;
  bytesPerItem: number;
  exact: boolean;
  ordered: boolean;
  locality: 'High' | 'Medium' | 'Low';
  note: string;
  icon: LucideIcon;
};

const models: Model[] = [
  {
    id: 'array',
    name: 'Array',
    bytesPerItem: 16,
    exact: true,
    ordered: false,
    locality: 'High',
    note: 'Compact contiguous storage, but an unsorted membership scan is linear.',
    icon: Binary,
  },
  {
    id: 'linked-list',
    name: 'Linked list',
    bytesPerItem: 32,
    exact: true,
    ordered: false,
    locality: 'Low',
    note: 'Known-node edits are cheap; search follows pointers one node at a time.',
    icon: Link2,
  },
  {
    id: 'hash-table',
    name: 'Hash table',
    bytesPerItem: 48,
    exact: true,
    ordered: false,
    locality: 'Medium',
    note: 'Expected constant lookup trades extra capacity and bucket metadata for speed.',
    icon: Hash,
  },
  {
    id: 'balanced-tree',
    name: 'Balanced tree',
    bytesPerItem: 48,
    exact: true,
    ordered: true,
    locality: 'Low',
    note: 'Height stays logarithmic and keys remain ordered, but nodes carry links.',
    icon: GitBranch,
  },
  {
    id: 'bloom-filter',
    name: 'Bloom filter',
    bytesPerItem: 1.2,
    exact: false,
    ordered: false,
    locality: 'High',
    note: 'A compact pre-check can reject misses, but positive answers need exact storage.',
    icon: Sparkles,
  },
];

function compact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return Math.round(value).toLocaleString();
}

function formatMemory(bytes: number) {
  const mib = bytes / 1024 / 1024;
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB`;
  if (mib >= 1) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MiB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}

function lookupTouches(id: ModelId, count: number) {
  if (id === 'hash-table') return 2;
  if (id === 'balanced-tree') return Math.ceil(Math.log2(count + 1));
  if (id === 'bloom-filter') return 7;
  return Math.max(1, Math.ceil(count / 2));
}

export default function DataStructuresTradeoffLab() {
  const [modelId, setModelId] = useState<ModelId>('hash-table');
  const [itemExponent, setItemExponent] = useState(6);
  const [budgetMiB, setBudgetMiB] = useState(64);
  const [exactRequired, setExactRequired] = useState(true);

  const selected = models.find((model) => model.id === modelId) ?? models[0];
  const result = useMemo(() => {
    const count = Math.round(10 ** itemExponent);
    const memoryBytes = count * selected.bytesPerItem;
    const budgetBytes = budgetMiB * 1024 * 1024;
    const touches = lookupTouches(selected.id, count);
    const memoryFit = memoryBytes <= budgetBytes;
    const semanticFit = !exactRequired || selected.exact;
    return {
      count,
      memoryBytes,
      touches,
      memoryFit,
      semanticFit,
      fit: memoryFit && semanticFit,
      pressure: Math.min(100, (memoryBytes / budgetBytes) * 100),
    };
  }, [budgetMiB, exactRequired, itemExponent, selected]);

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 px-5 py-5 dark:border-neutral-800 md:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <Gauge aria-hidden="true" className="h-4 w-4" />
          Scale and memory lab
        </div>
        <h3 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white md:text-2xl">Make the hidden costs visible</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          Compare simplified in-memory representations for membership lookup. Scale the dataset and tighten the memory budget to reveal where asymptotic cost, locality, and exactness diverge.
        </p>
      </header>

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Representation</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {models.map((model) => {
                const Icon = model.icon;
                const active = model.id === selected.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModelId(model.id)}
                    className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      active
                        ? 'border-violet-500 bg-violet-50 text-violet-950 dark:border-violet-400 dark:bg-violet-400/15 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600 dark:text-violet-300' : 'text-neutral-500'}`} />
                    <span>{model.name}</span>
                    {active ? <CheckCircle2 aria-hidden="true" className="ml-auto h-4 w-4 text-violet-600 dark:text-violet-300" /> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Items <strong className="tabular-nums text-violet-700 dark:text-violet-300">{compact(result.count)}</strong>
            </span>
            <input
              type="range"
              min="3"
              max="8"
              step="0.1"
              value={itemExponent}
              onChange={(event) => setItemExponent(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
            />
            <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400"><span>1K</span><span>100M</span></span>
          </label>

          <label className="mt-5 block">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Memory budget <strong className="tabular-nums text-violet-700 dark:text-violet-300">{budgetMiB} MiB</strong>
            </span>
            <input
              type="range"
              min="16"
              max="1024"
              step="16"
              value={budgetMiB}
              onChange={(event) => setBudgetMiB(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-600"
            />
            <span className="mt-1 flex justify-between text-xs text-neutral-500 dark:text-neutral-400"><span>16 MiB</span><span>1 GiB</span></span>
          </label>

          <label className="mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <span>
              <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">Exact answers required</span>
              <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">Reject false positives.</span>
            </span>
            <input
              type="checkbox"
              checked={exactRequired}
              onChange={(event) => setExactRequired(event.target.checked)}
              className="h-5 w-5 shrink-0 accent-violet-600"
            />
          </label>
        </div>

        <div className="min-w-0 p-5 md:p-6" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric icon={MemoryStick} label="Estimated memory" value={formatMemory(result.memoryBytes)} tone={result.memoryFit ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'} />
            <Metric icon={Cpu} label="Lookup touches" value={compact(result.touches)} tone="text-blue-600 dark:text-blue-300" />
            <Metric icon={HardDrive} label="Cache locality" value={selected.locality} tone={selected.locality === 'Low' ? 'text-amber-700 dark:text-amber-300' : 'text-cyan-700 dark:text-cyan-300'} />
            <Metric icon={selected.exact ? CheckCircle2 : AlertTriangle} label="Membership answer" value={selected.exact ? 'Exact' : 'Approximate'} tone={selected.exact ? 'text-emerald-600 dark:text-emerald-300' : 'text-fuchsia-700 dark:text-fuchsia-300'} />
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Memory pressure</span>
              <span className={`text-sm font-bold tabular-nums ${result.memoryFit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                {formatMemory(result.memoryBytes)} / {budgetMiB} MiB
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${result.memoryFit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.max(2, result.pressure)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Model assumption: {selected.bytesPerItem} bytes per item for this simplified representation. Real runtimes vary by value size, allocator, load factor, and implementation.
            </p>
          </div>

          <div className={`mt-5 rounded-lg border p-5 ${
            result.fit
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
              : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50'
          }`}>
            <div className="flex items-start gap-3">
              {result.fit ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-600 dark:text-rose-300" />}
              <div>
                <h4 className="text-lg font-bold">{result.fit ? 'This representation fits the contract' : 'A constraint is broken'}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {!result.memoryFit
                    ? `${selected.name} exceeds the modeled memory budget. Reduce per-item overhead, raise the budget, partition the set, or use a compact pre-filter.`
                    : !result.semanticFit
                      ? 'The Bloom filter fits in memory but cannot prove membership. Pair it with exact storage or relax the exactness requirement.'
                      : `${selected.name} stays within budget and satisfies the requested membership semantics.`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">What Big O reveals</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                Lookup work grows as {selected.id === 'hash-table' ? 'an expected constant' : selected.id === 'balanced-tree' ? 'the logarithm of item count' : selected.id === 'bloom-filter' ? 'a fixed number of bit probes' : 'roughly half the collection'}.
              </p>
            </div>
            <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">What Big O hides</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{selected.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 md:p-4">
      <Icon aria-hidden="true" className={`h-5 w-5 ${tone}`} />
      <p className={`mt-3 break-words text-lg font-bold tabular-nums md:text-xl ${tone}`}>{value}</p>
      <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}
