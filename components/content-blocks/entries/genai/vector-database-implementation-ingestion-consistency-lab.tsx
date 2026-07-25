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
  FileClock,
  GitCommitHorizontal,
  Layers3,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Mutation = {
  id: string;
  label: string;
  detail: string;
  risk: string;
};

type WriteContract = {
  id: string;
  label: string;
  detail: string;
  idempotent: boolean;
  versioned: boolean;
  tombstones: boolean;
};

type ReadPolicy = {
  id: string;
  label: string;
  detail: string;
  readCostMs: number;
  usesCheckpoint: boolean;
  usesOverlay: boolean;
};

type ConsistencyData = {
  title: string;
  description: string;
  defaults: {
    mutationId: string;
    contractId: string;
    readPolicyId: string;
    writeRps: number;
    indexRps: number;
    retryPercent: number;
  };
  windowSeconds: number;
  overlayLimit: number;
  freshnessTargetSeconds: number;
  mutations: Mutation[];
  contracts: WriteContract[];
  readPolicies: ReadPolicy[];
};

const BLOCK_ID = 'genai/vector-database-implementation-ingestion-consistency-lab';

function isConsistencyData(value: unknown): value is ConsistencyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConsistencyData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && typeof candidate.windowSeconds === 'number'
      && typeof candidate.overlayLimit === 'number'
      && Array.isArray(candidate.mutations)
      && candidate.mutations.length > 0
      && Array.isArray(candidate.contracts)
      && candidate.contracts.length > 0
      && Array.isArray(candidate.readPolicies)
      && candidate.readPolicies.length > 0,
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function VectorDatabaseImplementationIngestionConsistencyLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ConsistencyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No ingestion-consistency model was supplied.');
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
        if (!isConsistencyData(payload)) throw new Error('Ingestion-consistency data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load ingestion data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <IngestionConsistencyWorkbench data={data} />;
}

function IngestionConsistencyWorkbench({ data }: { data: ConsistencyData }) {
  const [mutationId, setMutationId] = useState(data.defaults.mutationId);
  const [contractId, setContractId] = useState(data.defaults.contractId);
  const [readPolicyId, setReadPolicyId] = useState(data.defaults.readPolicyId);
  const [writeRps, setWriteRps] = useState(data.defaults.writeRps);
  const [indexRps, setIndexRps] = useState(data.defaults.indexRps);
  const [retryPercent, setRetryPercent] = useState(data.defaults.retryPercent);

  const mutation = data.mutations.find((item) => item.id === mutationId) ?? data.mutations[0];
  const contract = data.contracts.find((item) => item.id === contractId) ?? data.contracts[0];
  const readPolicy = data.readPolicies.find((item) => item.id === readPolicyId) ?? data.readPolicies[0];

  const result = useMemo(() => {
    const logicalMutations = writeRps * data.windowSeconds;
    const retryDeliveries = Math.round(logicalMutations * retryPercent / 100);
    const duplicateRecords = contract.idempotent ? 0 : retryDeliveries;
    const indexDemand = logicalMutations + duplicateRecords;
    const indexCapacity = indexRps * data.windowSeconds;
    const indexedMutations = Math.min(indexDemand, indexCapacity);
    const backlog = Math.max(0, indexDemand - indexedMutations);
    const freshnessLagSeconds = backlog / indexRps;
    const checkpointProgress = indexDemand === 0 ? 100 : indexedMutations / indexDemand * 100;

    const conflictRate = mutation.id === 'update' ? 0.08 : mutation.id === 'delete' ? 0.06 : 0.02;
    const orderingConflicts = contract.versioned ? 0 : Math.round(retryDeliveries * conflictRate);
    const resurrectionRisk = mutation.id === 'delete' && !contract.tombstones
      ? Math.max(0, orderingConflicts)
      : 0;
    const correctnessEvents = duplicateRecords + orderingConflicts + resurrectionRisk;
    const overlayCovers = backlog <= data.overlayLimit;

    let immediateRead = 'The latest indexed version is visible';
    let readDelayMs = readPolicy.readCostMs;
    let readCorrect = correctnessEvents === 0;

    if (readPolicy.usesCheckpoint) {
      readDelayMs += freshnessLagSeconds * 1000;
      immediateRead = freshnessLagSeconds > 0
        ? `The read waits ${freshnessLagSeconds.toFixed(1)} seconds for the checkpoint`
        : 'The checkpoint already covers the acknowledged write';
    } else if (readPolicy.usesOverlay) {
      immediateRead = overlayCovers
        ? `${formatNumber(backlog)} pending mutations are covered by the read overlay`
        : `The ${formatNumber(data.overlayLimit)}-mutation overlay cannot cover the backlog`;
      readCorrect = readCorrect && overlayCovers;
    } else if (freshnessLagSeconds > 0) {
      immediateRead = `The query can observe state about ${freshnessLagSeconds.toFixed(1)} seconds old`;
      readCorrect = false;
    }

    let verdict = 'The write and read contracts agree';
    let detail = 'Retries preserve one logical record, the selected read path covers freshness, and the serving checkpoint remains observable.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (correctnessEvents > 0) {
      verdict = mutation.id === 'delete'
        ? 'A delayed delivery can resurrect deleted evidence'
        : mutation.id === 'update'
          ? 'Retries can overwrite newer vector state'
          : 'Retries create duplicate searchable records';
      detail = `${formatNumber(correctnessEvents)} modeled correctness hazards occur because delivery identity and source ordering are not protected. ${mutation.risk}`;
      tone = 'rose';
    } else if (readPolicy.usesOverlay && !overlayCovers) {
      verdict = 'The change overlay is beyond its safe bound';
      detail = 'Backpressure or checkpoint waiting must replace the overlay before it becomes an unbounded second index.';
      tone = 'rose';
    } else if (!readCorrect) {
      verdict = 'The API acknowledges writes before search can prove visibility';
      detail = 'Expose a serving checkpoint, wait for it, or merge a bounded transactional overlay when the product requires read-after-write behavior.';
      tone = freshnessLagSeconds > data.freshnessTargetSeconds ? 'rose' : 'amber';
    } else if (freshnessLagSeconds > data.freshnessTargetSeconds) {
      verdict = 'Correctness is preserved, but freshness misses its target';
      detail = `The read path is safe, yet ${freshnessLagSeconds.toFixed(1)} seconds of lag exceeds the ${data.freshnessTargetSeconds}-second operating target.`;
      tone = 'amber';
    } else if (readPolicy.usesCheckpoint && readDelayMs > 300) {
      verdict = 'Strong visibility turns indexing lag into user latency';
      detail = 'The checkpoint wait is correct but too expensive for an interactive request. Reduce backlog or use a bounded overlay.';
      tone = 'amber';
    }

    return {
      backlog,
      checkpointProgress,
      correctnessEvents,
      detail,
      duplicateRecords,
      freshnessLagSeconds,
      immediateRead,
      indexDemand,
      indexedMutations,
      orderingConflicts,
      readCorrect,
      readDelayMs,
      retryDeliveries,
      resurrectionRisk,
      tone,
      verdict,
    };
  }, [contract, data, indexRps, mutation, readPolicy, retryPercent, writeRps]);

  const reset = () => {
    setMutationId(data.defaults.mutationId);
    setContractId(data.defaults.contractId);
    setReadPolicyId(data.defaults.readPolicyId);
    setWriteRps(data.defaults.writeRps);
    setIndexRps(data.defaults.indexRps);
    setRetryPercent(data.defaults.retryPercent);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Mutation and freshness control room"
          title={data.title}
          description={data.description}
          icon={GitCommitHorizontal}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Mutation to trace
                </legend>
                <div className="mt-3 space-y-2">
                  {data.mutations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mutation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'insert' ? Upload : item.id === 'delete' ? Trash2 : RefreshCcw}
                      accent={item.id === 'insert' ? 'blue' : item.id === 'delete' ? 'rose' : 'violet'}
                      onClick={() => setMutationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Write contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.contracts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === contract.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.idempotent ? ShieldCheck : Copy}
                      accent={item.idempotent ? 'emerald' : 'amber'}
                      onClick={() => setContractId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Immediate read policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.readPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === readPolicy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.usesCheckpoint ? FileClock : item.usesOverlay ? Layers3 : Eye}
                      accent={item.usesCheckpoint ? 'blue' : item.usesOverlay ? 'violet' : 'amber'}
                      onClick={() => setReadPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Accepted logical writes"
                value={writeRps}
                output={`${formatNumber(writeRps)} / sec`}
                min={100}
                max={1400}
                step={50}
                accent="violet"
                lowLabel="100 / sec"
                highLabel="1,400 / sec"
                onChange={setWriteRps}
              />

              <LabRange
                label="Indexing capacity"
                value={indexRps}
                output={`${formatNumber(indexRps)} / sec`}
                min={300}
                max={1400}
                step={50}
                accent="cyan"
                lowLabel="300 / sec"
                highLabel="1,400 / sec"
                onChange={setIndexRps}
              />

              <LabRange
                label="Retry deliveries"
                value={retryPercent}
                output={`${retryPercent}%`}
                min={0}
                max={20}
                step={1}
                accent="amber"
                lowLabel="None"
                highLabel="Retry storm"
                onChange={setRetryPercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Index backlog"
                value={formatNumber(result.backlog)}
                detail={`${result.freshnessLagSeconds.toFixed(1)} seconds of modeled lag`}
                icon={Clock3}
                tone={result.backlog > 0 ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Retry deliveries"
                value={formatNumber(result.retryDeliveries)}
                detail={`${formatNumber(result.duplicateRecords)} duplicate records`}
                icon={RefreshCcw}
                tone={result.duplicateRecords > 0 ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Ordering hazards"
                value={formatNumber(result.orderingConflicts + result.resurrectionRisk)}
                detail={contract.versioned ? 'Source versions reject stale delivery' : 'Older delivery can win'}
                icon={ShieldCheck}
                tone={result.correctnessEvents > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Immediate read"
                value={result.readCorrect ? 'Covered' : 'Stale'}
                detail={readPolicy.usesCheckpoint ? `${result.readDelayMs.toFixed(0)} ms modeled wait` : `${readPolicy.readCostMs} ms path overhead`}
                icon={Eye}
                tone={result.readCorrect ? 'violet' : 'rose'}
              />
            </div>

            <section aria-label="Mutation checkpoint timeline" className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Thirty-second incident window</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Follow one contract through four ownership boundaries</h4>
                </div>
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Checkpoint {result.checkpointProgress.toFixed(0)}% caught up
                </p>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                <div
                  className={`h-full transition-[width] motion-reduce:transition-none ${result.checkpointProgress >= 99.9 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.max(2, result.checkpointProgress)}%` }}
                />
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <TimelineStep
                  label="Write accepted"
                  value={`${formatNumber(writeRps * data.windowSeconds)} logical`}
                  detail={`${formatNumber(result.retryDeliveries)} additional deliveries`}
                  icon={Upload}
                />
                <TimelineConnector />
                <TimelineStep
                  label="Identity applied"
                  value={contract.idempotent ? 'One point ID' : 'Request IDs'}
                  detail={contract.versioned ? 'Version check and tombstone enforced' : `${formatNumber(result.correctnessEvents)} modeled hazards`}
                  icon={contract.idempotent ? ShieldCheck : Copy}
                  warning={result.correctnessEvents > 0}
                />
                <TimelineConnector />
                <TimelineStep
                  label="Serving checkpoint"
                  value={`${formatNumber(result.indexedMutations)} indexed`}
                  detail={`${formatNumber(result.backlog)} of ${formatNumber(result.indexDemand)} still pending`}
                  icon={Database}
                  warning={result.freshnessLagSeconds > data.freshnessTargetSeconds}
                />
                <TimelineConnector />
                <TimelineStep
                  label="Client reads"
                  value={result.readCorrect ? 'Latest state' : 'Unproven state'}
                  detail={result.immediateRead}
                  icon={Eye}
                  warning={!result.readCorrect}
                />
              </div>
            </section>

            <div className={`rounded-md border p-5 ${verdictStyle[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const verdictStyle = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
};

function TimelineStep({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  warning?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border bg-white p-3 dark:bg-neutral-950 ${warning ? 'border-rose-300 dark:border-rose-900' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <Icon aria-hidden="true" className={`h-4 w-4 ${warning ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'}`} />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 break-words text-base font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function TimelineConnector() {
  return (
    <div className="flex h-5 items-center justify-center text-neutral-400 md:h-auto" aria-hidden="true">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading the ingestion-consistency model...</p>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <p className="font-semibold">Ingestion-consistency model unavailable</p>
      <p className="mt-1 text-sm opacity-80">{detail}</p>
    </div>
  );
}
