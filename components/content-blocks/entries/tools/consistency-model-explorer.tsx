'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  GitCompareArrows,
  History,
  Network,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldCheck,
  Split,
  TimerReset,
  TriangleAlert,
  Unplug,
  UserRoundCheck,
  UsersRound,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

type ModelId = 'linearizable' | 'causal' | 'read-your-writes' | 'monotonic-reads' | 'eventual';
type ChallengeId = 'healthy' | 'lag' | 'stale-read' | 'partition' | 'concurrent-write' | 'recovery';
type WriteAck = 'local' | 'majority' | 'all';
type ReadRoute = 'nearest' | 'leader' | 'quorum';
type SessionGuarantee = 'none' | 'read-your-writes' | 'monotonic' | 'both';
type ReconcileMode = 'last-write-wins' | 'preserve-both' | 'manual';
type Verdict = 'holds' | 'violated' | 'pending';

interface ModelDefinition {
  id: ModelId;
  name: string;
  shortName: string;
  promise: string;
  permits: string;
  requires: string;
}

interface ChallengeDefinition {
  id: ChallengeId;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Activity;
}

interface ReplicaState {
  id: 'a' | 'b' | 'c';
  label: string;
  location: string;
  role: string;
  value: string;
  state: 'healthy' | 'lagging' | 'isolated' | 'recovering';
  detail: string;
}

interface TraceEvent {
  time: number;
  lane: 'Client A' | 'Replica A' | 'Replica B' | 'Replica C' | 'Client B';
  kind: 'write' | 'replicate' | 'read' | 'fault' | 'repair';
  title: string;
  detail: string;
}

interface GuaranteeResult {
  id: ModelId;
  label: string;
  verdict: Verdict;
  explanation: string;
}

const MODELS: ModelDefinition[] = [
  {
    id: 'linearizable',
    name: 'Linearizability',
    shortName: 'Linearizable',
    promise: 'Every completed operation appears at one instant between its call and response.',
    permits: 'Concurrent writes may be ordered either way, but all later reads must agree with that order.',
    requires: 'A single serialization point, or coordinated reads and writes that behave like one.',
  },
  {
    id: 'causal',
    name: 'Causal consistency',
    shortName: 'Causal',
    promise: 'If operation B depends on operation A, every observer sees A before B.',
    permits: 'Independent concurrent writes may appear in different orders.',
    requires: 'Dependency metadata plus a read path that waits for or routes to required versions.',
  },
  {
    id: 'read-your-writes',
    name: 'Read-your-writes',
    shortName: 'Read your writes',
    promise: 'A client session never loses sight of a write that it already completed.',
    permits: 'Other sessions can still observe older data.',
    requires: 'A session token, sticky routing, or waiting until the selected replica catches up.',
  },
  {
    id: 'monotonic-reads',
    name: 'Monotonic reads',
    shortName: 'Monotonic',
    promise: 'Once a session has observed version V1, later reads never return an older version.',
    permits: 'The first read can be stale, and different sessions can advance at different rates.',
    requires: 'Version-aware session state and routing that never goes backward.',
  },
  {
    id: 'eventual',
    name: 'Eventual consistency',
    shortName: 'Eventual',
    promise: 'When updates stop and communication resumes, replicas converge to one resolved state.',
    permits: 'Stale reads and temporary divergence while replication is incomplete.',
    requires: 'Reliable propagation and a deterministic conflict-resolution policy.',
  },
];

const CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'healthy',
    label: 'Healthy replication',
    shortLabel: 'Healthy',
    description: 'All replicas can communicate; only configured propagation delay applies.',
    icon: CheckCircle2,
  },
  {
    id: 'lag',
    label: 'Replication lag',
    shortLabel: 'Lag',
    description: 'Replica C falls behind while the primary continues accepting writes.',
    icon: Clock3,
  },
  {
    id: 'stale-read',
    label: 'Forced stale read',
    shortLabel: 'Stale read',
    description: 'The reader reaches replica C before the accepted write arrives.',
    icon: History,
  },
  {
    id: 'partition',
    label: 'Network partition',
    shortLabel: 'Partition',
    description: 'Replica C and its local client cannot reach the primary side.',
    icon: WifiOff,
  },
  {
    id: 'concurrent-write',
    label: 'Concurrent writes',
    shortLabel: 'Concurrent',
    description: 'Two clients write different values without a shared ordering point.',
    icon: Split,
  },
  {
    id: 'recovery',
    label: 'Partition recovery',
    shortLabel: 'Recovery',
    description: 'The link returns with V1 on the primary side and V2 on replica C.',
    icon: RefreshCcw,
  },
];

const WRITE_ACKS: Array<{ id: WriteAck; label: string; detail: string }> = [
  { id: 'local', label: 'Local', detail: 'Reply after Replica A stores V1.' },
  { id: 'majority', label: 'Majority', detail: 'Reply after two of three replicas store V1.' },
  { id: 'all', label: 'All', detail: 'Reply only after every replica stores V1.' },
];

const READ_ROUTES: Array<{ id: ReadRoute; label: string; detail: string }> = [
  { id: 'nearest', label: 'Nearest', detail: 'Client A reads its local Replica C.' },
  { id: 'leader', label: 'Leader', detail: 'Route the read to Replica A.' },
  { id: 'quorum', label: 'Quorum', detail: 'Compare a majority and return the newest version.' },
];

const SESSION_OPTIONS: Array<{ id: SessionGuarantee; label: string }> = [
  { id: 'none', label: 'No token' },
  { id: 'read-your-writes', label: 'Read-your-writes' },
  { id: 'monotonic', label: 'Monotonic reads' },
  { id: 'both', label: 'Both guarantees' },
];

const RECONCILE_OPTIONS: Array<{ id: ReconcileMode; label: string; detail: string }> = [
  {
    id: 'last-write-wins',
    label: 'Last write wins',
    detail: 'Converges to V2 by timestamp, but silently discards V1.',
  },
  {
    id: 'preserve-both',
    label: 'Preserve both',
    detail: 'Retains V1 and V2 so domain logic can merge them.',
  },
  {
    id: 'manual',
    label: 'Manual review',
    detail: 'Blocks the record until an operator resolves the conflict.',
  },
];

const EVENT_STYLES: Record<TraceEvent['kind'], string> = {
  write: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100',
  replicate:
    'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-100',
  read: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-100',
  fault: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-100',
  repair:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100',
};

const VERDICT_STYLES: Record<Verdict, string> = {
  holds:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100',
  violated:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100',
  pending:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatMs(value: number) {
  return `${new Intl.NumberFormat('en-US').format(Math.round(value))} ms`;
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={`min-h-10 rounded-md border px-3 py-2 text-left text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                selected
                  ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-300 dark:bg-blue-300 dark:text-neutral-950'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-900'
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
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="font-mono text-sm font-bold text-neutral-950 dark:text-white">{formatMs(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-700 dark:accent-blue-400"
      />
      <span className="mt-1.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</span>
    </label>
  );
}

function Panel({
  title,
  eyebrow,
  icon,
  children,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{eyebrow}</p>
          ) : null}
          <h2 className="mt-0.5 text-lg font-bold text-neutral-950 dark:text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function buildSimulation({
  challenge,
  writeAck,
  readRoute,
  sessionGuarantee,
  replicationLag,
  readDelay,
  reconcileMode,
}: {
  challenge: ChallengeId;
  writeAck: WriteAck;
  readRoute: ReadRoute;
  sessionGuarantee: SessionGuarantee;
  replicationLag: number;
  readDelay: number;
  reconcileMode: ReconcileMode;
}) {
  const partitioned = challenge === 'partition';
  const concurrent = challenge === 'concurrent-write' || challenge === 'recovery';
  const recovering = challenge === 'recovery';
  const effectiveLag =
    challenge === 'lag'
      ? Math.max(replicationLag, 2_400)
      : challenge === 'stale-read'
        ? Math.max(replicationLag, 1_400)
        : replicationLag;
  const writeAt = 100;
  const bVisibleAt = writeAt + Math.max(40, effectiveLag * 0.55);
  const cVisibleAt = writeAt + effectiveLag;
  const readAt =
    challenge === 'stale-read'
      ? Math.min(writeAt + readDelay, cVisibleAt - 80)
      : writeAt + readDelay;

  const writeAccepted =
    writeAck !== 'all' || (!partitioned && challenge !== 'concurrent-write');
  const acknowledgementAt =
    writeAck === 'local'
      ? writeAt + 30
      : writeAck === 'majority'
        ? bVisibleAt
        : writeAccepted
          ? cVisibleAt
          : Number.POSITIVE_INFINITY;

  let cValue = 'V0';
  let cState: ReplicaState['state'] = 'healthy';
  let cDetail = `V1 arrives at ${formatMs(cVisibleAt)}`;

  if (partitioned) {
    cState = 'isolated';
    cDetail = 'Cannot receive V1 from the primary side';
  } else if (recovering) {
    cValue = 'V2';
    cState = 'recovering';
    cDetail = 'Rejoins with concurrent value V2';
  } else if (challenge === 'concurrent-write') {
    cValue = 'V2';
    cDetail = 'Accepted Client B write without a shared order';
  } else if (readAt >= cVisibleAt) {
    cValue = 'V1';
    cDetail = `Applied V1 at ${formatMs(cVisibleAt)}`;
  } else if (challenge === 'lag' || challenge === 'stale-read') {
    cState = 'lagging';
    cDetail = `Still on V0; V1 arrives at ${formatMs(cVisibleAt)}`;
  }

  const bValue = readAt >= bVisibleAt || writeAck !== 'local' ? 'V1' : 'V0';
  const replicas: ReplicaState[] = [
    {
      id: 'a',
      label: 'Replica A',
      location: 'Primary region',
      role: 'Write coordinator',
      value: writeAccepted ? 'V1' : 'V0',
      state: 'healthy',
      detail: writeAccepted ? `Stored V1 at ${formatMs(writeAt)}` : 'Write did not complete',
    },
    {
      id: 'b',
      label: 'Replica B',
      location: 'Primary region',
      role: 'Quorum peer',
      value: writeAccepted ? bValue : 'V0',
      state: writeAccepted && bValue === 'V0' ? 'lagging' : 'healthy',
      detail: writeAccepted ? `V1 visible at ${formatMs(bVisibleAt)}` : 'Remains on V0',
    },
    {
      id: 'c',
      label: 'Replica C',
      location: 'Remote region',
      role: 'Client A local read',
      value: writeAccepted ? cValue : 'V0',
      state: cState,
      detail: writeAccepted ? cDetail : 'Remains on V0',
    },
  ];

  let readValue = 'V0';
  let readBlocked = false;
  let readReason = '';

  if (!writeAccepted) {
    readValue = 'V0';
    readReason = 'The write never acknowledged, so V0 remains the committed value.';
  } else if (partitioned && readRoute !== 'nearest') {
    readValue = 'TIMEOUT';
    readBlocked = true;
    readReason =
      readRoute === 'leader'
        ? 'Replica C cannot reach the leader across the partition.'
        : 'Replica C cannot contact a majority across the partition.';
  } else if (recovering) {
    if (reconcileMode === 'last-write-wins') {
      readValue = 'V2';
      readReason = 'Recovery selects V2 by timestamp and discards V1.';
    } else if (reconcileMode === 'preserve-both') {
      readValue = 'V1 + V2';
      readReason = 'Recovery preserves both concurrent values for a domain merge.';
    } else {
      readValue = 'REVIEW';
      readBlocked = true;
      readReason = 'The record stays blocked until a person resolves V1 versus V2.';
    }
  } else if (readRoute === 'leader') {
    readValue = 'V1';
    readReason = 'The read reaches Replica A, which accepted V1.';
  } else if (readRoute === 'quorum') {
    if (concurrent && writeAck === 'local') {
      readValue = 'V1';
      readReason = 'Replica A and B form a majority, but Replica C still exposes V2 locally.';
    } else {
      readValue = bValue === 'V1' ? 'V1' : 'V0';
      readReason =
        readValue === 'V1'
          ? 'Two replicas report V1, so the quorum returns the newer version.'
          : 'A majority has not observed V1 yet.';
    }
  } else {
    readValue = cValue;
    readReason =
      cValue === 'V0'
        ? 'The nearest replica responds before V1 arrives.'
        : cValue === 'V2'
          ? 'The nearest replica returns its independently accepted write.'
          : 'The nearest replica has already applied V1.';
  }

  const enforcesReadYourWrites =
    sessionGuarantee === 'read-your-writes' || sessionGuarantee === 'both';
  const enforcesMonotonic = sessionGuarantee === 'monotonic' || sessionGuarantee === 'both';
  const wouldRegress = readValue === 'V0' && writeAccepted;

  if (wouldRegress && (enforcesReadYourWrites || enforcesMonotonic)) {
    if (partitioned) {
      readValue = 'WAIT';
      readBlocked = true;
      readReason = 'The session token refuses V0 and waits because no replica with V1 is reachable.';
    } else {
      readValue = 'V1';
      readReason = 'The session token rejects V0 and routes to or waits for a replica with V1.';
    }
  }

  const divergent = concurrent && writeAck === 'local';
  const staleObserved = readValue === 'V0' && writeAccepted;
  const converged = recovering && reconcileMode !== 'manual';
  const safeRefusal = readBlocked || readValue === 'WAIT' || readValue === 'TIMEOUT' || readValue === 'REVIEW';

  const guarantees: GuaranteeResult[] = [
    {
      id: 'linearizable',
      label: 'Linearizability',
      verdict: staleObserved || divergent ? 'violated' : 'holds',
      explanation: staleObserved
        ? `V1 completed at ${formatMs(acknowledgementAt)}, but the later read returned V0.`
        : divergent
          ? 'V1 and V2 were both accepted without one order, so clients can disagree after completion.'
          : safeRefusal
            ? 'The system refuses an unsafe read; consistency holds at the cost of availability.'
            : 'The read agrees with a single order containing the accepted write.',
    },
    {
      id: 'causal',
      label: 'Causal consistency',
      verdict: staleObserved ? 'violated' : recovering && reconcileMode === 'manual' ? 'pending' : 'holds',
      explanation: staleObserved
        ? 'Client A reads before observing its own causal predecessor V1.'
        : recovering && reconcileMode === 'manual'
          ? 'Concurrent values are retained, but their resolved order is not decided yet.'
          : concurrent
            ? 'V1 and V2 are concurrent, so either order is allowed as long as dependencies are preserved.'
            : 'The reader does not observe an effect before its causal write.',
    },
    {
      id: 'read-your-writes',
      label: 'Read-your-writes',
      verdict: staleObserved ? 'violated' : 'holds',
      explanation: staleObserved
        ? 'Client A completed V1 and then observed V0 in the same session.'
        : safeRefusal
          ? 'The session does not regress because the unsafe read waits or fails.'
          : 'Client A sees V1 or a resolved state that includes its write.',
    },
    {
      id: 'monotonic-reads',
      label: 'Monotonic reads',
      verdict: staleObserved ? 'violated' : 'holds',
      explanation: staleObserved
        ? 'After previously seeing V1, Client A goes backward to V0.'
        : safeRefusal
          ? 'The read is withheld rather than returning an older version.'
          : 'The session stays at V1 or advances to a resolved value.',
    },
    {
      id: 'eventual',
      label: 'Eventual consistency',
      verdict: partitioned || challenge === 'concurrent-write' || (recovering && !converged) ? 'pending' : 'holds',
      explanation: partitioned
        ? 'Convergence cannot be judged while Replica C remains disconnected.'
        : challenge === 'concurrent-write'
          ? 'Temporary divergence is permitted, but convergence remains unproven until recovery runs.'
        : recovering && !converged
          ? 'Replica values remain unresolved, so convergence is not complete.'
          : concurrent
            ? 'The recovery policy produces one deterministic resolved state after communication resumes.'
            : `Replica C is scheduled to converge to V1 at ${formatMs(cVisibleAt)}.`,
    },
  ];

  const events: TraceEvent[] = [
    {
      time: 0,
      lane: 'Client A',
      kind: 'read',
      title: 'Previous read',
      detail: 'Client A observed V0.',
    },
    {
      time: writeAt,
      lane: 'Client A',
      kind: 'write',
      title: 'Write V1',
      detail: 'Client A sends V1 to Replica A.',
    },
    {
      time: writeAt + 20,
      lane: 'Replica A',
      kind: 'write',
      title: writeAccepted ? 'Store V1' : 'Write cannot commit',
      detail: writeAccepted ? 'Replica A starts replication.' : 'The selected acknowledgement cannot be satisfied.',
    },
  ];

  if (writeAccepted) {
    events.push({
      time: bVisibleAt,
      lane: 'Replica B',
      kind: 'replicate',
      title: 'Apply V1',
      detail: 'Replica B advances from V0 to V1.',
    });
  }

  if (partitioned) {
    events.push({
      time: writeAt + 40,
      lane: 'Replica C',
      kind: 'fault',
      title: 'Partition isolates C',
      detail: 'Replication and coordinated reads cannot cross the failed link.',
    });
  }

  if (concurrent) {
    events.push({
      time: writeAt + 80,
      lane: 'Client B',
      kind: 'write',
      title: 'Write V2',
      detail: 'Client B updates the same key through Replica C.',
    });
    events.push({
      time: writeAt + 100,
      lane: 'Replica C',
      kind: challenge === 'recovery' ? 'fault' : 'write',
      title: 'Store V2',
      detail: 'Replica C now disagrees with the primary side.',
    });
  } else if (!partitioned) {
    events.push({
      time: cVisibleAt,
      lane: 'Replica C',
      kind: 'replicate',
      title: 'Apply V1',
      detail: 'Replica C catches up to V1.',
    });
  }

  if (recovering) {
    events.push({
      time: Math.max(cVisibleAt, 1_000),
      lane: 'Replica C',
      kind: 'repair',
      title: 'Link restored',
      detail:
        reconcileMode === 'last-write-wins'
          ? 'Resolve to V2 and discard V1.'
          : reconcileMode === 'preserve-both'
            ? 'Retain V1 and V2 for a domain merge.'
            : 'Raise a conflict and block reads.',
    });
  }

  events.push({
    time: Math.max(readAt, writeAt + 50),
    lane: 'Client A',
    kind: readBlocked ? 'fault' : 'read',
    title: `Read returns ${readValue}`,
    detail: readReason,
  });

  events.sort((a, b) => a.time - b.time);

  let consequenceTitle = 'The client sees its update';
  let consequence = `${readValue} is returned without an observable anomaly.`;
  let severity: Verdict = 'holds';

  if (!writeAccepted) {
    consequenceTitle = 'The write is unavailable';
    consequence = 'Client A receives no success response because the selected acknowledgement cannot be reached.';
    severity = 'pending';
  } else if (staleObserved) {
    consequenceTitle =
      challenge === 'partition' ? 'The partition keeps reads available but stale' : 'The UI appears to undo the save';
    consequence =
      challenge === 'partition'
        ? 'The remote region responds with V0 because it cannot reach V1. Client A may retry an update that already succeeded elsewhere.'
        : 'Client A saved V1, refreshed, and saw V0. A user may retry and create duplicate work.';
    severity = 'violated';
  } else if (recovering && reconcileMode === 'manual') {
    consequenceTitle = 'The record awaits conflict review';
    consequence = readReason;
    severity = 'pending';
  } else if (recovering && reconcileMode === 'last-write-wins') {
    consequenceTitle = 'Recovery converges but loses V1';
    consequence = 'Every replica will show V2, yet Client A’s accepted update disappears without a domain merge.';
    severity = 'pending';
  } else if (recovering && reconcileMode === 'preserve-both') {
    consequenceTitle = 'Recovery preserves both intents';
    consequence = 'The application receives both versions and must merge them before presenting one value.';
  } else if (divergent) {
    consequenceTitle = 'Users see conflicting accepted values';
    consequence = 'One region shows V1 while another shows V2 until a reconciliation policy runs.';
    severity = 'violated';
  } else if (readBlocked) {
    consequenceTitle = 'The read is unavailable';
    consequence = readReason;
    severity = 'pending';
  }

  return {
    replicas,
    events,
    guarantees,
    readValue,
    readReason,
    consequenceTitle,
    consequence,
    severity,
    acknowledgementAt,
    readAt,
    cVisibleAt,
    writeAccepted,
  };
}

export default function ConsistencyModelExplorer() {
  const [selectedModel, setSelectedModel] = useState<ModelId>('read-your-writes');
  const [challenge, setChallenge] = useState<ChallengeId>('stale-read');
  const [writeAck, setWriteAck] = useState<WriteAck>('local');
  const [readRoute, setReadRoute] = useState<ReadRoute>('nearest');
  const [sessionGuarantee, setSessionGuarantee] = useState<SessionGuarantee>('none');
  const [replicationLag, setReplicationLag] = useState(1_600);
  const [readDelay, setReadDelay] = useState(400);
  const [reconcileMode, setReconcileMode] = useState<ReconcileMode>('last-write-wins');

  const selectedModelDefinition = MODELS.find((model) => model.id === selectedModel) ?? MODELS[0];
  const selectedChallenge = CHALLENGES.find((item) => item.id === challenge) ?? CHALLENGES[0];
  const simulation = useMemo(
    () =>
      buildSimulation({
        challenge,
        writeAck,
        readRoute,
        sessionGuarantee,
        replicationLag,
        readDelay,
        reconcileMode,
      }),
    [challenge, writeAck, readRoute, sessionGuarantee, replicationLag, readDelay, reconcileMode],
  );
  const selectedGuarantee =
    simulation.guarantees.find((guarantee) => guarantee.id === selectedModel) ?? simulation.guarantees[0];
  const applyRecommendedProtocol = () => {
    if (selectedModel === 'linearizable') {
      setWriteAck('majority');
      setReadRoute('leader');
      setSessionGuarantee('both');
    } else if (selectedModel === 'causal') {
      setWriteAck('local');
      setReadRoute('nearest');
      setSessionGuarantee('read-your-writes');
    } else if (selectedModel === 'read-your-writes') {
      setWriteAck('local');
      setReadRoute('nearest');
      setSessionGuarantee('read-your-writes');
    } else if (selectedModel === 'monotonic-reads') {
      setWriteAck('local');
      setReadRoute('nearest');
      setSessionGuarantee('monotonic');
    } else {
      setWriteAck('local');
      setReadRoute('nearest');
      setSessionGuarantee('none');
    }
  };

  const reset = () => {
    setSelectedModel('read-your-writes');
    setChallenge('stale-read');
    setWriteAck('local');
    setReadRoute('nearest');
    setSessionGuarantee('none');
    setReplicationLag(1_600);
    setReadDelay(400);
    setReconcileMode('last-write-wins');
  };

  return (
    <div
      data-content-block="tools/consistency-model-explorer"
      aria-labelledby="consistency-explorer-title"
      className="not-prose my-8 w-full min-w-0 overflow-hidden border border-neutral-200 bg-neutral-100 text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
    >
      <header className="border-b border-neutral-800 bg-neutral-950 px-4 py-5 text-white sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-cyan-300">
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              Replicated history workbench
            </div>
            <h2 id="consistency-explorer-title" className="text-2xl font-bold sm:text-3xl">
              Make the guarantee prove itself
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300 sm:text-base">
              Promise a consistency model, configure the read and write protocol, then inject a history that
              can confirm or disprove the claim.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-white outline-none transition hover:border-neutral-500 hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset history
          </button>
        </div>
      </header>

      <div className="grid min-w-0 gap-px bg-neutral-200 dark:bg-neutral-800 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.5fr)]">
        <aside aria-label="Consistency controls" className="min-w-0 space-y-px bg-neutral-200 dark:bg-neutral-800">
          <Panel title="Promise a contract" eyebrow="1. Model" icon={<ShieldCheck className="h-5 w-5" />}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {MODELS.map((model) => {
                const selected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedModel(model.id)}
                    className={`min-h-[4.75rem] rounded-md border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                      selected
                        ? 'border-blue-700 bg-blue-700 text-white shadow-sm dark:border-blue-300 dark:bg-blue-300 dark:text-neutral-950'
                        : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-900'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-bold">
                      {model.shortName}
                      {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    </span>
                    <span
                      className={`mt-1 block text-xs leading-5 ${
                        selected ? 'text-blue-100 dark:text-neutral-700' : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {model.promise}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 border-l-4 border-cyan-500 bg-cyan-50 p-3 text-sm text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950/50 dark:text-cyan-100">
              <p className="font-bold">{selectedModelDefinition.name}</p>
              <p className="mt-1 leading-5">{selectedModelDefinition.permits}</p>
              <p className="mt-2 text-xs leading-5 text-cyan-800 dark:text-cyan-200">
                Needs: {selectedModelDefinition.requires}
              </p>
              <button
                type="button"
                onClick={applyRecommendedProtocol}
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-cyan-700 bg-white px-3 text-xs font-bold text-cyan-900 outline-none hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950 dark:text-cyan-100 dark:hover:bg-cyan-900"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Apply a compatible protocol
              </button>
            </div>
          </Panel>

          <Panel title="Configure the protocol" eyebrow="2. Controls" icon={<Server className="h-5 w-5" />}>
            <div className="space-y-5">
              <SegmentedControl
                label="Write acknowledgement"
                value={writeAck}
                options={WRITE_ACKS}
                onChange={setWriteAck}
              />
              <p className="-mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {WRITE_ACKS.find((item) => item.id === writeAck)?.detail}
              </p>

              <SegmentedControl
                label="Read route from remote region"
                value={readRoute}
                options={READ_ROUTES}
                onChange={setReadRoute}
              />
              <p className="-mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {READ_ROUTES.find((item) => item.id === readRoute)?.detail}
              </p>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  Session protection
                </span>
                <select
                  value={sessionGuarantee}
                  onChange={(event) => setSessionGuarantee(event.target.value as SessionGuarantee)}
                  className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:focus:border-blue-400"
                >
                  {SESSION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <RangeControl
                label="Replication lag to C"
                value={replicationLag}
                min={0}
                max={4_000}
                step={100}
                onChange={(value) => setReplicationLag(clamp(value, 0, 4_000))}
                hint="When Replica C can apply V1 after the coordinator accepts it."
              />
              <RangeControl
                label="Read after write"
                value={readDelay}
                min={50}
                max={4_500}
                step={50}
                onChange={(value) => setReadDelay(clamp(value, 50, 4_500))}
                hint="How long Client A waits before reading from the remote region."
              />
            </div>
          </Panel>
        </aside>

        <div className="min-w-0 space-y-px bg-neutral-200 dark:bg-neutral-800">
          <Panel title="Challenge the healthy path" eyebrow="3. Failure injection" icon={<Unplug className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {CHALLENGES.map((item) => {
                const Icon = item.icon;
                const selected = challenge === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setChallenge(item.id)}
                    className={`min-h-[5.25rem] rounded-md border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                      selected
                        ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.shortLabel}
                    </span>
                    <span
                      className={`mt-1.5 block text-xs leading-5 ${
                        selected ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {challenge === 'recovery' ? (
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <SegmentedControl
                  label="Recovery conflict policy"
                  value={reconcileMode}
                  options={RECONCILE_OPTIONS}
                  onChange={setReconcileMode}
                />
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {RECONCILE_OPTIONS.find((item) => item.id === reconcileMode)?.detail}
                </p>
              </div>
            ) : null}
          </Panel>

          <section
            aria-live="polite"
            className={`min-w-0 border p-4 sm:p-5 ${VERDICT_STYLES[simulation.severity]}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase">
                  {simulation.severity === 'violated' ? (
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  ) : simulation.severity === 'pending' ? (
                    <TimerReset className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  User-visible outcome
                </p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">{simulation.consequenceTitle}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6">{simulation.consequence}</p>
              </div>
              <div className="shrink-0 border border-current/20 bg-white/60 px-4 py-3 text-left dark:bg-neutral-950/40 sm:min-w-40">
                <p className="text-xs font-semibold uppercase opacity-70">Observed read</p>
                <p className="mt-1 font-mono text-2xl font-black">{simulation.readValue}</p>
              </div>
            </div>
          </section>

          <Panel title="Replica state at read time" eyebrow="Observed system" icon={<Network className="h-5 w-5" />}>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] md:items-stretch">
              {simulation.replicas.map((replica, index) => {
                const stateStyle =
                  replica.state === 'isolated'
                    ? 'border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50'
                    : replica.state === 'lagging'
                      ? 'border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50'
                      : replica.state === 'recovering'
                        ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/50'
                        : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40';
                return (
                  <div key={replica.id} className="contents">
                    <article className={`min-w-0 border p-4 ${stateStyle}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                            {replica.location}
                          </p>
                          <h3 className="mt-1 font-bold text-neutral-950 dark:text-white">{replica.label}</h3>
                        </div>
                        <span className="font-mono text-xl font-black text-neutral-950 dark:text-white">
                          {replica.value}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200">{replica.role}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{replica.detail}</p>
                    </article>
                    {index < simulation.replicas.length - 1 ? (
                      <div className="flex h-8 items-center justify-center text-neutral-400 dark:text-neutral-600 md:h-auto">
                        {challenge === 'partition' && index === 1 ? (
                          <WifiOff className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-label="Partitioned link" />
                        ) : (
                          <>
                            <span className="h-px w-full bg-current" aria-hidden="true" />
                            <ArrowRight className="-ml-1 h-4 w-4 shrink-0" aria-hidden="true" />
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Write reply</p>
                <p className="mt-1 font-mono text-sm font-bold text-neutral-950 dark:text-white">
                  {simulation.writeAccepted ? formatMs(simulation.acknowledgementAt) : 'No acknowledgement'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Read begins</p>
                <p className="mt-1 font-mono text-sm font-bold text-neutral-950 dark:text-white">
                  {formatMs(simulation.readAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Replica C catches up
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-neutral-950 dark:text-white">
                  {challenge === 'partition' ? 'After repair' : formatMs(simulation.cVisibleAt)}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Trace the observed history" eyebrow="Operation timeline" icon={<History className="h-5 w-5" />}>
            <div className="relative min-w-0">
              <div className="absolute bottom-3 left-[4.6rem] top-3 w-px bg-neutral-300 dark:bg-neutral-700 sm:left-[6.3rem]" />
              <ol className="space-y-3">
                {simulation.events.map((event, index) => (
                  <li key={`${event.time}-${event.lane}-${index}`} className="relative grid grid-cols-[4rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5.7rem_minmax(0,1fr)]">
                    <div className="pt-2 text-right">
                      <p className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-200">
                        {formatMs(event.time)}
                      </p>
                      <p className="mt-0.5 text-[0.68rem] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        {event.lane}
                      </p>
                    </div>
                    <div className={`relative min-w-0 border p-3 ${EVENT_STYLES[event.kind]}`}>
                      <span
                        className="absolute -left-[0.57rem] top-3.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-current dark:border-neutral-950"
                        aria-hidden="true"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-neutral-950" />
                      </span>
                      <p className="text-sm font-bold">{event.title}</p>
                      <p className="mt-0.5 text-xs leading-5 opacity-80">{event.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel title="Test each guarantee against this history" eyebrow="Contract verdicts" icon={<CircleDot className="h-5 w-5" />}>
            <div className={`mb-4 border p-4 ${VERDICT_STYLES[selectedGuarantee.verdict]}`} aria-live="polite">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase">Promised contract</p>
                  <h3 className="mt-1 text-lg font-bold">{selectedGuarantee.label}</h3>
                </div>
                <span className="self-start border border-current/25 bg-white/60 px-2.5 py-1 text-xs font-bold uppercase dark:bg-neutral-950/40">
                  {selectedGuarantee.verdict === 'holds'
                    ? 'History satisfies it'
                    : selectedGuarantee.verdict === 'violated'
                      ? 'History disproves it'
                      : 'Not yet decidable'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6">{selectedGuarantee.explanation}</p>
            </div>

            <div className="grid gap-2 lg:grid-cols-2">
              {simulation.guarantees.map((guarantee) => (
                <button
                  key={guarantee.id}
                  type="button"
                  onClick={() => setSelectedModel(guarantee.id)}
                  aria-pressed={selectedModel === guarantee.id}
                  className={`min-w-0 border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    selectedModel === guarantee.id
                      ? 'border-blue-700 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50'
                      : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-neutral-950 dark:text-white">{guarantee.label}</span>
                    <span
                      className={`shrink-0 px-2 py-1 text-[0.68rem] font-bold uppercase ${
                        guarantee.verdict === 'holds'
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                          : guarantee.verdict === 'violated'
                            ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                      }`}
                    >
                      {guarantee.verdict}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    {guarantee.explanation}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="What changed and why" eyebrow={selectedChallenge.label} icon={<UsersRound className="h-5 w-5" />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
                  <UserRoundCheck className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  Client observation
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {simulation.readReason}
                </p>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-950 dark:text-white">
                  <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                  Design consequence
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  A consistency label is only valid if every allowed history satisfies its promise. Change the
                  route, acknowledgement, timing, or session token and compare the same fault again.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
