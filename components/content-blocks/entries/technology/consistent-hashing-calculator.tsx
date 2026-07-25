'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CircleAlert,
  Gauge,
  Hash,
  LoaderCircle,
  Network,
  Server,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type VirtualNodeOption = {
  value: number;
  label: string;
  detail: string;
};

type MembershipChange = {
  id: string;
  label: string;
  detail: string;
  beforeNodeIds: string[];
  afterNodeIds: string[];
};

type RingNode = {
  id: string;
  label: string;
  tokens: number[];
};

type MovementModel = {
  title: string;
  description: string;
  hashSpace: number;
  defaults: {
    virtualNodesPerPhysical: number;
    change: string;
  };
  virtualNodeOptions: VirtualNodeOption[];
  changes: MembershipChange[];
  nodes: RingNode[];
  sampleKeyHashes: number[];
  modelNote: string;
};

type Token = {
  position: number;
  node: RingNode;
};

type Ownership = {
  node: RingNode;
  count: number;
};

const BLOCK_ID = 'technology/consistent-hashing-calculator';

const nodeStyles: Record<string, { dot: string; bar: string; text: string }> = {
  'node-a': {
    dot: 'border-blue-700 bg-blue-500 dark:border-blue-200',
    bar: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  'node-b': {
    dot: 'border-violet-700 bg-violet-500 dark:border-violet-200',
    bar: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
  },
  'node-c': {
    dot: 'border-amber-700 bg-amber-400 dark:border-amber-200',
    bar: 'bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'node-d': {
    dot: 'border-emerald-700 bg-emerald-500 dark:border-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isVirtualNodeOption(value: unknown): value is VirtualNodeOption {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VirtualNodeOption>;
  return Boolean(
    typeof candidate.value === 'number'
      && candidate.value > 0
      && candidate.label
      && candidate.detail,
  );
}

function isMembershipChange(value: unknown): value is MembershipChange {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MembershipChange>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isStringArray(candidate.beforeNodeIds)
      && isStringArray(candidate.afterNodeIds),
  );
}

function isRingNode(value: unknown): value is RingNode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RingNode>;
  return Boolean(
    candidate.id
      && candidate.label
      && Array.isArray(candidate.tokens)
      && candidate.tokens.length > 0
      && candidate.tokens.every(
        (token) => typeof token === 'number' && Number.isFinite(token),
      ),
  );
}

function isMovementModel(value: unknown): value is MovementModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MovementModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.hashSpace === 'number'
      && candidate.hashSpace > 0
      && typeof candidate.defaults?.virtualNodesPerPhysical === 'number'
      && candidate.defaults.change
      && Array.isArray(candidate.virtualNodeOptions)
      && candidate.virtualNodeOptions.length >= 2
      && candidate.virtualNodeOptions.every(isVirtualNodeOption)
      && Array.isArray(candidate.changes)
      && candidate.changes.length >= 2
      && candidate.changes.every(isMembershipChange)
      && Array.isArray(candidate.nodes)
      && candidate.nodes.length >= 3
      && candidate.nodes.every(isRingNode)
      && Array.isArray(candidate.sampleKeyHashes)
      && candidate.sampleKeyHashes.length > 0
      && candidate.sampleKeyHashes.every(
        (hash) => typeof hash === 'number'
          && hash >= 0
          && hash < candidate.hashSpace!,
      )
      && candidate.modelNote,
  );
}

function buildRing(
  model: MovementModel,
  nodeIds: string[],
  virtualNodesPerPhysical: number,
) {
  return model.nodes
    .filter((node) => nodeIds.includes(node.id))
    .flatMap((node) => node.tokens
      .slice(0, virtualNodesPerPhysical)
      .map((position) => ({ position, node })))
    .sort((left, right) => left.position - right.position);
}

function findOwner(hash: number, ring: Token[]) {
  return ring.find((token) => token.position >= hash) ?? ring[0];
}

function summarizeOwnership(
  hashes: number[],
  ring: Token[],
  nodeIds: string[],
  allNodes: RingNode[],
) {
  return nodeIds.map((nodeId) => {
    const node = allNodes.find((candidate) => candidate.id === nodeId)!;
    return {
      node,
      count: hashes.filter((hash) => findOwner(hash, ring).node.id === nodeId).length,
    };
  });
}

export default function ConsistentHashingMovementLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MovementModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No membership movement model was supplied.');
      return;
    }

    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMovementModel(payload)) {
          throw new Error('The membership movement model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the membership movement lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LoadState
          error={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : (
        <MovementWorkbench model={model} />
      )}
    </div>
  );
}

function MovementWorkbench({ model }: { model: MovementModel }) {
  const [virtualNodes, setVirtualNodes] = useState(
    model.defaults.virtualNodesPerPhysical,
  );
  const [changeId, setChangeId] = useState(model.defaults.change);
  const change = model.changes.find((candidate) => candidate.id === changeId)
    ?? model.changes[0];

  const result = useMemo(() => {
    const beforeRing = buildRing(
      model,
      change.beforeNodeIds,
      virtualNodes,
    );
    const afterRing = buildRing(
      model,
      change.afterNodeIds,
      virtualNodes,
    );
    const beforeOwners = model.sampleKeyHashes.map(
      (hash) => findOwner(hash, beforeRing).node.id,
    );
    const afterOwners = model.sampleKeyHashes.map(
      (hash) => findOwner(hash, afterRing).node.id,
    );
    const moved = beforeOwners.filter(
      (owner, index) => owner !== afterOwners[index],
    ).length;
    const moduloMoved = model.sampleKeyHashes.filter((hash) => {
      const before = change.beforeNodeIds[hash % change.beforeNodeIds.length];
      const after = change.afterNodeIds[hash % change.afterNodeIds.length];
      return before !== after;
    }).length;
    const beforeOwnership = summarizeOwnership(
      model.sampleKeyHashes,
      beforeRing,
      change.beforeNodeIds,
      model.nodes,
    );
    const afterOwnership = summarizeOwnership(
      model.sampleKeyHashes,
      afterRing,
      change.afterNodeIds,
      model.nodes,
    );
    const afterCounts = afterOwnership.map((item) => item.count);

    return {
      afterOwnership,
      afterRing,
      beforeOwnership,
      beforeRing,
      imbalance: Math.max(...afterCounts) - Math.min(...afterCounts),
      moduloMoved,
      moved,
    };
  }, [change, model, virtualNodes]);

  const sampleSize = model.sampleKeyHashes.length;
  const movementPct = Math.round((result.moved / sampleSize) * 100);
  const moduloPct = Math.round((result.moduloMoved / sampleSize) * 100);

  function reset() {
    setVirtualNodes(model.defaults.virtualNodesPerPhysical);
    setChangeId(model.defaults.change);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Ownership movement lab"
        title={model.title}
        description={model.description}
        icon={ArrowRightLeft}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Membership change
              </legend>
              <div className="mt-3 grid gap-2">
                {model.changes.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === change.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Server}
                    accent={candidate.id === 'add' ? 'emerald' : 'rose'}
                    onClick={() => setChangeId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Positions per physical node
              </legend>
              <div className="mt-3 grid gap-2">
                {model.virtualNodeOptions.map((option) => (
                  <LabChoice
                    key={option.value}
                    selected={option.value === virtualNodes}
                    label={option.label}
                    detail={option.detail}
                    icon={Hash}
                    accent="blue"
                    onClick={() => setVirtualNodes(option.value)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-md border border-violet-200 bg-violet-50 p-5 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50">
            <p className="text-xs font-semibold uppercase opacity-75">
              Measured consequence
            </p>
            <h4 className="mt-1 text-xl font-semibold">
              {result.moved} of {sampleSize} sampled keys change owners
            </h4>
            <p className="mt-2 text-sm leading-6 opacity-85">
              The consistent ring moves {movementPct}% of this fixed fixture. Replacing
              the divisor in modulo placement moves {moduloPct}% of the same hashes.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Ring movement"
              value={`${movementPct}%`}
              detail={`${result.moved} exact owner changes`}
              icon={ArrowRightLeft}
              tone="violet"
            />
            <LabMetric
              label="Modulo movement"
              value={`${moduloPct}%`}
              detail={`${result.moduloMoved} exact owner changes`}
              icon={Network}
              tone={moduloPct > movementPct ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Post-change spread"
              value={`${result.imbalance} keys`}
              detail="Largest minus smallest owner count"
              icon={Gauge}
              tone={result.imbalance <= sampleSize * 0.15 ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Token positions"
              value={`${result.afterRing.length}`}
              detail={`${virtualNodes} per physical owner`}
              icon={Hash}
              tone="blue"
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <RingPanel
              title="Before"
              subtitle={`${change.beforeNodeIds.length} physical nodes`}
              hashSpace={model.hashSpace}
              sampleSize={sampleSize}
              ring={result.beforeRing}
              ownership={result.beforeOwnership}
            />
            <RingPanel
              title="After"
              subtitle={`${change.afterNodeIds.length} physical nodes`}
              hashSpace={model.hashSpace}
              sampleSize={sampleSize}
              ring={result.afterRing}
              ownership={result.afterOwnership}
            />
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function RingPanel({
  title,
  subtitle,
  hashSpace,
  sampleSize,
  ring,
  ownership,
}: {
  title: string;
  subtitle: string;
  hashSpace: number;
  sampleSize: number;
  ring: Token[];
  ownership: Ownership[];
}) {
  return (
    <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-semibold text-neutral-950 dark:text-white">{title}</h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </div>

      <div
        aria-hidden="true"
        className="relative mx-auto mt-5 aspect-square w-full max-w-64 rounded-full border-8 border-neutral-200 bg-white shadow-inner dark:border-neutral-700 dark:bg-neutral-950"
      >
        <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full border border-dashed border-neutral-300 text-center dark:border-neutral-700">
          <Hash className="h-5 w-5 text-neutral-400" />
          <span className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {ring.length} tokens
          </span>
        </div>
        {ring.map((token) => {
          const angle = (token.position / hashSpace) * Math.PI * 2 - Math.PI / 2;
          const style = nodeStyles[token.node.id] ?? nodeStyles['node-a'];
          return (
            <span
              key={`${token.node.id}-${token.position}`}
              title={`${token.node.label} at ${token.position}`}
              className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${style.dot}`}
              style={{
                left: `${50 + Math.cos(angle) * 49}%`,
                top: `${50 + Math.sin(angle) * 49}%`,
              }}
            />
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        {ownership.map(({ node, count }) => {
          const style = nodeStyles[node.id] ?? nodeStyles['node-a'];
          const width = sampleSize === 0 ? 0 : (count / sampleSize) * 100;
          return (
            <div key={node.id}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={`font-semibold ${style.text}`}>{node.label}</span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                  {count} keys · {Math.round(width)}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Ownership movement lab"
        title="Compare membership changes"
        description="Loading the deterministic ring and key fixtures."
        icon={ArrowRightLeft}
        accent="violet"
      />
      <LearningLabBody>
        <div
          role={error ? 'alert' : 'status'}
          className="flex min-h-48 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <div>
            {error ? (
              <CircleAlert className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
            ) : (
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-400" />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading the membership model...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
