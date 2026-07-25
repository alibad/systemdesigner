'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CircleDot,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  Network,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Workflow,
  Zap,
} from 'lucide-react';

type DataShape = 'relational' | 'document' | 'key-value' | 'graph' | 'event';
type TransactionBoundary = 'single-record' | 'multi-record' | 'cross-service';
type QueryShape = 'known-keys' | 'joins' | 'traversal' | 'full-text' | 'time-window';
type Consistency = 'strict' | 'session' | 'eventual';
type Availability = 'single-region' | 'multi-zone' | 'multi-region';
type Operations = 'lean' | 'platform';
type Challenge =
  | 'baseline'
  | 'hotspot'
  | 'region-partition'
  | 'schema-evolution'
  | 'analytics-interference';

interface SelectorState {
  dataShape: DataShape;
  transactionBoundary: TransactionBoundary;
  queryShape: QueryShape;
  consistency: Consistency;
  availability: Availability;
  operations: Operations;
  peakQps: number;
  dataTb: number;
  writePercent: number;
  p99Ms: number;
  challenge: Challenge;
}

interface Candidate {
  id: string;
  category: string;
  examples: string;
  summary: string;
  bestFor: string;
  modelFit: DataShape[];
  queryFit: QueryShape[];
  transactionStrength: 1 | 2 | 3;
  consistencyStrength: 1 | 2 | 3;
  distribution: 1 | 2 | 3;
  latency: 1 | 2 | 3;
  operationsBurden: 1 | 2 | 3;
  schemaFlexibility: 1 | 2 | 3;
  analyticsIsolation: 1 | 2 | 3;
  hotspotResistance: 1 | 2 | 3;
  partitionOptions: 1 | 2 | 3;
  migrationRisk: string;
  decisionTriggers: string[];
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';
}

interface Evaluation extends Candidate {
  score: number;
  reasons: string[];
  contradictions: string[];
  status: 'credible' | 'conditional' | 'constrained';
}

const INITIAL_STATE: SelectorState = {
  dataShape: 'relational',
  transactionBoundary: 'multi-record',
  queryShape: 'joins',
  consistency: 'strict',
  availability: 'multi-zone',
  operations: 'lean',
  peakQps: 12000,
  dataTb: 2,
  writePercent: 35,
  p99Ms: 80,
  challenge: 'baseline',
};

const CANDIDATES: Candidate[] = [
  {
    id: 'relational-primary',
    category: 'Relational primary',
    examples: 'PostgreSQL · MySQL',
    summary: 'One transactional source of truth with relational constraints and expressive queries.',
    bestFor: 'Business records whose correctness spans multiple rows and relationships.',
    modelFit: ['relational', 'document'],
    queryFit: ['known-keys', 'joins', 'time-window'],
    transactionStrength: 3,
    consistencyStrength: 3,
    distribution: 1,
    latency: 2,
    operationsBurden: 2,
    schemaFlexibility: 2,
    analyticsIsolation: 1,
    hotspotResistance: 2,
    partitionOptions: 1,
    migrationRisk: 'Sharding later changes keys, joins, transactions, and operational ownership at once.',
    decisionTriggers: [
      'One primary can no longer meet tested write headroom.',
      'Region-local writes become a hard product requirement.',
      'Analytical scans repeatedly consume the OLTP latency budget.',
    ],
    tone: 'blue',
  },
  {
    id: 'distributed-sql',
    category: 'Distributed SQL',
    examples: 'CockroachDB · YugabyteDB · Spanner-style systems',
    summary: 'Relational transactions spread across failure domains through a distributed consensus layer.',
    bestFor: 'Relational workloads that require multi-node or multi-region survivability.',
    modelFit: ['relational', 'document'],
    queryFit: ['known-keys', 'joins', 'time-window'],
    transactionStrength: 3,
    consistencyStrength: 3,
    distribution: 3,
    latency: 2,
    operationsBurden: 3,
    schemaFlexibility: 2,
    analyticsIsolation: 2,
    hotspotResistance: 2,
    partitionOptions: 3,
    migrationRisk: 'Data locality, transaction span, and schema changes must be tested against consensus latency.',
    decisionTriggers: [
      'Cross-region transaction latency exceeds the user-facing budget.',
      'Hot ranges concentrate writes despite adding nodes.',
      'Operational complexity outweighs the value of distributed writes.',
    ],
    tone: 'violet',
  },
  {
    id: 'document-store',
    category: 'Document store',
    examples: 'MongoDB · Couchbase',
    summary: 'Aggregate-shaped records keep related fields together and evolve without a table-per-variant.',
    bestFor: 'Document-centric domains whose dominant reads fetch one bounded aggregate.',
    modelFit: ['document', 'event'],
    queryFit: ['known-keys', 'time-window'],
    transactionStrength: 2,
    consistencyStrength: 2,
    distribution: 2,
    latency: 2,
    operationsBurden: 2,
    schemaFlexibility: 3,
    analyticsIsolation: 2,
    hotspotResistance: 2,
    partitionOptions: 2,
    migrationRisk: 'Unbounded documents and duplicated fields can turn schema freedom into migration debt.',
    decisionTriggers: [
      'Cross-document invariants become common rather than exceptional.',
      'The same fields are updated through many competing document shapes.',
      'Shard-key changes require large data movement.',
    ],
    tone: 'emerald',
  },
  {
    id: 'wide-column',
    category: 'Wide-column store',
    examples: 'Cassandra · ScyllaDB',
    summary: 'Query-first partitions trade flexible querying for predictable distributed reads and writes.',
    bestFor: 'High-volume workloads with known access paths and partition-bounded operations.',
    modelFit: ['key-value', 'event'],
    queryFit: ['known-keys', 'time-window'],
    transactionStrength: 1,
    consistencyStrength: 2,
    distribution: 3,
    latency: 3,
    operationsBurden: 3,
    schemaFlexibility: 2,
    analyticsIsolation: 2,
    hotspotResistance: 2,
    partitionOptions: 3,
    migrationRisk: 'Every new access pattern may require a new denormalized table and a backfill.',
    decisionTriggers: [
      'A partition can grow without a clear bound.',
      'Ad hoc joins or cross-partition transactions become required.',
      'The team cannot sustain repair, compaction, and capacity discipline.',
    ],
    tone: 'amber',
  },
  {
    id: 'managed-key-value',
    category: 'Managed key-value',
    examples: 'DynamoDB · cloud key-value services',
    summary: 'A managed partitioned keyspace provides fast lookup paths with explicit key design.',
    bestFor: 'Known key-based access with high scale and a small operational team.',
    modelFit: ['key-value', 'document', 'event'],
    queryFit: ['known-keys', 'time-window'],
    transactionStrength: 2,
    consistencyStrength: 2,
    distribution: 3,
    latency: 3,
    operationsBurden: 1,
    schemaFlexibility: 3,
    analyticsIsolation: 2,
    hotspotResistance: 2,
    partitionOptions: 3,
    migrationRisk: 'Provider-specific key, index, and throughput choices can make later movement expensive.',
    decisionTriggers: [
      'Access paths outgrow the planned keys and secondary indexes.',
      'Hot tenants or keys consume disproportionate capacity.',
      'Cross-item coordination becomes central to the domain.',
    ],
    tone: 'cyan',
  },
  {
    id: 'graph-primary',
    category: 'Graph primary',
    examples: 'Neo4j · managed graph services',
    summary: 'Relationships become first-class data so multi-hop traversals stay explicit.',
    bestFor: 'Domains where variable-depth relationship traversal is the product behavior.',
    modelFit: ['graph'],
    queryFit: ['traversal'],
    transactionStrength: 2,
    consistencyStrength: 3,
    distribution: 1,
    latency: 2,
    operationsBurden: 3,
    schemaFlexibility: 2,
    analyticsIsolation: 2,
    hotspotResistance: 1,
    partitionOptions: 1,
    migrationRisk: 'Moving into or out of a graph model requires rebuilding identity and relationship semantics.',
    decisionTriggers: [
      'Most requests become direct key lookups rather than traversals.',
      'The graph must be partitioned across regions with bounded latency.',
      'Relationship projections can be derived from another source of truth.',
    ],
    tone: 'rose',
  },
];

const CHALLENGES: Array<{
  id: Challenge;
  label: string;
  description: string;
  icon: typeof Gauge;
}> = [
  {
    id: 'baseline',
    label: 'Normal load',
    description: 'Evaluate the declared workload without an injected fault.',
    icon: ShieldCheck,
  },
  {
    id: 'hotspot',
    label: 'Hot tenant',
    description: 'One tenant drives 42% of writes into a narrow key range.',
    icon: Zap,
  },
  {
    id: 'region-partition',
    label: 'Region partition',
    description: 'A region loses quorum connectivity while clients keep writing.',
    icon: Globe2,
  },
  {
    id: 'schema-evolution',
    label: 'Schema wave',
    description: 'Three client versions write different shapes during a migration.',
    icon: GitBranch,
  },
  {
    id: 'analytics-interference',
    label: 'Analytics surge',
    description: 'A broad scan competes with latency-sensitive serving traffic.',
    icon: BarChart3,
  },
];

const SHAPE_OPTIONS: Array<{ value: DataShape; label: string; hint: string }> = [
  { value: 'relational', label: 'Relational', hint: 'Records and enforced relationships' },
  { value: 'document', label: 'Documents', hint: 'Bounded aggregates with varied fields' },
  { value: 'key-value', label: 'Key-value', hint: 'Known keys and direct lookup paths' },
  { value: 'graph', label: 'Graph', hint: 'Variable-depth relationships' },
  { value: 'event', label: 'Events', hint: 'Append-heavy time-ordered records' },
];

const TRANSACTION_OPTIONS: Array<{
  value: TransactionBoundary;
  label: string;
  hint: string;
}> = [
  { value: 'single-record', label: 'Single record', hint: 'One aggregate changes atomically' },
  { value: 'multi-record', label: 'Multiple records', hint: 'Several records share one invariant' },
  { value: 'cross-service', label: 'Cross-service', hint: 'A workflow spans ownership boundaries' },
];

const QUERY_OPTIONS: Array<{ value: QueryShape; label: string; hint: string }> = [
  { value: 'known-keys', label: 'Known keys', hint: 'Fetch by tenant, ID, or partition' },
  { value: 'joins', label: 'Joins', hint: 'Combine related records at request time' },
  { value: 'traversal', label: 'Traversal', hint: 'Walk an unknown number of relationships' },
  { value: 'full-text', label: 'Full-text', hint: 'Rank and filter human language' },
  { value: 'time-window', label: 'Time windows', hint: 'Aggregate recent ordered records' },
];

const CONSISTENCY_OPTIONS: Array<{ value: Consistency; label: string }> = [
  { value: 'strict', label: 'Strict' },
  { value: 'session', label: 'Read-your-writes' },
  { value: 'eventual', label: 'Eventual' },
];

const AVAILABILITY_OPTIONS: Array<{ value: Availability; label: string }> = [
  { value: 'single-region', label: 'One region' },
  { value: 'multi-zone', label: 'Multi-zone' },
  { value: 'multi-region', label: 'Multi-region' },
];

const OPERATION_OPTIONS: Array<{ value: Operations; label: string }> = [
  { value: 'lean', label: 'Lean team' },
  { value: 'platform', label: 'Platform team' },
];

const TONE_STYLES: Record<Candidate['tone'], string> = {
  blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/55 dark:text-blue-100',
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-100',
  amber:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/55 dark:text-amber-100',
  violet:
    'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/55 dark:text-violet-100',
  cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/55 dark:text-cyan-100',
  rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/55 dark:text-rose-100',
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatQps(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return value.toString();
}

function formatData(value: number) {
  if (value < 1) return `${Math.round(value * 1000)} GB`;
  return `${value.toFixed(value >= 10 ? 0 : 1)} TB`;
}

function scaleNeed(state: SelectorState): 1 | 2 | 3 {
  if (state.peakQps >= 100_000 || state.dataTb >= 100 || state.availability === 'multi-region') {
    return 3;
  }
  if (state.peakQps >= 10_000 || state.dataTb >= 10 || state.availability === 'multi-zone') {
    return 2;
  }
  return 1;
}

function evaluateCandidate(candidate: Candidate, state: SelectorState): Evaluation {
  let score = 20;
  const reasons: string[] = [];
  const contradictions: string[] = [];
  const requiredScale = scaleNeed(state);

  if (candidate.modelFit.includes(state.dataShape)) {
    score += 17;
    reasons.push(`Its ${candidate.category.toLowerCase()} model fits the ${state.dataShape} ownership shape.`);
  } else {
    score -= 12;
    contradictions.push(`The ${state.dataShape} model would be translated rather than represented directly.`);
  }

  if (candidate.queryFit.includes(state.queryShape)) {
    score += 16;
    reasons.push(`The ${state.queryShape.replace('-', ' ')} path is native to this category.`);
  } else if (state.queryShape === 'full-text') {
    score -= 7;
    contradictions.push('Full-text ranking belongs in a search projection, not this primary store.');
  } else {
    score -= 14;
    contradictions.push(`The ${state.queryShape.replace('-', ' ')} path fights the preferred access model.`);
  }

  if (state.transactionBoundary === 'multi-record') {
    if (candidate.transactionStrength === 3) {
      score += 15;
      reasons.push('It can keep the declared multi-record invariant inside one transaction boundary.');
    } else {
      score -= candidate.transactionStrength === 2 ? 10 : 22;
      contradictions.push('Multi-record correctness needs redesign, compensation, or a narrower aggregate.');
    }
  } else if (state.transactionBoundary === 'single-record') {
    score += candidate.transactionStrength >= 2 ? 7 : 3;
    reasons.push('The transaction boundary stays local to one record or partition.');
  } else {
    score -= 4;
    contradictions.push('No database makes a cross-service workflow atomic; use local commits plus an outbox or saga.');
  }

  if (state.consistency === 'strict') {
    if (candidate.consistencyStrength === 3) {
      score += 10;
      reasons.push('Its normal contract can support strict reads and writes within the modeled boundary.');
    } else {
      score -= 13;
      contradictions.push('The strict consistency requirement is stronger than this category’s natural contract.');
    }
  } else if (state.consistency === 'session') {
    score += candidate.consistencyStrength >= 2 ? 7 : -3;
  } else {
    score += 4;
  }

  if (candidate.distribution >= requiredScale) {
    score += 10;
    reasons.push(`Its distribution model fits ${formatQps(state.peakQps)} peak QPS and ${formatData(state.dataTb)} of data.`);
  } else {
    score -= (requiredScale - candidate.distribution) * 11;
    contradictions.push('The requested scale or failure-domain span exceeds the natural deployment boundary.');
  }

  if (state.p99Ms <= 25) {
    score += candidate.latency === 3 ? 8 : candidate.latency === 2 ? 1 : -7;
    if (candidate.latency < 3) {
      contradictions.push('A sub-25 ms p99 requires locality and measured query bounds that this choice does not guarantee.');
    }
  } else if (candidate.latency >= 2) {
    score += 4;
  }

  if (state.operations === 'lean') {
    score += candidate.operationsBurden === 1 ? 9 : candidate.operationsBurden === 2 ? 1 : -9;
    if (candidate.operationsBurden === 3) {
      contradictions.push('The operating model assumes expertise the current team does not have.');
    }
  } else {
    score += candidate.operationsBurden >= 2 ? 4 : 2;
  }

  if (state.writePercent >= 70) {
    score += candidate.distribution === 3 && candidate.queryFit.includes('known-keys') ? 6 : -2;
  }

  if (state.challenge === 'hotspot') {
    if (candidate.hotspotResistance === 3) {
      score += 5;
      reasons.push('The category offers strong tools for spreading a concentrated write path.');
    } else {
      score -= candidate.hotspotResistance === 2 ? 7 : 16;
      contradictions.push('A hot tenant can still saturate one range, partition, or leader; key redesign is required.');
    }
  }

  if (state.challenge === 'region-partition') {
    if (candidate.partitionOptions === 3) {
      score += 6;
      reasons.push('Its distributed topology exposes explicit placement and partition behavior.');
    } else {
      score -= 15;
      contradictions.push('This topology cannot keep the declared service available across a region partition.');
    }
    if (state.consistency === 'strict' && state.availability === 'multi-region') {
      score -= 5;
      contradictions.push('During a partition, strict consistency and write availability cannot both be preserved everywhere.');
    }
  }

  if (state.challenge === 'schema-evolution') {
    if (candidate.schemaFlexibility === 3) {
      score += 7;
      reasons.push('Mixed-version records can coexist while the application controls compatibility.');
    } else {
      score -= 8;
      contradictions.push('The rollout needs expand-and-contract migrations before old clients disappear.');
    }
  }

  if (state.challenge === 'analytics-interference') {
    if (candidate.analyticsIsolation === 3) {
      score += 6;
      reasons.push('The category can isolate broad analytical work from serving traffic.');
    } else {
      score -= candidate.analyticsIsolation === 2 ? 7 : 15;
      contradictions.push('Broad scans can consume serving I/O and cache; a replica or analytical projection is needed.');
    }
  }

  const boundedScore = clamp(Math.round(score), 8, 96);
  const status: Evaluation['status'] =
    contradictions.length >= 3 || boundedScore < 46
      ? 'constrained'
      : contradictions.length === 0 && boundedScore >= 76
        ? 'credible'
        : 'conditional';

  return {
    ...candidate,
    score: boundedScore,
    reasons: reasons.slice(0, 4),
    contradictions: contradictions.slice(0, 4),
    status,
  };
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">{label}</legend>
      <div className="mt-2 grid gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-11 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selected
                  ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-300 dark:text-zinc-950'
                  : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
              }`}
            >
              <span className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-white bg-white text-blue-700 dark:border-zinc-950 dark:bg-zinc-950 dark:text-cyan-300'
                      : 'border-zinc-400 text-transparent dark:border-zinc-600'
                  }`}
                >
                  <Check className="size-3" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  {option.hint ? (
                    <span
                      className={`mt-0.5 block text-xs leading-5 ${
                        selected
                          ? 'text-blue-100 dark:text-zinc-800'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {option.hint}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">{label}</legend>
      <div className="mt-2 grid grid-cols-1 gap-1 rounded-md border border-zinc-300 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-3 xl:grid-cols-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-9 rounded px-2.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selected
                  ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 hover:bg-white hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeControl({
  id,
  label,
  value,
  minimum,
  maximum,
  step,
  display,
  minimumLabel,
  maximumLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  display: string;
  minimumLabel: string;
  maximumLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-bold text-blue-700 dark:text-cyan-300">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-blue-700 dark:accent-cyan-300"
      />
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-500">
        <span>{minimumLabel}</span>
        <span>{maximumLabel}</span>
      </div>
    </div>
  );
}

function statusCopy(status: Evaluation['status']) {
  if (status === 'credible') return 'Credible fit';
  if (status === 'conditional') return 'Conditional fit';
  return 'Hard constraints conflict';
}

function companionBoundary(state: SelectorState, candidate: Evaluation) {
  if (state.queryShape === 'full-text') {
    return {
      label: 'Search projection',
      detail: 'Publish searchable fields into a dedicated index; keep source-of-truth writes elsewhere.',
      icon: Search,
    };
  }
  if (state.queryShape === 'time-window' || state.challenge === 'analytics-interference') {
    return {
      label: 'Analytical projection',
      detail: 'Move broad scans into a columnar store, warehouse, or isolated read path.',
      icon: BarChart3,
    };
  }
  if (state.queryShape === 'traversal' && candidate.id !== 'graph-primary') {
    return {
      label: 'Graph projection',
      detail: 'Derive relationships into a graph store while preserving the authoritative record elsewhere.',
      icon: Network,
    };
  }
  return {
    label: 'No companion forced',
    detail: 'Start with one source of truth; add a projection only when a measured access path requires it.',
    icon: CircleDot,
  };
}

export default function DatabaseSelector() {
  const [state, setState] = useState<SelectorState>(INITIAL_STATE);
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const evaluations = useMemo(
    () =>
      CANDIDATES.map((candidate) => evaluateCandidate(candidate, state)).sort(
        (left, right) => right.score - left.score,
      ),
    [state],
  );

  const leader = evaluations[0];
  const inspected =
    evaluations.find((candidate) => candidate.id === inspectedId) ?? leader;
  const companion = companionBoundary(state, inspected);
  const CompanionIcon = companion.icon;
  const activeChallenge =
    CHALLENGES.find((challenge) => challenge.id === state.challenge) ?? CHALLENGES[0];
  const healthy = state.challenge === 'baseline' && inspected.status !== 'constrained';

  const update = <Key extends keyof SelectorState>(key: Key, value: SelectorState[Key]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setState(INITIAL_STATE);
    setInspectedId(null);
  };

  return (
    <section
      className="not-prose w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-cyan-300">
              <Database className="size-4" aria-hidden="true" />
              Database decision workbench
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">Choose the ownership boundary first</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
              Model the data and transaction contract, set the operating envelope, then inject the
              failure that could invalidate an otherwise attractive choice.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              aria-live="polite"
              className={`flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${
                leader.status === 'credible'
                  ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
                  : leader.status === 'conditional'
                    ? 'border-amber-700 bg-amber-950 text-amber-100'
                    : 'border-rose-700 bg-rose-950 text-rose-100'
              }`}
            >
              {leader.status === 'credible' ? (
                <ShieldCheck className="size-4" aria-hidden="true" />
              ) : (
                <ShieldAlert className="size-4" aria-hidden="true" />
              )}
              {leader.category}: {leader.score}
            </div>
            <button
              type="button"
              onClick={reset}
              title="Reset selector"
              aria-label="Reset database selector"
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <RefreshCcw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/45 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
              Challenge the healthy design
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Scenario pressure changes the same ranking; it is not a separate quiz result.
            </p>
          </div>
          <span
            className={`hidden rounded px-2 py-1 text-xs font-bold sm:inline ${
              healthy
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
            }`}
          >
            {healthy ? 'Healthy baseline' : 'Pressure active'}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {CHALLENGES.map((challenge) => {
            const Icon = challenge.icon;
            const selected = challenge.id === state.challenge;
            return (
              <button
                key={challenge.id}
                type="button"
                aria-pressed={selected}
                onClick={() => update('challenge', challenge.id)}
                className={`min-h-[5.25rem] rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'border-amber-500 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-300 dark:bg-amber-300 dark:text-zinc-950'
                    : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Icon className="size-4" aria-hidden="true" />
                  {challenge.label}
                </span>
                <span
                  className={`mt-1 block text-xs leading-5 ${
                    selected
                      ? 'text-amber-900 dark:text-zinc-800'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {challenge.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-center gap-2">
            <Table2 className="size-4 text-blue-700 dark:text-cyan-300" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
                1. Data contract
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                What must remain true?
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-5">
            <ChoiceGroup
              label="Primary data shape"
              options={SHAPE_OPTIONS}
              value={state.dataShape}
              onChange={(value) => update('dataShape', value)}
            />
            <ChoiceGroup
              label="Transaction boundary"
              options={TRANSACTION_OPTIONS}
              value={state.transactionBoundary}
              onChange={(value) => update('transactionBoundary', value)}
            />
            <ChoiceGroup
              label="Hardest serving query"
              options={QUERY_OPTIONS}
              value={state.queryShape}
              onChange={(value) => update('queryShape', value)}
            />
          </div>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100">
                2. Operating envelope
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                What must the team sustain?
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-5">
            <RangeControl
              id="database-selector-qps"
              label="Peak requests / second"
              value={state.peakQps}
              minimum={500}
              maximum={500000}
              step={500}
              display={formatQps(state.peakQps)}
              minimumLabel="500"
              maximumLabel="500K"
              onChange={(value) => update('peakQps', value)}
            />
            <RangeControl
              id="database-selector-data"
              label="Active data"
              value={state.dataTb}
              minimum={0.1}
              maximum={500}
              step={0.1}
              display={formatData(state.dataTb)}
              minimumLabel="100 GB"
              maximumLabel="500 TB"
              onChange={(value) => update('dataTb', value)}
            />
            <RangeControl
              id="database-selector-write-share"
              label="Write share"
              value={state.writePercent}
              minimum={5}
              maximum={95}
              step={5}
              display={`${state.writePercent}%`}
              minimumLabel="Read-heavy"
              maximumLabel="Write-heavy"
              onChange={(value) => update('writePercent', value)}
            />
            <RangeControl
              id="database-selector-latency"
              label="Serving p99 target"
              value={state.p99Ms}
              minimum={10}
              maximum={500}
              step={5}
              display={`${state.p99Ms} ms`}
              minimumLabel="10 ms"
              maximumLabel="500 ms"
              onChange={(value) => update('p99Ms', value)}
            />
            <SegmentedControl
              label="Consistency"
              options={CONSISTENCY_OPTIONS}
              value={state.consistency}
              onChange={(value) => update('consistency', value)}
            />
            <SegmentedControl
              label="Failure domains"
              options={AVAILABILITY_OPTIONS}
              value={state.availability}
              onChange={(value) => update('availability', value)}
            />
            <SegmentedControl
              label="Operating team"
              options={OPERATION_OPTIONS}
              value={state.operations}
              onChange={(value) => update('operations', value)}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="grid min-w-0 2xl:grid-cols-[minmax(0,1fr)_19rem]">
            <main className="min-w-0 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    Recommended decision boundary
                  </div>
                  <h3 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">
                    {inspected.category}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Illustrative category · {inspected.examples}
                  </p>
                </div>
                <div
                  aria-live="polite"
                  className={`self-start rounded-md border px-3 py-2 ${
                    inspected.status === 'credible'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100'
                      : inspected.status === 'conditional'
                        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100'
                        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100'
                  }`}
                >
                  <div className="text-xs font-bold uppercase">{statusCopy(inspected.status)}</div>
                  <div className="mt-0.5 text-xl font-bold">{inspected.score} / 100</div>
                </div>
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {inspected.summary} {inspected.bestFor}
              </p>

              <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/45">
                <div className="grid gap-0 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700 dark:text-cyan-300">
                      <Activity className="size-4" aria-hidden="true" />
                      Workload contract
                    </div>
                    <div className="mt-2 text-sm font-bold text-zinc-950 dark:text-white">
                      {state.dataShape} · {state.queryShape.replace('-', ' ')}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {state.transactionBoundary.replace('-', ' ')} transaction, {state.consistency}{' '}
                      consistency
                    </div>
                  </div>
                  <div className="hidden items-center px-1 text-zinc-400 lg:flex dark:text-zinc-600">
                    <ArrowRight className="size-5" aria-hidden="true" />
                  </div>
                  <div className={`border-y p-4 lg:border-x lg:border-y-0 ${TONE_STYLES[inspected.tone]}`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase">
                      <Database className="size-4" aria-hidden="true" />
                      Source of truth
                    </div>
                    <div className="mt-2 text-sm font-bold">{inspected.category}</div>
                    <div className="mt-1 text-xs leading-5 opacity-80">
                      Owns authoritative writes and invariant enforcement.
                    </div>
                  </div>
                  <div className="hidden items-center px-1 text-zinc-400 lg:flex dark:text-zinc-600">
                    <ArrowRight className="size-5" aria-hidden="true" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">
                      <CompanionIcon className="size-4" aria-hidden="true" />
                      Companion boundary
                    </div>
                    <div className="mt-2 text-sm font-bold text-zinc-950 dark:text-white">
                      {companion.label}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {companion.detail}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="border-l-2 border-emerald-500 pl-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                    Why it ranks here
                  </h4>
                  {inspected.reasons.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {inspected.reasons.map((reason) => (
                        <li
                          key={reason}
                          className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                        >
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                      No positive evidence survives the current hard constraints.
                    </p>
                  )}
                </section>

                <section className="border-l-2 border-rose-500 pl-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                    <AlertTriangle className="size-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />
                    Contradictions to resolve
                  </h4>
                  {inspected.contradictions.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {inspected.contradictions.map((contradiction) => (
                        <li
                          key={contradiction}
                          className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                        >
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rose-500" />
                          <span>{contradiction}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      No hard contradiction is visible. Validate with production-shaped data and
                      failure tests before committing.
                    </p>
                  )}
                </section>
              </div>

              <div
                className={`mt-5 rounded-lg border p-4 ${
                  state.challenge === 'baseline'
                    ? 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/45'
                    : inspected.status === 'constrained'
                      ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/45'
                      : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/45'
                }`}
              >
                <div className="flex items-start gap-3">
                  {state.challenge === 'baseline' ? (
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
                      Observed under {activeChallenge.label.toLowerCase()}
                    </div>
                    <div className="mt-1 text-base font-bold text-zinc-950 dark:text-white">
                      {state.challenge === 'baseline'
                        ? 'The declared envelope is internally testable'
                        : inspected.status === 'constrained'
                          ? 'The scenario crosses this category’s decision boundary'
                          : 'The design survives only with an explicit mitigation'}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {activeChallenge.description}{' '}
                      {state.challenge === 'hotspot'
                        ? 'Test a tenant-aware partition key, write spreading, and per-key capacity alarms.'
                        : state.challenge === 'region-partition'
                          ? 'Choose which side rejects writes, serves stale data, or accepts reconciliation risk.'
                          : state.challenge === 'schema-evolution'
                            ? 'Use compatibility checks, staged backfills, and an explicit rollback window.'
                            : state.challenge === 'analytics-interference'
                              ? 'Capture change events and move scans onto an isolated projection.'
                              : 'Benchmark the hardest query, recovery behavior, and migration path before selecting a product.'}
                    </p>
                  </div>
                </div>
              </div>
            </main>

            <aside className="min-w-0 border-t border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:p-5 2xl:border-l 2xl:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">Candidate ranking</h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Select a category to inspect its evidence.
                  </p>
                </div>
                {inspected.id !== leader.id ? (
                  <button
                    type="button"
                    onClick={() => setInspectedId(null)}
                    className="text-xs font-bold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-cyan-300"
                  >
                    Follow leader
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
                {evaluations.map((candidate, index) => {
                  const selected = candidate.id === inspected.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setInspectedId(candidate.id)}
                      className={`rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        selected
                          ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-cyan-300 dark:bg-cyan-300 dark:text-zinc-950'
                          : 'border-zinc-300 bg-white text-zinc-950 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-500'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {index + 1}. {candidate.category}
                        </span>
                        <span className="text-sm font-bold">{candidate.score}</span>
                      </span>
                      <span
                        className={`mt-2 block h-1.5 overflow-hidden rounded-full ${
                          selected ? 'bg-white/25 dark:bg-zinc-950/20' : 'bg-zinc-200 dark:bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`block h-full rounded-full ${
                            selected ? 'bg-white dark:bg-zinc-950' : 'bg-blue-600 dark:bg-cyan-300'
                          }`}
                          style={{ width: `${candidate.score}%` }}
                        />
                      </span>
                      <span
                        className={`mt-2 block text-xs ${
                          selected
                            ? 'text-blue-100 dark:text-zinc-800'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {statusCopy(candidate.status)} · {candidate.contradictions.length} contradiction
                        {candidate.contradictions.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>

          <div className="grid border-t border-zinc-200 dark:border-zinc-800 md:grid-cols-2">
            <section className="p-4 sm:p-6 md:border-r md:border-zinc-200 md:dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-700 dark:text-amber-300">
                <Workflow className="size-4" aria-hidden="true" />
                Migration risk
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {inspected.migrationRisk}
              </p>
            </section>
            <section className="border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-6 md:border-t-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-700 dark:text-cyan-300">
                <Layers3 className="size-4" aria-hidden="true" />
                Revisit this decision when
              </div>
              <ul className="mt-2 grid gap-2">
                {inspected.decisionTriggers.map((trigger) => (
                  <li
                    key={trigger}
                    className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                  >
                    <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-blue-600 dark:text-cyan-300" aria-hidden="true" />
                    <span>{trigger}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex items-center gap-2">
          <Server className="size-4" aria-hidden="true" />
          Scores compare architecture categories, not vendor editions or contractual guarantees.
        </span>
        <span>Verify capabilities, limits, and failure behavior for the exact product and version.</span>
      </footer>
    </section>
  );
}
