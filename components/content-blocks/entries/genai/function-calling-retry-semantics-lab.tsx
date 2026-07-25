'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  Copy,
  KeyRound,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Operation = {
  id: string;
  label: string;
  detail: string;
  effectClass: 'read' | 'write' | 'consequential';
  requiresApproval: boolean;
  supportsIdempotency: boolean;
};

type Fault = {
  id: string;
  label: string;
  detail: string;
  committed: boolean;
  responseObserved: boolean;
};

type Recovery = { id: string; label: string; detail: string };

type RetrySemanticsData = {
  title: string;
  description: string;
  defaults: {
    operationId: string;
    faultId: string;
    recoveryId: string;
    approved: boolean;
  };
  operations: Operation[];
  faults: Fault[];
  recoveries: Recovery[];
};

const BLOCK_ID = 'genai/function-calling-retry-semantics-lab';

function isRetrySemanticsData(value: unknown): value is RetrySemanticsData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetrySemanticsData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.operationId
      && candidate.defaults.faultId
      && candidate.defaults.recoveryId
      && typeof candidate.defaults.approved === 'boolean'
      && Array.isArray(candidate.operations)
      && candidate.operations.length > 0
      && candidate.operations.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && ['read', 'write', 'consequential'].includes(item.effectClass)
        && typeof item.requiresApproval === 'boolean'
        && typeof item.supportsIdempotency === 'boolean'
      ))
      && Array.isArray(candidate.faults)
      && candidate.faults.length > 0
      && candidate.faults.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.committed === 'boolean'
        && typeof item.responseObserved === 'boolean'
      ))
      && Array.isArray(candidate.recoveries)
      && candidate.recoveries.length > 0
      && candidate.recoveries.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
      )),
  );
}

export default function FunctionCallingRetrySemanticsLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RetrySemanticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No retry scenario file was supplied.');
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
        if (!isRetrySemanticsData(payload)) throw new Error('Retry scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load retry scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  if (!data) return <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />;
  return <RetrySemanticsLab data={data} />;
}

function RetrySemanticsLab({ data }: { data: RetrySemanticsData }) {
  const initialOperation = data.operations.find((item) => item.id === data.defaults.operationId)
    ?? data.operations[0];
  const initialFault = data.faults.find((item) => item.id === data.defaults.faultId) ?? data.faults[0];
  const initialRecovery = data.recoveries.find((item) => item.id === data.defaults.recoveryId)
    ?? data.recoveries[0];

  const [operationId, setOperationId] = useState(initialOperation.id);
  const [faultId, setFaultId] = useState(initialFault.id);
  const [recoveryId, setRecoveryId] = useState(initialRecovery.id);
  const [approved, setApproved] = useState(data.defaults.approved);

  const operation = data.operations.find((item) => item.id === operationId) ?? data.operations[0];
  const fault = data.faults.find((item) => item.id === faultId) ?? data.faults[0];
  const recovery = data.recoveries.find((item) => item.id === recoveryId) ?? data.recoveries[0];

  const result = useMemo(() => {
    if (operation.requiresApproval && !approved) {
      return {
        attempts: 0,
        effects: 0,
        duplicates: 0,
        label: 'Paused for user approval',
        detail: 'The execution gate blocks this financial effect before the first attempt.',
        tone: 'amber' as const,
        safe: true,
        attemptStates: [] as Array<'committed' | 'timed-out' | 'replayed'>,
      };
    }

    const isRead = operation.effectClass === 'read';
    if (fault.responseObserved) {
      return {
        attempts: 1,
        effects: isRead ? 0 : 1,
        duplicates: 0,
        label: 'Completed with an observed result',
        detail: 'The caller can return the typed observation to the model without recovery.',
        tone: 'emerald' as const,
        safe: true,
        attemptStates: ['committed'] as Array<'committed' | 'timed-out' | 'replayed'>,
      };
    }

    if (recovery.id === 'no-retry') {
      const effects = isRead || !fault.committed ? 0 : 1;
      return {
        attempts: 1,
        effects,
        duplicates: 0,
        label: 'Outcome remains ambiguous to the caller',
        detail: effects > 0
          ? 'The side effect exists even though the caller saw a timeout. Reconcile authoritative state before continuing.'
          : 'No effect occurred in this simulation, but the caller must still reconcile because the timeout did not prove that.',
        tone: 'amber' as const,
        safe: true,
        attemptStates: ['timed-out'] as Array<'committed' | 'timed-out' | 'replayed'>,
      };
    }

    const firstEffects = isRead || !fault.committed ? 0 : 1;
    const retryEffects = isRead ? 0 : recovery.id === 'idempotent-retry' && operation.supportsIdempotency
      ? (firstEffects === 0 ? 1 : 0)
      : 1;
    const effects = firstEffects + retryEffects;
    const duplicates = isRead ? 0 : Math.max(0, effects - 1);
    const idempotent = recovery.id === 'idempotent-retry' && operation.supportsIdempotency;

    return {
      attempts: 2,
      effects,
      duplicates,
      label: duplicates > 0
        ? 'The retry repeated the user-visible effect'
        : idempotent
          ? 'The retry recovered one durable intent'
          : 'The retry completed without an external mutation',
      detail: duplicates > 0
        ? `The first attempt committed and the blind retry created ${effects} total side effects.`
        : idempotent
          ? 'The stable idempotency key returned the first stored outcome instead of applying the write again.'
          : 'Read-only work is repeatable, though extra attempts still consume capacity and may observe newer data.',
      tone: duplicates > 0 ? 'rose' as const : 'emerald' as const,
      safe: duplicates === 0,
      attemptStates: [
        'timed-out',
        idempotent && firstEffects > 0 ? 'replayed' : 'committed',
      ] as Array<'committed' | 'timed-out' | 'replayed'>,
    };
  }, [approved, fault, operation, recovery.id]);

  function reset() {
    setOperationId(initialOperation.id);
    setFaultId(initialFault.id);
    setRecoveryId(initialRecovery.id);
    setApproved(data.defaults.approved);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retry semantics lab"
          title={data.title}
          description={data.description}
          icon={RotateCcw}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Operation
                </legend>
                <div className="mt-3 space-y-2">
                  {data.operations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === operation.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.effectClass === 'read' ? Search : item.effectClass === 'write' ? MessageSquareText : WalletCards}
                      accent="blue"
                      onClick={() => {
                        setOperationId(item.id);
                        if (!item.requiresApproval) setApproved(false);
                      }}
                    />
                  ))}
                </div>
              </fieldset>

              {operation.requiresApproval ? (
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  approved
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
                    : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(event) => setApproved(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Fresh user approval</span>
                    <span className="mt-1 block text-xs leading-5 opacity-80">
                      {approved ? 'Approval is bound to this refund proposal.' : 'The proposal must pause before execution.'}
                    </span>
                  </span>
                </label>
              ) : null}

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution outcome
                </legend>
                <div className="mt-3 space-y-2">
                  {data.faults.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === fault.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.responseObserved ? CheckCircle2 : Clock3}
                      accent="amber"
                      onClick={() => setFaultId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Recovery strategy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.recoveries.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === recovery.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'idempotent-retry' ? KeyRound : item.id === 'blind-retry' ? Copy : ShieldCheck}
                      accent="violet"
                      onClick={() => setRecoveryId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Attempts"
              value={String(result.attempts)}
              detail="Requests sent to the dependency"
              icon={RotateCcw}
              tone="blue"
            />
            <LabMetric
              label="External effects"
              value={String(result.effects)}
              detail={operation.effectClass === 'read' ? 'Reads do not mutate state' : 'Messages, refunds, or writes'}
              icon={operation.effectClass === 'read' ? Search : MessageSquareText}
              tone={result.effects > 1 ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Duplicate effects"
              value={String(result.duplicates)}
              detail="Production target: exactly zero"
              icon={result.duplicates > 0 ? TriangleAlert : BadgeCheck}
              tone={result.duplicates > 0 ? 'rose' : 'emerald'}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Execution trace</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{operation.label}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {operation.effectClass}
                </span>
                <span className="rounded border border-neutral-200 bg-white px-2 py-1 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {fault.label}
                </span>
              </div>
            </div>

            {result.attempts === 0 ? (
              <div className="mt-5 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
                <p className="text-sm font-semibold">Execution is intentionally paused at the approval gate.</p>
              </div>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <AttemptCard number={1} state={result.attemptStates[0]} fault={fault} />
                <div aria-hidden="true" className="flex items-center justify-center text-neutral-400">
                  <span className="hidden sm:inline">→</span>
                  <span className="sm:hidden">↓</span>
                </div>
                {result.attempts === 2 ? (
                  <AttemptCard number={2} state={result.attemptStates[1]} fault={fault} />
                ) : (
                  <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    No retry needed
                  </div>
                )}
              </div>
            )}
          </section>

          <div className={`mt-5 rounded-md border p-4 ${
            result.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                : 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          }`}>
            <div className="flex items-start gap-3">
              {result.safe
                ? <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="font-semibold text-neutral-950 dark:text-white">{result.label}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function AttemptCard({
  number,
  state,
  fault,
}: {
  number: number;
  state: 'committed' | 'timed-out' | 'replayed';
  fault: Fault;
}) {
  const states = {
    committed: {
      label: 'Observed success',
      detail: number === 1 ? 'The result reached the caller.' : 'The retry completed the operation.',
      icon: CheckCircle2,
      style: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    },
    'timed-out': {
      label: 'Response timed out',
      detail: fault.committed ? 'The service committed, but the response was lost.' : 'The deadline elapsed before commit.',
      icon: Clock3,
      style: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50',
    },
    replayed: {
      label: 'Stored outcome replayed',
      detail: 'The idempotency key matched the first committed intent.',
      icon: KeyRound,
      style: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-50',
    },
  };
  const current = states[state];
  const Icon = current.icon;

  return (
    <div className={`min-h-28 rounded-md border p-4 ${current.style}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">Attempt {number}</p>
      </div>
      <p className="mt-2 text-sm font-semibold">{current.label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{current.detail}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Retry semantics lab"
        title="Recover a timeout without repeating the user's intent"
        description="Loading the execution scenarios..."
        icon={RotateCcw}
        accent="amber"
      />
      <LearningLabBody>
        <div className="grid min-h-72 place-items-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
              <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Retry data could not load</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <CircleDashed aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Loading execution scenarios...
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
