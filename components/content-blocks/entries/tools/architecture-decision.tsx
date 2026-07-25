'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  Database,
  ExternalLink,
  Gauge,
  Globe2,
  Layers3,
  Network,
  RefreshCcw,
  Server,
  ShieldCheck,
  Siren,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type Consistency = 'strong' | 'bounded' | 'eventual';
type SchemaShape = 'relational' | 'document' | 'key-value';
type TeamCapacity = 'lean' | 'platform';
type CandidateId = 'relational' | 'distributed-kv' | 'document';
type ChallengeId = 'baseline' | 'traffic-spike' | 'region-loss' | 'hot-partition' | 'replication-lag';

type Context = {
  dau: number;
  peakRps: number;
  readRatio: number;
  latencyTargetMs: number;
  consistency: Consistency;
  schemaShape: SchemaShape;
  globalUsers: boolean;
  teamCapacity: TeamCapacity;
};

type Candidate = {
  id: CandidateId;
  name: string;
  shortName: string;
  capacityRps: number;
  baseLatencyMs: number;
  accent: string;
  description: string;
  strengths: string[];
  watch: string;
};

type Challenge = {
  id: ChallengeId;
  label: string;
  description: string;
  target: 'none' | 'edge' | 'service' | 'data' | 'replication';
};

type ActionStatus = {
  tone: 'success' | 'error';
  message: string;
} | null;

const DEFAULT_CONTEXT: Context = {
  dau: 1_000_000,
  peakRps: 5_000,
  readRatio: 0.9,
  latencyTargetMs: 150,
  consistency: 'bounded',
  schemaShape: 'relational',
  globalUsers: true,
  teamCapacity: 'lean',
};

const CANDIDATES: Candidate[] = [
  {
    id: 'relational',
    name: 'Transactional relational core',
    shortName: 'Relational core',
    capacityRps: 14_000,
    baseLatencyMs: 42,
    accent: 'bg-blue-600',
    description: 'One authoritative SQL write path with replicas and a cache at the read edge.',
    strengths: ['Strong invariants', 'Flexible queries', 'Familiar operations'],
    watch: 'Shard deliberately before one writer becomes the permanent bottleneck.',
  },
  {
    id: 'distributed-kv',
    name: 'Partitioned key-value write path',
    shortName: 'Partitioned KV',
    capacityRps: 85_000,
    baseLatencyMs: 24,
    accent: 'bg-emerald-600',
    description: 'Partition-first storage with bounded access patterns and tunable consistency.',
    strengths: ['Horizontal throughput', 'Regional resilience', 'Predictable key lookups'],
    watch: 'Query flexibility and cross-key transactions move into application design.',
  },
  {
    id: 'document',
    name: 'Document-centric service',
    shortName: 'Document service',
    capacityRps: 30_000,
    baseLatencyMs: 34,
    accent: 'bg-violet-600',
    description: 'Aggregate-shaped documents with targeted indexes and asynchronous projections.',
    strengths: ['Schema evolution', 'Aggregate locality', 'Fast product iteration'],
    watch: 'Unbounded documents and ad hoc indexes create hidden write and memory costs.',
  },
];

const CHALLENGES: Challenge[] = [
  {
    id: 'baseline',
    label: 'Normal operation',
    description: 'Measure the design against the stated peak without an injected failure.',
    target: 'none',
  },
  {
    id: 'traffic-spike',
    label: 'Traffic spike',
    description: 'A launch or incident sends more requests through every synchronous dependency.',
    target: 'service',
  },
  {
    id: 'region-loss',
    label: 'Region loss',
    description: 'A full region stops serving and surviving capacity must absorb its traffic.',
    target: 'edge',
  },
  {
    id: 'hot-partition',
    label: 'Hot partition',
    description: 'A celebrity, tenant, or campaign concentrates load on one ownership boundary.',
    target: 'data',
  },
  {
    id: 'replication-lag',
    label: 'Replication lag',
    description: 'Replicas fall behind while reads continue from multiple regions.',
    target: 'replication',
  },
];

const PRESETS: Array<{ id: string; label: string; detail: string; context: Context }> = [
  {
    id: 'consumer',
    label: 'Consumer feed',
    detail: 'Read-heavy, global, latency-sensitive',
    context: {
      dau: 12_000_000,
      peakRps: 28_000,
      readRatio: 0.94,
      latencyTargetMs: 100,
      consistency: 'eventual',
      schemaShape: 'document',
      globalUsers: true,
      teamCapacity: 'platform',
    },
  },
  {
    id: 'payments',
    label: 'Payment ledger',
    detail: 'Transactional, correctness-first',
    context: {
      dau: 2_000_000,
      peakRps: 8_000,
      readRatio: 0.62,
      latencyTargetMs: 180,
      consistency: 'strong',
      schemaShape: 'relational',
      globalUsers: true,
      teamCapacity: 'platform',
    },
  },
  {
    id: 'ingestion',
    label: 'Event ingestion',
    detail: 'Write-heavy, partitionable stream',
    context: {
      dau: 25_000_000,
      peakRps: 55_000,
      readRatio: 0.28,
      latencyTargetMs: 220,
      consistency: 'bounded',
      schemaShape: 'key-value',
      globalUsers: true,
      teamCapacity: 'platform',
    },
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatCompact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function scoreCandidate(candidate: Candidate, context: Context) {
  let score = 50;
  const reasons: string[] = [];

  if (candidate.id === 'relational') {
    if (context.consistency === 'strong') {
      score += 22;
      reasons.push('matches strong transaction boundaries');
    }
    if (context.schemaShape === 'relational') {
      score += 18;
      reasons.push('fits relational data and joins');
    }
    if (context.teamCapacity === 'lean') {
      score += 8;
      reasons.push('keeps the operating model familiar');
    }
    if (context.peakRps > 20_000) score -= 14;
    if (context.globalUsers && context.latencyTargetMs < 100) score -= 12;
  }

  if (candidate.id === 'distributed-kv') {
    if (context.schemaShape === 'key-value') {
      score += 22;
      reasons.push('matches bounded key access');
    }
    if (context.peakRps > 15_000) {
      score += 18;
      reasons.push('absorbs high partitionable throughput');
    }
    if (context.readRatio < 0.6) {
      score += 12;
      reasons.push('supports sustained writes');
    }
    if (context.globalUsers) score += 8;
    if (context.consistency === 'strong') score -= 20;
    if (context.teamCapacity === 'lean') score -= 14;
  }

  if (candidate.id === 'document') {
    if (context.schemaShape === 'document') {
      score += 24;
      reasons.push('keeps aggregate data together');
    }
    if (context.consistency !== 'strong') score += 8;
    if (context.teamCapacity === 'lean') {
      score += 6;
      reasons.push('supports fast schema iteration');
    }
    if (context.consistency === 'strong') score -= 12;
    if (context.peakRps > 45_000) score -= 10;
  }

  if (reasons.length === 0) reasons.push('is viable, but not directly favored by the current constraints');

  return {
    ...candidate,
    score: clamp(score, 18, 96),
    reasons,
  };
}

function Slider({
  id,
  label,
  value,
  setValue,
  min,
  max,
  step = 1,
  format,
}: {
  id: string;
  label: string;
  value: number;
  setValue: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
}) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-300">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        style={{ backgroundSize: `${progress}% 100%` }}
        className="h-2 w-full cursor-pointer appearance-none rounded bg-[linear-gradient(to_right,rgb(37_99_235),rgb(37_99_235))] bg-no-repeat accent-blue-600 dark:bg-[linear-gradient(to_right,rgb(96_165_250),rgb(96_165_250))] dark:accent-blue-400"
      />
      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400" aria-hidden="true">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-neutral-100 p-1 dark:bg-neutral-800">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-9 rounded px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
                selected
                  ? 'bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:hover:text-white'
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

function Toggle({
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
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-neutral-200 px-3 py-2.5 dark:border-neutral-700">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">{detail}</span>
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-neutral-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:bg-neutral-700 dark:peer-checked:bg-blue-500 dark:peer-focus-visible:ring-offset-neutral-900" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const tones = {
    neutral: 'text-neutral-950 dark:text-white',
    good: 'text-emerald-700 dark:text-emerald-300',
    warn: 'text-amber-700 dark:text-amber-300',
    bad: 'text-rose-700 dark:text-rose-300',
  };

  return (
    <div className="min-w-0 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
      <div className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{detail}</div>
    </div>
  );
}

function FlowNode({
  icon,
  label,
  detail,
  active,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex min-h-24 min-w-0 flex-col justify-between rounded-md border p-3 transition-colors ${
        active
          ? 'border-rose-400 bg-rose-50 text-rose-950 ring-2 ring-rose-200 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-900'
          : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
      }`}
    >
      <div className={active ? 'text-rose-600 dark:text-rose-300' : 'text-blue-600 dark:text-blue-300'}>{icon}</div>
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className={`mt-0.5 text-xs ${active ? 'text-rose-700 dark:text-rose-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function parseNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && options.includes(value as T);
}

async function writeToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the browser-compatible copy path.
    }
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  activeElement?.focus({ preventScroll: true });

  if (!copied) throw new Error('The browser blocked clipboard access.');
}

export default function ArchitectureDecisionTool() {
  const router = useRouter();
  const [context, setContext] = useState<Context>(DEFAULT_CONTEXT);
  const [candidateId, setCandidateId] = useState<CandidateId>('relational');
  const [challengeId, setChallengeId] = useState<ChallengeId>('baseline');
  const [challengeSeverity, setChallengeSeverity] = useState(2);
  const [actionStatus, setActionStatus] = useState<ActionStatus>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('rps') && !params.has('candidate')) return;

    const consistency = params.get('consistency');
    const schemaShape = params.get('schema');
    const teamCapacity = params.get('team');
    const candidate = params.get('candidate');
    const challenge = params.get('challenge');

    setContext({
      dau: parseNumber(params.get('dau'), DEFAULT_CONTEXT.dau, 10_000, 100_000_000),
      peakRps: parseNumber(params.get('rps'), DEFAULT_CONTEXT.peakRps, 100, 100_000),
      readRatio: parseNumber(params.get('reads'), DEFAULT_CONTEXT.readRatio, 0.2, 0.99),
      latencyTargetMs: parseNumber(params.get('latency'), DEFAULT_CONTEXT.latencyTargetMs, 50, 500),
      consistency: isOneOf(consistency, ['strong', 'bounded', 'eventual'] as const)
        ? consistency
        : DEFAULT_CONTEXT.consistency,
      schemaShape: isOneOf(schemaShape, ['relational', 'document', 'key-value'] as const)
        ? schemaShape
        : DEFAULT_CONTEXT.schemaShape,
      globalUsers: params.get('global') === '1',
      teamCapacity: isOneOf(teamCapacity, ['lean', 'platform'] as const)
        ? teamCapacity
        : DEFAULT_CONTEXT.teamCapacity,
    });

    if (isOneOf(candidate, ['relational', 'distributed-kv', 'document'] as const)) setCandidateId(candidate);
    if (isOneOf(challenge, ['baseline', 'traffic-spike', 'region-loss', 'hot-partition', 'replication-lag'] as const)) {
      setChallengeId(challenge);
    }
    setChallengeSeverity(parseNumber(params.get('severity'), 2, 1, 3));
    setActionStatus({ tone: 'success', message: 'Shared decision loaded from this link.' });
  }, []);

  const setContextValue = <K extends keyof Context>(key: K, value: Context[K]) => {
    setContext((previous) => ({ ...previous, [key]: value }));
  };

  const rankedCandidates = useMemo(
    () => CANDIDATES.map((candidate) => scoreCandidate(candidate, context)).sort((a, b) => b.score - a.score),
    [context],
  );
  const recommended = rankedCandidates[0];
  const selected = rankedCandidates.find((candidate) => candidate.id === candidateId) ?? recommended;
  const challenge = CHALLENGES.find((item) => item.id === challengeId) ?? CHALLENGES[0];

  const simulation = useMemo(() => {
    const severity = challengeSeverity;
    const loadMultiplier =
      challengeId === 'traffic-spike'
        ? [1, 1.8, 2.8, 4.2][severity]
        : challengeId === 'region-loss'
          ? [1, 1.35, 1.65, 2][severity]
          : challengeId === 'hot-partition'
            ? [1, 1.2, 1.35, 1.55][severity]
            : challengeId === 'replication-lag'
              ? [1, 1.08, 1.15, 1.25][severity]
              : 1;
    const effectiveRps = Math.round(context.peakRps * loadMultiplier);
    const saturation = effectiveRps / selected.capacityRps;
    const topologyPenalty = context.globalUsers && context.consistency === 'strong' ? 42 : 0;
    const challengePenalty =
      challengeId === 'traffic-spike'
        ? severity * 24
        : challengeId === 'region-loss'
          ? severity * 38
          : challengeId === 'hot-partition'
            ? severity * 55
            : challengeId === 'replication-lag'
              ? severity * 18
              : 0;
    const projectedP95 = Math.round(
      selected.baseLatencyMs * Math.max(1, saturation * 1.4) + topologyPenalty + challengePenalty,
    );
    const headroom = selected.capacityRps / Math.max(effectiveRps, 1);
    const staleReadRisk =
      challengeId === 'replication-lag'
        ? context.consistency === 'strong'
          ? 'Writes may block'
          : context.consistency === 'bounded'
            ? `${severity * 3}-${severity * 8}s stale`
            : `${severity * 10}-${severity * 30}s stale`
        : context.consistency === 'eventual'
          ? 'Accepted'
          : 'Low';
    const availability =
      challengeId === 'region-loss'
        ? context.globalUsers
          ? 99.5 - severity * 0.12
          : 96.5 - severity * 0.8
        : challengeId === 'hot-partition'
          ? 99.9 - severity * 0.1
          : saturation > 1
            ? Math.max(95, 99.9 - (saturation - 1) * 4)
            : 99.95;

    return {
      effectiveRps,
      saturation,
      projectedP95,
      headroom,
      staleReadRisk,
      availability,
    };
  }, [challengeId, challengeSeverity, context, selected]);

  const contradictions = useMemo(() => {
    const issues: string[] = [];
    if (context.globalUsers && context.consistency === 'strong' && context.latencyTargetMs <= 100) {
      issues.push('Global strong consistency and a sub-100 ms p95 cannot both be guaranteed across long network distances.');
    }
    if (simulation.saturation > 1) {
      issues.push(`The stressed load is ${Math.round(simulation.saturation * 100)}% of the selected path's planning capacity.`);
    }
    if (challengeId === 'region-loss' && !context.globalUsers) {
      issues.push('The design has no second serving region, so a region loss becomes a full service outage.');
    }
    if (candidateId === 'distributed-kv' && context.teamCapacity === 'lean') {
      issues.push('The selected partitioned store exceeds the stated operating capacity of a lean team.');
    }
    if (candidateId === 'relational' && context.schemaShape === 'key-value' && context.peakRps > 20_000) {
      issues.push('A single relational ownership boundary conflicts with the high-volume partitionable access pattern.');
    }
    if (simulation.projectedP95 > context.latencyTargetMs) {
      issues.push(`Projected p95 misses the target by ${simulation.projectedP95 - context.latencyTargetMs} ms.`);
    }
    return issues;
  }, [candidateId, challengeId, context, simulation]);

  const decisionTone =
    contradictions.length >= 2 || simulation.saturation > 1
      ? 'bad'
      : challengeId !== 'baseline' || selected.score < recommended.score - 12
        ? 'warn'
        : 'good';
  const decisionLabel =
    decisionTone === 'bad' ? 'Contradictory or overloaded' : decisionTone === 'warn' ? 'Trade-offs need review' : 'Defensible starting point';

  const mitigations = useMemo(() => {
    const items: string[] = [];
    if (simulation.saturation > 0.7) items.push('Add capacity before launch and load-test the exact ownership key distribution.');
    if (challengeId === 'region-loss') {
      items.push(context.globalUsers ? 'Reserve warm failover capacity and rehearse traffic evacuation.' : 'Add a recovery region or state the outage risk explicitly.');
    }
    if (challengeId === 'hot-partition') items.push('Detect hot owners, split their keyspace, and bound per-owner work.');
    if (challengeId === 'replication-lag') items.push('Route read-your-writes traffic to the leader and alert on replica age.');
    if (context.globalUsers && context.consistency === 'strong') items.push('Choose the exact operations that require a global commit; keep the rest regional.');
    if (context.teamCapacity === 'lean') items.push('Prefer managed infrastructure and one clear operational ownership boundary.');
    if (items.length === 0) items.push('Validate the recommendation with representative load, failure drills, and an exit plan.');
    return items.slice(0, 3);
  }, [challengeId, context, simulation.saturation]);

  const architectureComponents = useMemo(() => {
    const components = ['user', 'api', 'balancer', 'server'];
    if (context.readRatio > 0.7 || context.latencyTargetMs <= 120) components.push('cache');
    components.push('database');
    if (context.peakRps > 7_000 || context.readRatio < 0.55) components.push('queue');
    if (context.globalUsers) components.push('cdn');
    components.push('monitor');
    return components;
  }, [context]);

  const decisionRecord = useMemo(
    () => `# Architecture Decision Record

Status: Proposed

## Context
- ${formatCompact(context.dau)} daily active users and ${context.peakRps.toLocaleString()} peak requests/second
- ${Math.round(context.readRatio * 100)}% reads with a ${context.latencyTargetMs} ms p95 target
- ${context.consistency} consistency, ${context.schemaShape} data, ${context.globalUsers ? 'global' : 'single-region'} users
- ${context.teamCapacity === 'lean' ? 'Lean application team' : 'Dedicated platform team'}

## Decision
Evaluate ${selected.name}. It scores ${selected.score}/100 for the stated constraints.

## Why
${selected.reasons.map((reason) => `- ${reason}`).join('\n')}

## Accepted consequences
- ${selected.watch}
- Planning capacity: ${selected.capacityRps.toLocaleString()} requests/second
- Current challenge: ${challenge.label} at severity ${challengeSeverity}
- Projected p95: ${simulation.projectedP95} ms; availability: ${simulation.availability.toFixed(2)}%

## Required mitigations
${mitigations.map((item) => `- ${item}`).join('\n')}

## Unresolved contradictions
${contradictions.length ? contradictions.map((item) => `- ${item}`).join('\n') : '- None exposed by this model. Validate assumptions in production-like tests.'}
`,
    [challenge.label, challengeSeverity, context, contradictions, mitigations, selected, simulation],
  );

  const buildShareUrl = () => {
    const url = new URL('/tools/architecture-decision', window.location.origin);
    url.searchParams.set('dau', String(context.dau));
    url.searchParams.set('rps', String(context.peakRps));
    url.searchParams.set('reads', String(context.readRatio));
    url.searchParams.set('latency', String(context.latencyTargetMs));
    url.searchParams.set('consistency', context.consistency);
    url.searchParams.set('schema', context.schemaShape);
    url.searchParams.set('global', context.globalUsers ? '1' : '0');
    url.searchParams.set('team', context.teamCapacity);
    url.searchParams.set('candidate', candidateId);
    url.searchParams.set('challenge', challengeId);
    url.searchParams.set('severity', String(challengeSeverity));
    return url.toString();
  };

  const copyShareLink = async () => {
    try {
      await writeToClipboard(buildShareUrl());
      setActionStatus({ tone: 'success', message: 'Decision link copied. It preserves inputs, candidate, and challenge.' });
    } catch (error) {
      setActionStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not copy the decision link.',
      });
    }
  };

  const copyDecisionRecord = async () => {
    try {
      await writeToClipboard(decisionRecord);
      setActionStatus({ tone: 'success', message: 'Architecture decision record copied as Markdown.' });
    } catch (error) {
      setActionStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not copy the decision record.',
      });
    }
  };

  const openInWhiteboard = () => {
    try {
      localStorage.setItem(
        'architecture-guide-components',
        JSON.stringify({
          components: architectureComponents,
          note: `${selected.name}: ${formatCompact(context.dau)} DAU, ${context.peakRps.toLocaleString()} peak RPS`,
          metadata: {
            source: 'architecture-decision',
            candidate: candidateId,
            challenge: challengeId,
          },
        }),
      );
      setActionStatus({ tone: 'success', message: 'Architecture prepared for the whiteboard.' });
      router.push('/whiteboard');
    } catch (error) {
      setActionStatus({
        tone: 'error',
        message: error instanceof Error ? `Whiteboard export failed: ${error.message}` : 'Whiteboard export failed.',
      });
    }
  };

  const reset = () => {
    setContext(DEFAULT_CONTEXT);
    setCandidateId('relational');
    setChallengeId('baseline');
    setChallengeSeverity(2);
    setActionStatus({ tone: 'success', message: 'Workbench reset to the default decision.' });
  };

  return (
    <section
      data-content-block="tools/architecture-decision"
      aria-labelledby="architecture-decision-title"
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
    >
      <header className="border-b border-neutral-200 bg-neutral-950 px-4 py-5 text-white dark:border-neutral-800 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-blue-300">
              <Network className="h-4 w-4" aria-hidden="true" />
              Architecture decision workbench
            </div>
            <h2 id="architecture-decision-title" className="mt-2 text-2xl font-bold sm:text-3xl">
              Turn constraints into a defensible decision
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
              Compare viable data paths, choose a candidate, then inject a failure to expose its accepted consequences.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy link
            </button>
            <button
              type="button"
              onClick={copyDecisionRecord}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Copy ADR
            </button>
          </div>
        </div>

        {actionStatus ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              actionStatus.tone === 'success'
                ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
                : 'border-rose-700 bg-rose-950 text-rose-100'
            }`}
          >
            {actionStatus.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {actionStatus.message}
          </div>
        ) : null}
      </header>

      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Decision state" value={decisionLabel} detail={`${contradictions.length} exposed conflict${contradictions.length === 1 ? '' : 's'}`} tone={decisionTone} />
          <Metric label="Best fit" value={`${recommended.score}/100`} detail={recommended.shortName} tone="good" />
          <Metric
            label="Stressed load"
            value={`${formatCompact(simulation.effectiveRps)} RPS`}
            detail={`${simulation.headroom.toFixed(1)}x capacity headroom`}
            tone={simulation.headroom < 1 ? 'bad' : simulation.headroom < 1.5 ? 'warn' : 'neutral'}
          />
          <Metric
            label="Projected p95"
            value={`${simulation.projectedP95} ms`}
            detail={`${context.latencyTargetMs} ms target`}
            tone={simulation.projectedP95 > context.latencyTargetMs ? 'bad' : 'good'}
          />
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <aside className="min-w-0 border-b border-neutral-200 p-4 dark:border-neutral-800 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">1. Frame the context</div>
              <h3 className="mt-1 text-lg font-bold">State constraints before solutions</h3>
            </div>
            <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {PRESETS.map((preset) => {
              const active =
                context.dau === preset.context.dau &&
                context.peakRps === preset.context.peakRps &&
                context.schemaShape === preset.context.schemaShape;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setContext(preset.context);
                    setActionStatus(null);
                  }}
                  className={`min-h-16 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-neutral-950'
                      : 'border-neutral-200 bg-white hover:border-blue-300 hover:bg-blue-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-blue-700 dark:hover:bg-blue-950/40'
                  }`}
                >
                  <span className="block text-sm font-bold">{preset.label}</span>
                  <span className={`mt-0.5 block text-xs ${active ? 'text-blue-100 dark:text-blue-950' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {preset.detail}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-6">
            <Slider
              id="decision-dau"
              label="Daily active users"
              value={context.dau}
              setValue={(value) => setContextValue('dau', value)}
              min={10_000}
              max={100_000_000}
              step={10_000}
              format={formatCompact}
            />
            <Slider
              id="decision-rps"
              label="Peak requests per second"
              value={context.peakRps}
              setValue={(value) => setContextValue('peakRps', value)}
              min={100}
              max={100_000}
              step={100}
              format={(value) => formatCompact(value)}
            />
            <Slider
              id="decision-reads"
              label="Read share"
              value={context.readRatio}
              setValue={(value) => setContextValue('readRatio', value)}
              min={0.2}
              max={0.99}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <Slider
              id="decision-latency"
              label="p95 latency target"
              value={context.latencyTargetMs}
              setValue={(value) => setContextValue('latencyTargetMs', value)}
              min={50}
              max={500}
              step={5}
              format={(value) => `${value} ms`}
            />

            <ChoiceGroup
              label="Consistency contract"
              value={context.consistency}
              options={[
                { value: 'strong', label: 'Strong' },
                { value: 'bounded', label: 'Bounded' },
                { value: 'eventual', label: 'Eventual' },
              ]}
              onChange={(value) => setContextValue('consistency', value)}
            />
            <ChoiceGroup
              label="Primary data shape"
              value={context.schemaShape}
              options={[
                { value: 'relational', label: 'Relational' },
                { value: 'document', label: 'Document' },
                { value: 'key-value', label: 'Key-value' },
              ]}
              onChange={(value) => setContextValue('schemaShape', value)}
            />

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Toggle
                checked={context.globalUsers}
                onChange={(checked) => setContextValue('globalUsers', checked)}
                label="Global serving path"
                detail="Users must be served from multiple regions."
              />
              <Toggle
                checked={context.teamCapacity === 'platform'}
                onChange={(checked) => setContextValue('teamCapacity', checked ? 'platform' : 'lean')}
                label="Dedicated platform team"
                detail="The team can own partitioning and multi-region operations."
              />
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <section className="border-b border-neutral-200 p-4 dark:border-neutral-800 sm:p-6 lg:p-8" aria-labelledby="candidate-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">2. Compare alternatives</div>
                <h3 id="candidate-heading" className="mt-1 text-xl font-bold">Choose what you are willing to operate</h3>
              </div>
              <p className="max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                Fitness scores explain the current inputs. Select any candidate to stress it, even when it is not the top recommendation.
              </p>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {rankedCandidates.map((candidate, index) => {
                const active = candidate.id === candidateId;
                const top = candidate.id === recommended.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCandidateId(candidate.id)}
                    className={`min-h-64 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      active
                        ? 'border-neutral-950 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                        : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:border-neutral-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-bold uppercase ${active ? 'text-blue-300 dark:text-blue-700' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {top ? 'Best fit' : `Rank ${index + 1}`}
                      </span>
                      <span className={`text-2xl font-black tabular-nums ${active ? 'text-white dark:text-neutral-950' : 'text-neutral-950 dark:text-white'}`}>
                        {candidate.score}
                      </span>
                    </div>
                    <div className="mt-2 text-base font-bold">{candidate.name}</div>
                    <p className={`mt-2 text-sm leading-5 ${active ? 'text-neutral-300 dark:text-neutral-700' : 'text-neutral-600 dark:text-neutral-300'}`}>
                      {candidate.description}
                    </p>
                    <div className={`mt-4 h-1.5 overflow-hidden rounded-full ${active ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-neutral-200 dark:bg-neutral-800'}`}>
                      <div className={`h-full ${candidate.accent}`} style={{ width: `${candidate.score}%` }} />
                    </div>
                    <ul className={`mt-4 space-y-2 text-xs ${active ? 'text-neutral-200 dark:text-neutral-800' : 'text-neutral-600 dark:text-neutral-300'}`}>
                      {candidate.strengths.map((strength) => (
                        <li key={strength} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-b border-neutral-200 p-4 dark:border-neutral-800 sm:p-6 lg:p-8" aria-labelledby="flow-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-violet-700 dark:text-violet-300">3. Trace the consequence</div>
                <h3 id="flow-heading" className="mt-1 text-xl font-bold">Follow the selected serving path</h3>
              </div>
              <div className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                Evaluating: <span className="text-neutral-950 dark:text-white">{selected.shortName}</span>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900 sm:p-4">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_1.5rem_minmax(0,1fr)_1.5rem_minmax(0,1fr)] md:items-center">
                <FlowNode
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  label="Clients"
                  detail={context.globalUsers ? 'Multiple regions' : 'Primary region'}
                  active={false}
                />
                <ArrowRight className="mx-auto hidden h-4 w-4 text-neutral-400 md:block" aria-hidden="true" />
                <ArrowDown className="mx-auto h-4 w-4 text-neutral-400 md:hidden" aria-hidden="true" />
                <FlowNode
                  icon={<Globe2 className="h-5 w-5" aria-hidden="true" />}
                  label="Edge and routing"
                  detail={context.latencyTargetMs <= 120 ? 'Cacheable reads at edge' : 'Regional routing'}
                  active={challenge.target === 'edge'}
                />
                <ArrowRight className="mx-auto hidden h-4 w-4 text-neutral-400 md:block" aria-hidden="true" />
                <ArrowDown className="mx-auto h-4 w-4 text-neutral-400 md:hidden" aria-hidden="true" />
                <FlowNode
                  icon={<Server className="h-5 w-5" aria-hidden="true" />}
                  label="Service boundary"
                  detail={`${formatCompact(simulation.effectiveRps)} RPS under test`}
                  active={challenge.target === 'service'}
                />
                <ArrowRight className="mx-auto hidden h-4 w-4 text-neutral-400 md:block" aria-hidden="true" />
                <ArrowDown className="mx-auto h-4 w-4 text-neutral-400 md:hidden" aria-hidden="true" />
                <FlowNode
                  icon={<Database className="h-5 w-5" aria-hidden="true" />}
                  label="Data ownership"
                  detail={selected.shortName}
                  active={challenge.target === 'data' || challenge.target === 'replication'}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-bold uppercase text-neutral-500 dark:text-neutral-400">Decision logic</h4>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {selected.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                      <span className="first-letter:uppercase">{reason}.</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase text-neutral-500 dark:text-neutral-400">Accepted downside</h4>
                <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{selected.watch}</p>
              </div>
            </div>
          </section>

          <section className="p-4 sm:p-6 lg:p-8" aria-labelledby="challenge-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-rose-700 dark:text-rose-300">
                  <Siren className="h-4 w-4" aria-hidden="true" />
                  4. Challenge the decision
                </div>
                <h3 id="challenge-heading" className="mt-1 text-xl font-bold">Inject pressure before production does</h3>
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">This loop is independent of the requirement model.</div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {CHALLENGES.map((item) => {
                const active = item.id === challengeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChallengeId(item.id)}
                    className={`min-h-16 rounded-md border px-3 py-2 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
                      active
                        ? 'border-rose-700 bg-rose-700 text-white dark:border-rose-400 dark:bg-rose-400 dark:text-neutral-950'
                        : 'border-neutral-200 hover:border-rose-300 hover:bg-rose-50 dark:border-neutral-700 dark:hover:border-rose-700 dark:hover:bg-rose-950/40'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(14rem,0.55fr)_minmax(0,1.45fr)]">
              <div className="space-y-4">
                <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">{challenge.description}</p>
                <Slider
                  id="challenge-severity"
                  label="Incident severity"
                  value={challengeSeverity}
                  setValue={setChallengeSeverity}
                  min={1}
                  max={3}
                  format={(value) => ['Minor', 'Major', 'Severe'][value - 1]}
                />
              </div>

              <div
                className={`rounded-md border p-4 ${
                  decisionTone === 'bad'
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                    : decisionTone === 'warn'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                      : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  {decisionTone === 'good' ? (
                    <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      className={`mt-0.5 h-6 w-6 shrink-0 ${decisionTone === 'bad' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase text-neutral-600 dark:text-neutral-300">Observed outcome</div>
                    <div className="mt-1 text-xl font-bold">{decisionLabel}</div>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                      {simulation.saturation > 1
                        ? `Demand exceeds the selected path by ${Math.round((simulation.saturation - 1) * 100)}%. Queue growth and timeouts are now part of the user experience.`
                        : challengeId === 'replication-lag'
                          ? `The serving path stays available, but the consistency contract becomes visible: ${simulation.staleReadRisk.toLowerCase()}.`
                          : challengeId === 'region-loss'
                            ? `Surviving capacity carries ${formatCompact(simulation.effectiveRps)} RPS at ${simulation.availability.toFixed(2)}% modeled availability.`
                            : `The selected path retains ${simulation.headroom.toFixed(1)}x headroom at the tested load.`
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t border-black/10 pt-4 sm:grid-cols-3 dark:border-white/10">
                  <Metric
                    label="Capacity used"
                    value={`${Math.round(simulation.saturation * 100)}%`}
                    detail={`${selected.capacityRps.toLocaleString()} RPS plan`}
                    tone={simulation.saturation > 1 ? 'bad' : simulation.saturation > 0.7 ? 'warn' : 'good'}
                  />
                  <Metric
                    label="Availability"
                    value={`${simulation.availability.toFixed(2)}%`}
                    detail={challenge.label}
                    tone={simulation.availability < 99 ? 'bad' : simulation.availability < 99.9 ? 'warn' : 'good'}
                  />
                  <Metric label="Consistency" value={simulation.staleReadRisk} detail={context.consistency} tone={challengeId === 'replication-lag' ? 'warn' : 'neutral'} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-bold uppercase text-neutral-500 dark:text-neutral-400">Exposed contradictions</h4>
                {contradictions.length ? (
                  <ul className="mt-3 space-y-2">
                    {contradictions.map((issue) => (
                      <li key={issue} className="flex gap-2 text-sm leading-6 text-rose-800 dark:text-rose-200">
                        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                    No direct contradiction is visible. That is a testable hypothesis, not proof that the design is complete.
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold uppercase text-neutral-500 dark:text-neutral-400">Required mitigations</h4>
                <ol className="mt-3 space-y-2">
                  {mitigations.map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-neutral-200 bg-neutral-50 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-bold text-neutral-950 dark:text-white">Take the decision into design</div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              The whiteboard export includes the active architecture path. The ADR includes its constraints, consequences, and challenge result.
            </p>
          </div>
          <button
            type="button"
            onClick={openInWhiteboard}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 dark:focus-visible:ring-offset-neutral-900"
          >
            <Layers3 className="h-4 w-4" aria-hidden="true" />
            Open in whiteboard
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Architecture decision references" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-700">
          <Link href="/reference/sql-vs-nosql" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
            SQL vs NoSQL
          </Link>
          <Link href="/reference/caching-strategies" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
            Caching strategies
          </Link>
          <Link href="/reference/message-queues" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
            Message queues
          </Link>
        </nav>
      </footer>
    </section>
  );
}
