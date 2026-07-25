'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  FileKey2,
  HandCoins,
  History,
  Repeat2,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Operation = {
  id: string;
  label: string;
  detail: string;
  request: string;
  baseStatus: string;
  state: string;
  idempotent: boolean;
  supportsKey: boolean;
  asyncAllowed: boolean;
  retry: string;
};
type Option = { id: string; label: string; detail: string };
type RetryModel = {
  operations: Operation[];
  timeouts: Option[];
  duplicates: Option[];
  completionModes: Option[];
};

function StateResult({
  operation,
  hasKey,
  timeout,
  duplicate,
  completion,
}: {
  operation: Operation;
  hasKey: boolean;
  timeout: string;
  duplicate: string;
  completion: string;
}) {
  const asyncMode = completion === 'async' && operation.asyncAllowed;
  const retryArrives = duplicate === 'retry';
  const protectedReplay = retryArrives && (operation.idempotent || (hasKey && operation.supportsKey));
  const firstArrives = timeout !== 'before-arrival';
  const committed = timeout === 'after-commit' || timeout === 'during-work';
  const desiredStatus = asyncMode ? '202 Accepted' : operation.baseStatus;

  let clientStatus = desiredStatus;
  let serverState = asyncMode ? 'One operation accepted for background work' : operation.state;
  let recovery = operation.retry;
  let risk = 'The documented operation semantics match the visible result.';

  if (!firstArrives && !retryArrives) {
    clientStatus = 'Timeout before delivery';
    serverState = 'No request recorded';
    recovery = 'A resend is safe because the server never received the original request.';
    risk = 'The caller still needs a bounded deadline so a lost route does not wait forever.';
  } else if (!firstArrives && retryArrives) {
    clientStatus = `${desiredStatus} from retry`;
    serverState = asyncMode ? 'One operation accepted by the retry' : operation.state;
    recovery = 'The retry is the first delivery. Keep its deadline and authentication context intact.';
    risk = 'Network evidence is still incomplete; log the correlation ID for the original attempt.';
  } else if (timeout === 'after-commit') {
    clientStatus = 'Timeout; completion unknown to caller';
    recovery = hasKey && operation.supportsKey
      ? 'Retry with the same key or look up the recorded result. Do not create a new key for the same intent.'
      : operation.idempotent
        ? 'Repeat the same representation or read the resource state before acting again.'
        : 'Query a payment or operation status before retrying; an unkeyed replay can repeat the side effect.';
    risk = 'The server may already have committed the original work even though the response was lost.';
  } else if (timeout === 'during-work') {
    clientStatus = 'Timeout; handler may still finish';
    serverState = committed ? `May become: ${serverState}` : 'No completed result yet';
    recovery = hasKey && operation.supportsKey
      ? 'Use the same key to obtain one logical result after the handler resolves.'
      : operation.idempotent
        ? 'Retry only after considering concurrent changes and any required ETag precondition.'
        : 'Wait for status evidence or query the operation before sending another write.';
    risk = 'Cancelling a client wait does not guarantee cancellation reached the server.';
  }

  if (retryArrives && firstArrives) {
    if (protectedReplay) {
      clientStatus = asyncMode ? '202 Accepted; replay returns same operation' : `${desiredStatus}; replay returns same logical result`;
      serverState = asyncMode ? 'One background operation, not two' : operation.state;
      recovery = operation.idempotent
        ? 'The representation can be applied again, but preserve any documented preconditions.'
        : 'Store the idempotency key, caller identity, request fingerprint, and original response for the replay window.';
      risk = 'Protection covers one logical intent only. A new key or changed request body is a new operation.';
    } else {
      clientStatus = `${desiredStatus}; duplicate was accepted separately`;
      serverState = operation.id === 'create-payment' ? 'Two payments may be captured' : asyncMode ? 'Two background operations may run' : 'The duplicate side effect may be applied twice';
      recovery = 'Stop automatic retries. Reconcile state with a stable business reference before issuing another request.';
      risk = 'A transport retry became a second business action because the server could not recognize one logical request.';
    }
  }

  if (completion === 'async' && !operation.asyncAllowed) {
    risk = 'This operation is modeled as synchronous. Returning 202 without an operation resource would hide completion semantics from the caller.';
  }

  return { asyncMode, clientStatus, serverState, recovery, risk, protectedReplay, firstArrives };
}

export default function ApiPatternsRetryStateLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RetryModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState('create-payment');
  const [hasKey, setHasKey] = useState(true);
  const [timeout, setTimeoutPoint] = useState('after-commit');
  const [duplicate, setDuplicate] = useState('retry');
  const [completion, setCompletion] = useState('sync');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The retry and idempotency model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RetryModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the retry model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const operation = data?.operations.find((item) => item.id === operationId) ?? data?.operations[0];
  const result = useMemo(() => operation ? StateResult({ operation, hasKey, timeout, duplicate, completion }) : null, [completion, duplicate, hasKey, operation, timeout]);

  if (loadError) {
    return (
      <div data-content-block="reference/api-patterns-retry-state-lab">
        <div className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">Retry state explorer unavailable</p>
          <p className="mt-2 opacity-80">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data || !operation || !result) {
    return (
      <div data-content-block="reference/api-patterns-retry-state-lab">
        <div className="min-h-[610px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading retry state explorer" />
      </div>
    );
  }

  const selectedTimeout = data.timeouts.find((item) => item.id === timeout);
  const selectedDuplicate = data.duplicates.find((item) => item.id === duplicate);
  const keyUseful = hasKey && operation.supportsKey;

  return (
    <div data-content-block="reference/api-patterns-retry-state-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Retry and failure contract explorer"
          title="Make an uncertain write visible before choosing a retry"
          description="The explorer distinguishes a missing response from an unprocessed request. Change the controls and follow the status, durable state, and recovery guidance as one contract."
          icon={Repeat2}
          accent="rose"
          onReset={() => {
            setOperationId('create-payment');
            setHasKey(true);
            setTimeoutPoint('after-commit');
            setDuplicate('retry');
            setCompletion('sync');
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Method semantics</legend>
                <div className="mt-3 space-y-2">
                  {data.operations.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={operation.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'create-payment' ? HandCoins : item.id === 'request-export' ? Workflow : item.id === 'get-order' ? CircleDashed : History}
                      accent="rose"
                      onClick={() => setOperationId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Idempotency key</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={hasKey} label="Key present" detail={operation.supportsKey ? 'The server can associate one caller-scoped request fingerprint with one stored result.' : 'This method already has idempotent read semantics; a key adds no modeled protection.'} icon={FileKey2} accent="emerald" onClick={() => setHasKey(true)} />
                  <LabChoice selected={!hasKey} label="No key" detail="The server has no request-level evidence that two non-idempotent writes share one business intent." icon={TriangleAlert} accent="rose" onClick={() => setHasKey(false)} />
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Timeout point</legend>
                <div className="mt-3 space-y-2">
                  {data.timeouts.map((item) => (
                    <LabChoice key={item.id} selected={timeout === item.id} label={item.label} detail={item.detail} icon={TimerOff} accent="amber" onClick={() => setTimeoutPoint(item.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">4. Duplicate arrival</legend>
                <div className="mt-3 space-y-2">
                  {data.duplicates.map((item) => (
                    <LabChoice key={item.id} selected={duplicate === item.id} label={item.label} detail={item.detail} icon={item.id === 'retry' ? Repeat2 : CheckCircle2} accent="violet" onClick={() => setDuplicate(item.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">5. Completion model</legend>
                <div className="mt-3 space-y-2">
                  {data.completionModes.map((item) => (
                    <LabChoice key={item.id} selected={completion === item.id} label={item.label} detail={item.id === 'async' && !operation.asyncAllowed ? `${item.detail} This selected operation should not use it without an operation resource.` : item.detail} icon={item.id === 'async' ? Workflow : Clock3} accent="cyan" onClick={() => setCompletion(item.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Client-visible status" value={result.clientStatus} detail={result.asyncMode ? 'Acceptance is not completion; return an operation identifier.' : 'The response or timeout must have documented meaning.'} icon={Clock3} tone={result.clientStatus.includes('Timeout') ? 'amber' : result.protectedReplay ? 'emerald' : 'blue'} />
              <LabMetric label="Server state" value={result.serverState} detail={operation.request} icon={Database} tone={result.serverState.includes('Two') ? 'rose' : 'violet'} />
              <LabMetric label="Replay protection" value={result.protectedReplay ? 'One logical operation' : keyUseful ? 'Key available, no duplicate' : operation.idempotent ? 'Method semantics' : 'No duplicate guard'} detail={keyUseful ? 'Key plus fingerprint protects this intent.' : 'Safety depends on method semantics and server evidence.'} icon={ShieldCheck} tone={result.protectedReplay || operation.idempotent ? 'emerald' : 'rose'} />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Recovery guidance</p>
              <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{result.recovery}</p>
            </section>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Client-to-server state trace</h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Timeout: {selectedTimeout?.label}. Duplicate: {selectedDuplicate?.label}.</p>
              </header>
              <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">1</span>
                  <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Client sends `{operation.request}`</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hasKey && operation.supportsKey ? 'The request carries one caller-scoped idempotency key and the server records its fingerprint.' : 'No request-level idempotency evidence is available for a non-idempotent replay.'}</p></div>
                </li>
                <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">2</span>
                  <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Deadline reaches `{selectedTimeout?.label}`</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.firstArrives ? 'The server may have started or committed work even though the caller no longer has a response.' : 'The original message did not become a server-side operation.'}</p></div>
                </li>
                <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">3</span>
                  <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">{duplicate === 'retry' ? 'A retry reaches the server' : 'No second request arrives'}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{result.protectedReplay ? 'The server recognizes one logical intent and returns or continues the original result.' : duplicate === 'retry' && result.firstArrives ? 'The server cannot prove this is a replay of the first logical action.' : 'No duplicate needs to be reconciled in this trace.'}</p></div>
                </li>
                <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">4</span>
                  <div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Observed contract outcome</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Client sees: {result.clientStatus}. Durable state: {result.serverState}.</p></div>
                </li>
              </ol>
            </section>

            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-50">
              <p className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert aria-hidden="true" className="h-4 w-4" />Failure-contract consequence</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{result.risk}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
