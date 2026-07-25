'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  Database,
  Flame,
  KeyRound,
  Network,
  RefreshCw,
  Route,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ScenarioId = 'crash' | 'partition' | 'scale' | 'hot-key';
type RecoveryId = 'promote' | 'fence' | 'handoff' | 'replicate';

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  icon: LucideIcon;
  recommended: RecoveryId;
  remappedKeys: number;
  unsafeOriginQps: number;
  ringEpoch: number;
  safeResult: string;
  unsafeResult: string;
};

type Recovery = {
  id: RecoveryId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type NodeView = {
  id: string;
  zone: string;
  status: string;
  keys: string[];
  tone: 'neutral' | 'healthy' | 'warning' | 'failed';
};

const baseKeys: Record<string, string[]> = {
  A: ['profile:42', 'price:7', 'settings:4'],
  B: ['catalog:17', 'cart:42', 'stock:3'],
  C: ['session:9', 'feature:blue', 'offer:1'],
  D: ['home:84', 'article:91', 'locale:en'],
};

const scenarios: Scenario[] = [
  {
    id: 'crash',
    label: 'Node B stops responding',
    detail: 'Health checks confirm a process or host failure; the old owner cannot serve traffic.',
    icon: CloudOff,
    recommended: 'promote',
    remappedKeys: 3,
    unsafeOriginQps: 180_000,
    ringEpoch: 43,
    safeResult:
      'Only Node B ranges change primary owner. The next replicas serve immediately while the cluster restores the missing copy in the background.',
    unsafeResult:
      'The selected response either delays recovery or changes more ownership than the failure requires, increasing miss and migration pressure.',
  },
  {
    id: 'partition',
    label: 'Node B is isolated',
    detail: 'Some clients can still reach the old owner while the coordinator promotes a replacement.',
    icon: Network,
    recommended: 'fence',
    remappedKeys: 3,
    unsafeOriginQps: 220_000,
    ringEpoch: 43,
    safeResult:
      'A higher ring epoch authorizes the replacement and rejects writes from the isolated owner, preventing two active primaries.',
    unsafeResult:
      'Reachability alone cannot prove ownership. Without an epoch or fencing token, old and new owners can accept conflicting writes.',
  },
  {
    id: 'scale',
    label: 'Node E joins the ring',
    detail: 'The fleet needs more capacity, but a full rehash would churn every cache entry.',
    icon: Server,
    recommended: 'handoff',
    remappedKeys: 2,
    unsafeOriginQps: 60_000,
    ringEpoch: 44,
    safeResult:
      'Node E receives two sample ranges through a versioned, rate-limited handoff. The other ten keys keep their current owners.',
    unsafeResult:
      'An abrupt ownership cutover creates avoidable cold misses or ambiguous writes. Move only claimed ranges and publish one ring version.',
  },
  {
    id: 'hot-key',
    label: 'cart:42 reaches 450K reads/s',
    detail: 'One valid key saturates its owner even though cluster-wide utilization looks normal.',
    icon: Flame,
    recommended: 'replicate',
    remappedKeys: 0,
    unsafeOriginQps: 450_000,
    ringEpoch: 42,
    safeResult:
      'Ownership stays stable while read replicas, short-lived L1 copies, request coalescing, and per-key admission spread the demand.',
    unsafeResult:
      'Changing the whole ring does not remove one-key concentration. The hot value needs bounded replication and miss suppression.',
  },
];

const recoveries: Recovery[] = [
  {
    id: 'promote',
    label: 'Promote the next replica',
    detail: 'Route the failed ranges to their clockwise replica, then restore redundancy.',
    icon: RefreshCw,
  },
  {
    id: 'fence',
    label: 'Advance and enforce the ring epoch',
    detail: 'Promote a replica only after storage and clients reject the previous owner version.',
    icon: ShieldCheck,
  },
  {
    id: 'handoff',
    label: 'Run a versioned gradual handoff',
    detail: 'Copy selected ranges, verify them, publish one ring version, then retire old copies.',
    icon: Route,
  },
  {
    id: 'replicate',
    label: 'Replicate reads and coalesce misses',
    detail: 'Keep one owner while temporary copies and single-flight fills absorb a hot key.',
    icon: Activity,
  },
];

function formatQps(value: number) {
  return value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M/s`
    : `${Math.round(value / 1_000)}K/s`;
}

function buildNodeViews(scenarioId: ScenarioId): NodeView[] {
  const keys = Object.fromEntries(
    Object.entries(baseKeys).map(([node, ownedKeys]) => [node, [...ownedKeys]]),
  ) as Record<string, string[]>;

  const views: NodeView[] = [
    { id: 'A', zone: 'zone-a', status: 'Serving', keys: keys.A, tone: 'neutral' },
    { id: 'B', zone: 'zone-b', status: 'Serving', keys: keys.B, tone: 'neutral' },
    { id: 'C', zone: 'zone-c', status: 'Serving', keys: keys.C, tone: 'neutral' },
    { id: 'D', zone: 'zone-a', status: 'Serving', keys: keys.D, tone: 'neutral' },
  ];

  if (scenarioId === 'crash' || scenarioId === 'partition') {
    const nodeB = views.find((node) => node.id === 'B');
    const nodeC = views.find((node) => node.id === 'C');

    if (nodeB && nodeC) {
      nodeC.keys = [...nodeC.keys, ...baseKeys.B];
      nodeC.status = 'Promoted owner';
      nodeC.tone = 'healthy';
      nodeB.status = scenarioId === 'crash' ? 'Failed' : 'Old epoch isolated';
      nodeB.tone = 'failed';
      if (scenarioId === 'crash') nodeB.keys = [];
    }
  }

  if (scenarioId === 'scale') {
    const nodeA = views.find((node) => node.id === 'A');
    const nodeB = views.find((node) => node.id === 'B');
    if (nodeA) nodeA.keys = nodeA.keys.filter((key) => key !== 'price:7');
    if (nodeB) nodeB.keys = nodeB.keys.filter((key) => key !== 'stock:3');
    views.push({
      id: 'E',
      zone: 'zone-b',
      status: 'Joining owner',
      keys: ['price:7', 'stock:3'],
      tone: 'healthy',
    });
  }

  if (scenarioId === 'hot-key') {
    const nodeB = views.find((node) => node.id === 'B');
    if (nodeB) {
      nodeB.status = 'Hot owner';
      nodeB.tone = 'warning';
    }
  }

  return views;
}

const nodeToneClasses: Record<NodeView['tone'], string> = {
  neutral:
    'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950',
  healthy:
    'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
  warning:
    'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
  failed:
    'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40',
};

export default function DistributedCacheRingRecoveryLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('crash');
  const [recoveryId, setRecoveryId] = useState<RecoveryId>('promote');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const recovery = recoveries.find((item) => item.id === recoveryId) ?? recoveries[0];
    const safe = recovery.id === scenario.recommended;
    const nodeViews = buildNodeViews(scenario.id);
    const originQps = safe
      ? scenario.id === 'hot-key'
        ? 4_000
        : 0
      : scenario.unsafeOriginQps;

    return { scenario, recovery, safe, nodeViews, originQps };
  }, [recoveryId, scenarioId]);

  const reset = () => {
    setScenarioId('crash');
    setRecoveryId('promote');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Ownership and recovery lab"
        title="Change the ring without losing one-key ownership"
        description="Inject a cluster event, inspect which sample keys move, and choose the recovery contract. A safe response changes only required ranges and keeps one authoritative ring epoch."
        icon={KeyRound}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              1. Inject a cluster event
            </legend>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <LabChoice
                  key={scenario.id}
                  selected={scenario.id === scenarioId}
                  label={scenario.label}
                  detail={scenario.detail}
                  icon={scenario.icon}
                  accent="amber"
                  onClick={() => setScenarioId(scenario.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
      >
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            2. Choose the ownership response
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {recoveries.map((recovery) => (
              <LabChoice
                key={recovery.id}
                selected={recovery.id === recoveryId}
                label={recovery.label}
                detail={recovery.detail}
                icon={recovery.icon}
                accent="blue"
                onClick={() => setRecoveryId(recovery.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Keys remapped"
            value={`${model.scenario.remappedKeys} of 12`}
            detail="Sample primary ownership changes"
            icon={KeyRound}
            tone={model.scenario.remappedKeys <= 3 ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Ring authority"
            value={model.safe ? `Epoch ${model.scenario.ringEpoch}` : 'Ambiguous'}
            detail="One version must own every key"
            icon={ShieldCheck}
            tone={model.safe ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Origin fallback"
            value={formatQps(model.originQps)}
            detail="Modeled load while the event is active"
            icon={Database}
            tone={model.originQps <= 10_000 ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Recovery state"
            value={model.safe ? 'Bounded' : 'At risk'}
            detail="Movement, retries, and fill work terminate"
            icon={RefreshCw}
            tone={model.safe ? 'violet' : 'rose'}
          />
        </div>

        <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Simplified clockwise ring snapshot
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">
                {model.scenario.label}
              </p>
            </div>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Selected: {model.recovery.label}
            </span>
          </div>

          <ol className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
            {model.nodeViews.map((node) => (
              <li key={node.id} className={`min-w-0 rounded-md border p-3 ${nodeToneClasses[node.tone]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">Node {node.id}</p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{node.zone}</p>
                  </div>
                  <Server aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-600 dark:text-neutral-300" />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-200">
                  {node.status}
                </p>
                <ul className="mt-2 list-none space-y-1 p-0">
                  {node.keys.length > 0 ? node.keys.map((key) => (
                    <li
                      key={`${node.id}-${key}`}
                      className={`break-all rounded border px-2 py-1 text-xs font-medium ${
                        scenarioId === 'hot-key' && key === 'cart:42'
                          ? 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-50'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200'
                      }`}
                    >
                      {key}
                    </li>
                  )) : (
                    <li className="text-xs italic text-neutral-500 dark:text-neutral-400">No active ranges</li>
                  )}
                </ul>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            Virtual nodes would create many smaller ranges in production. This 12-key sample
            keeps the invariant visible: a membership change moves only affected ranges, not
            every key in the cluster.
          </p>
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.safe
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.safe ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-rose-700 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-neutral-950 dark:text-white">
                {model.safe ? 'Ownership invariant preserved' : 'The selected response leaves a correctness or load gap'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {model.safe ? model.scenario.safeResult : model.scenario.unsafeResult}
              </p>
              {!model.safe ? (
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  Use: {recoveries.find((item) => item.id === model.scenario.recommended)?.label}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
