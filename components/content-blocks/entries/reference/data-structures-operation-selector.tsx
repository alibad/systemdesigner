'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Binary,
  Check,
  CircleDot,
  GitBranch,
  Hash,
  ListOrdered,
  Network,
  Search,
  Sparkles,
  Target,
  Trees,
  type LucideIcon,
} from 'lucide-react';

type OperationId =
  | 'position'
  | 'key'
  | 'range'
  | 'priority'
  | 'prefix'
  | 'relationship'
  | 'membership';

type StructureId = 'array' | 'hash-table' | 'balanced-tree' | 'heap' | 'trie' | 'graph' | 'bloom-filter';

type Operation = {
  id: OperationId;
  label: string;
  prompt: string;
  icon: LucideIcon;
};

type Structure = {
  id: StructureId;
  name: string;
  summary: string;
  strength: string;
  cost: string;
  caveat: string;
  tone: string;
  icon: LucideIcon;
};

const operations: Operation[] = [
  { id: 'position', label: 'Read by position', prompt: 'Fetch item 42 immediately', icon: Binary },
  { id: 'key', label: 'Find by key', prompt: 'Resolve user ID to a record', icon: Hash },
  { id: 'range', label: 'Scan in order', prompt: 'Read values between two bounds', icon: ListOrdered },
  { id: 'priority', label: 'Take highest priority', prompt: 'Schedule the next most urgent job', icon: Target },
  { id: 'prefix', label: 'Match a prefix', prompt: 'Complete all terms starting with sys', icon: Search },
  { id: 'relationship', label: 'Traverse relationships', prompt: 'Find paths between connected entities', icon: Network },
  { id: 'membership', label: 'Test membership', prompt: 'Ask whether an ID may exist', icon: CircleDot },
];

const structures: Record<StructureId, Structure> = {
  array: {
    id: 'array',
    name: 'Dynamic array',
    summary: 'Store values contiguously and address each slot by position.',
    strength: 'Direct indexed access and strong cache locality',
    cost: 'O(1) indexed read',
    caveat: 'Middle insertions shift later values.',
    tone: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200',
    icon: Binary,
  },
  'hash-table': {
    id: 'hash-table',
    name: 'Hash table',
    summary: 'Map a key to a bucket using a hash function.',
    strength: 'Fast exact key lookup without sorted order',
    cost: 'O(1) expected lookup',
    caveat: 'Collisions and resizing affect tail behavior.',
    tone: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200',
    icon: Hash,
  },
  'balanced-tree': {
    id: 'balanced-tree',
    name: 'Balanced search tree',
    summary: 'Maintain keys in sorted order while bounding tree height.',
    strength: 'Ordered iteration, predecessor lookup, and range scans',
    cost: 'O(log n) search and update',
    caveat: 'Nodes and balancing add memory and pointer work.',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
    icon: Trees,
  },
  heap: {
    id: 'heap',
    name: 'Binary heap',
    summary: 'Keep the minimum or maximum value at the root.',
    strength: 'Repeatedly select and replace the highest-priority item',
    cost: 'O(1) peek, O(log n) push/pop',
    caveat: 'Searching for an arbitrary item remains O(n).',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    icon: GitBranch,
  },
  trie: {
    id: 'trie',
    name: 'Trie',
    summary: 'Share paths among keys with common prefixes.',
    strength: 'Prefix lookup depends on key length, not collection size',
    cost: 'O(m) for a key of length m',
    caveat: 'Sparse child links can consume substantial memory.',
    tone: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200',
    icon: GitBranch,
  },
  graph: {
    id: 'graph',
    name: 'Adjacency-list graph',
    summary: 'Represent entities as vertices and relationships as edges.',
    strength: 'Traverse neighborhoods and model many-to-many relationships',
    cost: 'O(V + E) full traversal',
    caveat: 'Traversal cost depends on topology and algorithm.',
    tone: 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200',
    icon: Network,
  },
  'bloom-filter': {
    id: 'bloom-filter',
    name: 'Bloom filter',
    summary: 'Set several bits per key to provide approximate membership.',
    strength: 'Reject definite misses with very little memory',
    cost: 'O(k) bit probes',
    caveat: 'Positive answers can be false and require verification.',
    tone: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200',
    icon: Sparkles,
  },
};

function rankStructures(operation: OperationId, exact: boolean, ordered: boolean): StructureId[] {
  if (operation === 'position') return ordered ? ['array', 'balanced-tree', 'hash-table'] : ['array', 'hash-table', 'balanced-tree'];
  if (operation === 'key') return ordered ? ['balanced-tree', 'hash-table', 'array'] : ['hash-table', 'balanced-tree', 'array'];
  if (operation === 'range') return ['balanced-tree', 'array', 'hash-table'];
  if (operation === 'priority') return ['heap', 'balanced-tree', 'array'];
  if (operation === 'prefix') return ['trie', 'balanced-tree', 'hash-table'];
  if (operation === 'relationship') return ['graph', 'hash-table', 'array'];
  if (exact) return ordered
    ? ['balanced-tree', 'hash-table', 'bloom-filter']
    : ['hash-table', 'balanced-tree', 'bloom-filter'];
  return ['bloom-filter', 'hash-table', 'balanced-tree'];
}

export default function DataStructuresOperationSelector() {
  const [operation, setOperation] = useState<OperationId>('key');
  const [exact, setExact] = useState(true);
  const [ordered, setOrdered] = useState(false);

  const ranking = useMemo(() => rankStructures(operation, exact, ordered), [exact, operation, ordered]);
  const selectedOperation = operations.find((item) => item.id === operation) ?? operations[0];
  const winner = structures[ranking[0]];

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white dark:border-neutral-800 md:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Target aria-hidden="true" className="h-4 w-4" />
          Workload matcher
        </div>
        <h3 className="mt-2 text-xl font-semibold md:text-2xl">Choose from the operation, not the name</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Select the work on the critical path, then add semantic constraints. The ranking changes when exactness or order is part of the contract.
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 border-b border-neutral-200 p-5 dark:border-neutral-800 lg:border-b-0 lg:border-r md:p-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              1. Dominant operation
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {operations.map((item) => {
                const Icon = item.icon;
                const active = item.id === operation;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOperation(item.id)}
                    className={`min-h-24 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                      active
                        ? 'border-blue-500 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-400/15 dark:text-blue-50'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <Icon aria-hidden="true" className={`h-5 w-5 ${active ? 'text-blue-600 dark:text-blue-300' : 'text-neutral-500'}`} />
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-200">
                          <Check aria-hidden="true" className="h-3 w-3" /> Selected
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 opacity-70">{item.prompt}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              2. Required semantics
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ConstraintToggle
                checked={exact}
                onChange={setExact}
                label="Answers must be exact"
                detail="A false positive would violate the contract."
              />
              <ConstraintToggle
                checked={ordered}
                onChange={setOrdered}
                label="Keys must stay ordered"
                detail="The workload needs ranges or sorted iteration."
              />
            </div>
          </fieldset>
        </div>

        <aside className="bg-neutral-50 p-5 dark:bg-neutral-900/60 md:p-6" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Recommended fit</p>
          <div className={`mt-3 rounded-lg border p-4 ${winner.tone}`}>
            <winner.icon aria-hidden="true" className="h-7 w-7" />
            <h4 className="mt-4 text-xl font-bold">{winner.name}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">{winner.summary}</p>
            <div className="mt-4 rounded-md bg-white/70 p-3 text-sm dark:bg-black/25">
              <p className="font-semibold">{winner.cost}</p>
              <p className="mt-1 text-xs leading-5 opacity-75">{winner.strength}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Why the ranking changed</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              <strong>{selectedOperation.label}</strong> is the dominant operation. {exact ? 'Exact answers are required.' : 'Approximate membership is acceptable.'}{' '}
              {ordered ? 'Ordered keys are also part of the contract.' : 'The structure does not need to preserve key order.'}
            </p>
          </div>

          <ol className="mt-5 space-y-2">
            {ranking.map((id, index) => {
              const item = structures[id];
              return (
                <li key={id} className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-950">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.name}</span>
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{item.cost}</span>
                  </span>
                  {index < ranking.length - 1 ? <ArrowRight aria-hidden="true" className="h-4 w-4 text-neutral-400" /> : null}
                </li>
              );
            })}
          </ol>

          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Verify before committing:</strong> {winner.caveat}
          </p>
        </aside>
      </div>
    </section>
  );
}

function ConstraintToggle({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <span>
        <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"
      />
    </label>
  );
}
