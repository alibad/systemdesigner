'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Database,
  Eye,
  Network,
  Radio,
  Send,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type WriteContract = {
  id: string;
  label: string;
  detail: string;
  requiredVotingMembers: number;
  baseLatencyMs: number;
  durability: string;
};
type ReadContract = {
  id: string;
  label: string;
  detail: string;
  source: 'primary' | 'secondary';
  concern: 'local' | 'majority' | 'linearizable';
  baseLatencyMs: number;
};
type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  primaryWritable: boolean;
  reachableVotingMembers: number;
  secondaryReadable: boolean;
  networkPenaltyMs: number;
};
type ReplicaData = {
  title: string;
  description: string;
  defaults: {
    writeId: string;
    readId: string;
    failureId: string;
    replicationLagSeconds: number;
  };
  bounds: { replicationLagSeconds: Bound };
  writes: WriteContract[];
  reads: ReadContract[];
  failures: FailureScenario[];
};

const BLOCK_ID = 'technology/mongodb-replication-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isReplicaData(value: unknown): value is ReplicaData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReplicaData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.writeId
      && candidate.defaults.readId
      && candidate.defaults.failureId
      && isFiniteNumber(candidate.defaults.replicationLagSeconds)
      && isBound(candidate.bounds?.replicationLagSeconds)
      && Array.isArray(candidate.writes)
      && candidate.writes.length > 0
      && candidate.writes.every((item) => item.id && isFiniteNumber(item.requiredVotingMembers))
      && Array.isArray(candidate.reads)
      && candidate.reads.length > 0
      && candidate.reads.every((item) => item.id && ['primary', 'secondary'].includes(item.source))
      && Array.isArray(candidate.failures)
      && candidate.failures.length > 0
      && candidate.failures.every((item) => item.id && isFiniteNumber(item.reachableVotingMembers)),
  );
}

export default function MongoDBReplicationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReplicaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No replica-set model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReplicaData(payload)) throw new Error('The replica-set model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState error={error} />;
  if (!data) return <LoadState />;
  return <ReplicaWorkbench data={data} />;
}

function ReplicaWorkbench({ data }: { data: ReplicaData }) {
  const [writeId, setWriteId] = useState(data.defaults.writeId);
  const [readId, setReadId] = useState(data.defaults.readId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [replicationLagSeconds, setReplicationLagSeconds] = useState(
    data.defaults.replicationLagSeconds,
  );

  const write = data.writes.find((item) => item.id === writeId) ?? data.writes[0];
  const read = data.reads.find((item) => item.id === readId) ?? data.reads[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];

  const result = useMemo(() => {
    const majorityReachable = failure.reachableVotingMembers >= 2;
    const writeAccepted = failure.primaryWritable
      && failure.reachableVotingMembers >= write.requiredVotingMembers;
    const readSourceAvailable = read.source === 'primary'
      ? failure.primaryWritable
      : failure.secondaryReadable;
    const readGuaranteeAvailable = read.concern === 'linearizable'
      ? failure.primaryWritable && majorityReachable
      : readSourceAvailable;
    const readAvailable = readSourceAvailable && readGuaranteeAvailable;
    const modeledLatencyMs = failure.networkPenaltyMs
      + (writeAccepted ? write.baseLatencyMs : 0)
      + (readAvailable ? read.baseLatencyMs : 0)
      + (read.source === 'secondary' ? Math.min(10, replicationLagSeconds * 0.3) : 0);

    const readOutcome = !readAvailable
      ? 'Unavailable'
      : read.source === 'secondary'
        ? `May lag ${replicationLagSeconds}s`
        : read.concern === 'linearizable'
          ? 'Real-time ordered'
          : read.concern === 'majority'
            ? 'Majority committed'
            : 'Current primary view';
    const rollbackExposure = write.id === 'w1' || read.concern === 'local'
      ? 'Present'
      : 'Reduced at majority boundary';
    const serviceMode = writeAccepted && readAvailable
      ? 'Read + write'
      : readAvailable
        ? 'Read-only degraded'
        : writeAccepted
          ? 'Write-only contract'
          : 'Unavailable';

    let verdict = 'The contract preserves a clear majority boundary';
    let detail = 'Writes and reads have an explicit durable state boundary. Keep timeouts bounded and record the selected concern in traces.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!writeAccepted && !readAvailable) {
      verdict = 'Neither operation can satisfy this contract';
      detail = 'Fail closed, preserve the idempotency key, and retry only after topology discovery or an intentional degraded-mode decision.';
      tone = 'rose';
    } else if (!writeAccepted && readAvailable) {
      verdict = 'The deployment is read-only under this condition';
      detail = 'Reads can continue, but accepting writes would violate the selected acknowledgment or primary requirement. Surface degraded state to callers.';
      tone = 'amber';
    } else if (read.source === 'secondary' && replicationLagSeconds > 0) {
      verdict = 'Availability is preserved with bounded staleness';
      detail = `The selected secondary read can trail the primary by about ${replicationLagSeconds} seconds in this model. Use it only where the product tolerates stale or rollback-exposed values.`;
      tone = replicationLagSeconds >= 15 ? 'rose' : 'amber';
    } else if (write.id === 'w1' || read.concern === 'local') {
      verdict = 'The fast path includes rollback exposure';
      detail = 'The operation can observe state before the majority-commit boundary. Name that trade-off and reconcile ambiguous retries.';
      tone = 'amber';
    } else if (read.concern === 'linearizable') {
      verdict = 'Real-time ordering adds coordination';
      detail = 'Use this narrow contract only where one-document real-time order is required, and always pair it with a bounded operation timeout.';
      tone = 'amber';
    }

    return {
      detail,
      modeledLatencyMs,
      readAvailable,
      readOutcome,
      rollbackExposure,
      serviceMode,
      tone,
      verdict,
      writeAccepted,
    };
  }, [failure, read, replicationLagSeconds, write]);

  function reset() {
    setWriteId(data.defaults.writeId);
    setReadId(data.defaults.readId);
    setFailureId(data.defaults.failureId);
    setReplicationLagSeconds(data.defaults.replicationLagSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Replica consistency lab"
          title={data.title}
          description={data.description}
          icon={Network}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Write acknowledgment"
                items={data.writes}
                selectedId={write.id}
                icon={Send}
                accent="violet"
                onSelect={setWriteId}
              />
              <ChoiceGroup
                label="2. Read contract"
                items={data.reads}
                selectedId={read.id}
                icon={Eye}
                accent="blue"
                onSelect={setReadId}
              />
              <ChoiceGroup
                label="3. Topology condition"
                items={data.failures}
                selectedId={failure.id}
                icon={TriangleAlert}
                accent="amber"
                onSelect={setFailureId}
              />
              <LabRange
                label="Observed secondary lag"
                value={replicationLagSeconds}
                output={`${replicationLagSeconds}s`}
                {...data.bounds.replicationLagSeconds}
                accent="amber"
                lowLabel="Caught up"
                highLabel="Stale"
                onChange={setReplicationLagSeconds}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Write result"
                value={result.writeAccepted ? 'Accepted' : 'Blocked'}
                detail={`${write.requiredVotingMembers} of 3 voting members required`}
                icon={Send}
                tone={result.writeAccepted ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Read result"
                value={result.readOutcome}
                detail={`${read.source} / ${read.concern}`}
                icon={Eye}
                tone={!result.readAvailable ? 'rose' : read.source === 'secondary' && replicationLagSeconds > 0 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Service mode"
                value={result.serviceMode}
                detail={`${failure.reachableVotingMembers} voting members reachable`}
                icon={Radio}
                tone={result.serviceMode === 'Read + write' ? 'cyan' : result.serviceMode === 'Read-only degraded' ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Modeled path latency"
                value={`${result.modeledLatencyMs.toFixed(0)} ms`}
                detail="Coordination comparison, not a benchmark"
                icon={Clock3}
                tone={result.modeledLatencyMs < 30 ? 'violet' : result.modeledLatencyMs < 60 ? 'amber' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Replica-set operation path" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Live path</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">See which members can serve the contract</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{failure.label}</p>
              </div>
              <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                <ReplicaNode
                  icon={Database}
                  eyebrow="Primary"
                  title={failure.primaryWritable ? 'Writable' : 'No writable primary'}
                  detail={read.source === 'primary' ? 'Selected read source' : 'Write owner'}
                  state={failure.primaryWritable ? 'healthy' : 'failed'}
                  selected={read.source === 'primary'}
                />
                <FlowArrow active={result.writeAccepted} />
                <ReplicaNode
                  icon={Copy}
                  eyebrow="Secondary A"
                  title={failure.secondaryReadable ? 'Readable copy' : 'Unavailable'}
                  detail={read.source === 'secondary' ? 'Selected read source' : `${replicationLagSeconds}s observed lag`}
                  state={failure.secondaryReadable ? replicationLagSeconds > 0 ? 'degraded' : 'healthy' : 'failed'}
                  selected={read.source === 'secondary'}
                />
                <FlowArrow active={failure.reachableVotingMembers >= 3} />
                <ReplicaNode
                  icon={ShieldCheck}
                  eyebrow="Commit boundary"
                  title={`${failure.reachableVotingMembers} / 3 reachable`}
                  detail={result.writeAccepted ? write.durability : 'Selected write cannot be acknowledged'}
                  state={result.writeAccepted ? 'healthy' : failure.reachableVotingMembers >= 2 ? 'degraded' : 'failed'}
                />
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Rollback exposure" value={result.rollbackExposure} detail="Determined by write and read commit boundaries" />
              <Fact label="Retry posture" value={result.writeAccepted ? 'Reconcile timeouts' : 'Preserve operation identity'} detail="Never turn an unknown outcome into a duplicate business action" />
              <Fact label="Product promise" value={result.readOutcome} detail="The client-facing statement this configuration can support" />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'amber';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ReplicaNode({ icon: Icon, eyebrow, title, detail, state, selected = false }: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  state: 'healthy' | 'degraded' | 'failed';
  selected?: boolean;
}) {
  const styles = {
    healthy: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    degraded: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    failed: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`relative min-w-0 rounded-md border p-4 ${styles[state]} ${selected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-blue-400 dark:ring-offset-neutral-950' : ''}`}>
      {selected ? (
        <span className="absolute right-2 top-2 rounded bg-blue-700 px-2 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-blue-300 dark:text-blue-950">
          Read source
        </span>
      ) : null}
      <div className="flex items-center gap-2 pr-16 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-normal opacity-75">{state}</p>
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  const color = active
    ? 'text-emerald-600 dark:text-emerald-300'
    : 'text-neutral-300 dark:text-neutral-700';
  return (
    <div aria-hidden="true" className={`flex items-center justify-center ${color}`}>
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState({ error }: { error?: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow={error ? 'Model unavailable' : 'Loading replica lab'}
          title={error ? 'The replica-set model could not load' : 'Preparing the replica-set contract model'}
          description={error ?? 'Loading write, read, topology, and lag assumptions.'}
          icon={error ? CircleAlert : Network}
          accent={error ? 'rose' : 'violet'}
        />
      </LearningLab>
    </div>
  );
}
