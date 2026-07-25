'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Layers3,
  LoaderCircle,
  MapPin,
  Route,
  ServerCrash,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type KeyFixture = {
  id: string;
  label: string;
  hash: number;
  detail: string;
};

type PlacementPolicy = {
  id: string;
  label: string;
  detail: string;
  skipDuplicateNodes: boolean;
  skipDuplicateDomains: boolean;
};

type Incident = {
  id: string;
  label: string;
  detail: string;
  failedNodes: string[];
};

type PhysicalNode = {
  id: string;
  label: string;
  domain: string;
  domainLabel: string;
};

type RingToken = {
  value: number;
  nodeId: string;
};

type ReplicaModel = {
  title: string;
  description: string;
  defaults: {
    keyId: string;
    replicationFactor: number;
    policyId: string;
    incidentId: string;
  };
  replicationFactor: {
    min: number;
    max: number;
    step: number;
  };
  keys: KeyFixture[];
  policies: PlacementPolicy[];
  incidents: Incident[];
  nodes: PhysicalNode[];
  tokens: RingToken[];
  modelNote: string;
};

type WalkStep = {
  token: RingToken;
  node: PhysicalNode;
  selected: boolean;
  reason: string;
};

const BLOCK_ID = 'technology/consistent-hashing-replica-lab';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isKeyFixture(value: unknown): value is KeyFixture {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KeyFixture>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.hash === 'number'
      && Number.isFinite(candidate.hash),
  );
}

function isPlacementPolicy(value: unknown): value is PlacementPolicy {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PlacementPolicy>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.skipDuplicateNodes === 'boolean'
      && typeof candidate.skipDuplicateDomains === 'boolean',
  );
}

function isIncident(value: unknown): value is Incident {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Incident>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isStringArray(candidate.failedNodes),
  );
}

function isPhysicalNode(value: unknown): value is PhysicalNode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PhysicalNode>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.domain
      && candidate.domainLabel,
  );
}

function isRingToken(value: unknown): value is RingToken {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RingToken>;
  return Boolean(
    typeof candidate.value === 'number'
      && Number.isFinite(candidate.value)
      && candidate.nodeId,
  );
}

function isReplicaModel(value: unknown): value is ReplicaModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplicaModel>;
  const bounds = candidate.replicationFactor;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.keyId
      && typeof candidate.defaults.replicationFactor === 'number'
      && candidate.defaults.policyId
      && candidate.defaults.incidentId
      && typeof bounds?.min === 'number'
      && typeof bounds.max === 'number'
      && typeof bounds.step === 'number'
      && Array.isArray(candidate.keys)
      && candidate.keys.length >= 2
      && candidate.keys.every(isKeyFixture)
      && Array.isArray(candidate.policies)
      && candidate.policies.length >= 2
      && candidate.policies.every(isPlacementPolicy)
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length >= 2
      && candidate.incidents.every(isIncident)
      && Array.isArray(candidate.nodes)
      && candidate.nodes.length >= 3
      && candidate.nodes.every(isPhysicalNode)
      && Array.isArray(candidate.tokens)
      && candidate.tokens.length >= candidate.nodes.length
      && candidate.tokens.every(isRingToken)
      && candidate.modelNote,
  );
}

export default function ConsistentHashingReplicaLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<ReplicaModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No replica failure model was supplied.');
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
        if (!isReplicaModel(payload)) {
          throw new Error('The replica failure model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the replica placement lab.',
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
        <ReplicaWorkbench model={model} />
      )}
    </div>
  );
}

function ReplicaWorkbench({ model }: { model: ReplicaModel }) {
  const [keyId, setKeyId] = useState(model.defaults.keyId);
  const [replicationFactor, setReplicationFactor] = useState(
    model.defaults.replicationFactor,
  );
  const [policyId, setPolicyId] = useState(model.defaults.policyId);
  const [incidentId, setIncidentId] = useState(model.defaults.incidentId);

  const key = model.keys.find((candidate) => candidate.id === keyId)
    ?? model.keys[0];
  const policy = model.policies.find((candidate) => candidate.id === policyId)
    ?? model.policies[0];
  const incident = model.incidents.find((candidate) => candidate.id === incidentId)
    ?? model.incidents[0];

  const result = useMemo(() => {
    const tokens = [...model.tokens].sort((left, right) => left.value - right.value);
    const start = tokens.findIndex((token) => token.value >= key.hash);
    const startIndex = start === -1 ? 0 : start;
    const usedNodes = new Set<string>();
    const usedDomains = new Set<string>();
    const selected: WalkStep[] = [];
    const walk: WalkStep[] = [];

    for (
      let offset = 0;
      offset < tokens.length && selected.length < replicationFactor;
      offset += 1
    ) {
      const token = tokens[(startIndex + offset) % tokens.length];
      const node = model.nodes.find((candidate) => candidate.id === token.nodeId)!;
      const duplicateNode = usedNodes.has(node.id);
      const duplicateDomain = usedDomains.has(node.domain);
      const skipNode = policy.skipDuplicateNodes && duplicateNode;
      const skipDomain = policy.skipDuplicateDomains && duplicateDomain;
      const selectedStep = !skipNode && !skipDomain;
      const reason = skipNode
        ? 'Skipped: physical node already selected'
        : skipDomain
          ? 'Skipped: failure domain already selected'
          : `Replica ${selected.length + 1}`;
      const step = { token, node, selected: selectedStep, reason };
      walk.push(step);

      if (selectedStep) {
        selected.push(step);
        usedNodes.add(node.id);
        usedDomains.add(node.domain);
      }
    }

    const uniqueNodes = new Set(selected.map((step) => step.node.id));
    const uniqueDomains = new Set(selected.map((step) => step.node.domain));
    const survivingNodes = new Set(
      selected
        .filter((step) => !incident.failedNodes.includes(step.node.id))
        .map((step) => step.node.id),
    );
    const independentGoalMet = uniqueNodes.size === replicationFactor;
    const allCopiesLost = survivingNodes.size === 0;
    const degraded = survivingNodes.size < uniqueNodes.size;

    const verdict = !independentGoalMet
      ? {
        title: 'The requested replica count overstates physical redundancy',
        detail: `${selected.length} selected token positions represent only ${uniqueNodes.size} distinct physical node${uniqueNodes.size === 1 ? '' : 's'}.`,
        tone: 'rose' as const,
      }
      : allCopiesLost
        ? {
          title: 'No selected physical copy survives this incident',
          detail: 'Placement and the injected failure share the same complete blast radius.',
          tone: 'rose' as const,
        }
        : degraded
          ? {
            title: `${survivingNodes.size} independent physical copy${survivingNodes.size === 1 ? '' : 'ies'} survive`,
            detail: 'Data may remain reachable, but the acknowledgement policy decides whether an operation can proceed.',
            tone: 'amber' as const,
          }
          : {
            title: 'Every selected physical copy remains present',
            detail: 'The placement goal is intact for this incident; consistency and repair still need separate validation.',
            tone: 'emerald' as const,
          };

    return {
      independentGoalMet,
      selected,
      survivingNodes,
      uniqueDomains,
      uniqueNodes,
      verdict,
      walk,
    };
  }, [incident.failedNodes, key.hash, model.nodes, model.tokens, policy, replicationFactor]);

  function reset() {
    setKeyId(model.defaults.keyId);
    setReplicationFactor(model.defaults.replicationFactor);
    setPolicyId(model.defaults.policyId);
    setIncidentId(model.defaults.incidentId);
  }

  const verdictStyles = {
    emerald:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50',
  } as const;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Replica walk lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Key position
              </legend>
              <div className="mt-3 grid gap-2">
                {model.keys.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === key.id}
                    label={`${candidate.label} · hash ${candidate.hash}`}
                    detail={candidate.detail}
                    icon={KeyRound}
                    accent="blue"
                    onClick={() => setKeyId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Requested replication factor"
              value={replicationFactor}
              output={`RF ${replicationFactor}`}
              {...model.replicationFactor}
              accent="violet"
              lowLabel="One copy"
              highLabel="Three copies"
              onChange={setReplicationFactor}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Placement policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.policies.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === policy.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={Route}
                    accent={candidate.id === 'token-only' ? 'rose' : 'emerald'}
                    onClick={() => setPolicyId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Injected failure
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === incident.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={ServerCrash}
                    accent={candidate.id === 'none' ? 'blue' : 'rose'}
                    onClick={() => setIncidentId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className={`rounded-md border p-5 ${verdictStyles[result.verdict.tone]}`}>
            <div className="flex items-start gap-3">
              {result.verdict.tone === 'emerald' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Observed placement consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">{result.verdict.title}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {result.verdict.detail}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Requested"
              value={`RF ${replicationFactor}`}
              detail="Token-walk target"
              icon={Layers3}
              tone="violet"
            />
            <LabMetric
              label="Physical copies"
              value={`${result.uniqueNodes.size}`}
              detail={`${result.selected.length} selected token positions`}
              icon={ShieldCheck}
              tone={result.independentGoalMet ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Failure domains"
              value={`${result.uniqueDomains.size}`}
              detail="Distinct zones in selected placement"
              icon={MapPin}
              tone={result.uniqueDomains.size >= replicationFactor ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="After incident"
              value={`${result.survivingNodes.size}`}
              detail="Distinct surviving physical copies"
              icon={ServerCrash}
              tone={result.survivingNodes.size > 0 ? 'amber' : 'rose'}
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h4 className="font-semibold text-neutral-950 dark:text-white">
                Clockwise token walk
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Start at hash {key.hash}; stop after {replicationFactor} selections
              </p>
            </div>
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {result.walk.map((step, index) => {
                const failed = incident.failedNodes.includes(step.node.id);
                return (
                  <li
                    key={`${step.token.value}-${index}`}
                    className={`rounded-md border p-3 ${
                      step.selected
                        ? failed
                          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
                          : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-50'
                        : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Token {step.token.value} · {step.node.label}
                        </p>
                        <p className="mt-1 text-xs opacity-75">
                          {step.node.domainLabel}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-sm border border-current px-2 py-1 text-[10px] font-semibold uppercase">
                        {step.selected ? (failed ? 'Failed' : 'Selected') : 'Skipped'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 opacity-80">{step.reason}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
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
        eyebrow="Replica walk lab"
        title="Trace placement across failures"
        description="Loading token, node, domain, and incident fixtures."
        icon={ShieldCheck}
        accent="rose"
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
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-rose-600 motion-reduce:animate-none dark:text-rose-400" />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading the replica model...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
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
