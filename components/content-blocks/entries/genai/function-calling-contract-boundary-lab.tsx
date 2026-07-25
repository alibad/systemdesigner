'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileJson2,
  KeyRound,
  LockKeyhole,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Contract = {
  id: string;
  label: string;
  detail: string;
  required: string[];
  rejectUnknown: boolean;
  validateTypes: boolean;
  enforceEnum: boolean;
};

type ProposedCall = {
  id: string;
  label: string;
  detail: string;
  arguments: Record<string, unknown>;
  callerTenant: string;
  resourceTenant: string;
  callerPermissions: string[];
};

type ContractBoundaryData = {
  title: string;
  description: string;
  defaults: { contractId: string; callId: string };
  contracts: Contract[];
  calls: ProposedCall[];
};

const BLOCK_ID = 'genai/function-calling-contract-boundary-lab';
const knownFields = ['orderId', 'include'];
const allowedIncludes = ['summary', 'shipping_status'];

function isContractBoundaryData(value: unknown): value is ContractBoundaryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContractBoundaryData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.contractId
      && candidate.defaults.callId
      && Array.isArray(candidate.contracts)
      && candidate.contracts.length > 0
      && candidate.contracts.every((contract) => (
        typeof contract.id === 'string'
        && typeof contract.label === 'string'
        && typeof contract.detail === 'string'
        && Array.isArray(contract.required)
        && contract.required.every((item) => typeof item === 'string')
        && typeof contract.rejectUnknown === 'boolean'
        && typeof contract.validateTypes === 'boolean'
        && typeof contract.enforceEnum === 'boolean'
      ))
      && Array.isArray(candidate.calls)
      && candidate.calls.length > 0
      && candidate.calls.every((call) => (
        typeof call.id === 'string'
        && typeof call.label === 'string'
        && typeof call.detail === 'string'
        && Boolean(call.arguments)
        && typeof call.arguments === 'object'
        && !Array.isArray(call.arguments)
        && typeof call.callerTenant === 'string'
        && typeof call.resourceTenant === 'string'
        && Array.isArray(call.callerPermissions)
        && call.callerPermissions.every((item) => typeof item === 'string')
      )),
  );
}

export default function FunctionCallingContractBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ContractBoundaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No contract scenario file was supplied.');
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
        if (!isContractBoundaryData(payload)) throw new Error('Contract scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load contract scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  if (!data) return <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />;
  return <ContractBoundaryLab data={data} />;
}

function ContractBoundaryLab({ data }: { data: ContractBoundaryData }) {
  const initialContract = data.contracts.find((item) => item.id === data.defaults.contractId)
    ?? data.contracts[0];
  const initialCall = data.calls.find((item) => item.id === data.defaults.callId) ?? data.calls[0];
  const [contractId, setContractId] = useState(initialContract.id);
  const [callId, setCallId] = useState(initialCall.id);

  const contract = data.contracts.find((item) => item.id === contractId) ?? data.contracts[0];
  const call = data.calls.find((item) => item.id === callId) ?? data.calls[0];

  const result = useMemo(() => {
    const schemaReasons: string[] = [];
    const argumentNames = Object.keys(call.arguments);

    for (const name of contract.required) {
      if (!(name in call.arguments)) schemaReasons.push(`Missing required field: ${name}`);
    }
    if (contract.rejectUnknown) {
      for (const name of argumentNames) {
        if (!knownFields.includes(name)) schemaReasons.push(`Unknown field rejected: ${name}`);
      }
    }
    if (contract.validateTypes) {
      if ('orderId' in call.arguments && typeof call.arguments.orderId !== 'string') {
        schemaReasons.push('orderId must be a string');
      }
      if ('include' in call.arguments && typeof call.arguments.include !== 'string') {
        schemaReasons.push('include must be a string');
      }
    }
    if (
      contract.enforceEnum
      && 'include' in call.arguments
      && !allowedIncludes.includes(String(call.arguments.include))
    ) {
      schemaReasons.push(`include must be one of: ${allowedIncludes.join(', ')}`);
    }

    const policyReasons: string[] = [];
    if (!call.callerPermissions.includes('orders:read')) {
      policyReasons.push('Caller lacks orders:read');
    }
    if (call.callerTenant !== call.resourceTenant) {
      policyReasons.push(`Resource belongs to ${call.resourceTenant}, not ${call.callerTenant}`);
    }

    const schemaPassed = schemaReasons.length === 0;
    const policyPassed = policyReasons.length === 0;
    const allowed = schemaPassed && policyPassed;
    const stoppedAt = !schemaPassed ? 'Schema' : !policyPassed ? 'Policy' : 'Executor';

    return { allowed, policyPassed, policyReasons, schemaPassed, schemaReasons, stoppedAt };
  }, [call, contract]);

  function reset() {
    setContractId(initialContract.id);
    setCallId(initialCall.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Tool contract boundary lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Model-facing contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.contracts.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === contract.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Braces}
                      accent="violet"
                      onClick={() => setContractId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Incoming proposal
                </legend>
                <div className="mt-3 space-y-2">
                  {data.calls.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === call.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileJson2}
                      accent="blue"
                      onClick={() => setCallId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Schema stage"
              value={result.schemaPassed ? 'Pass' : 'Deny'}
              detail={result.schemaPassed ? 'Arguments match this contract.' : result.schemaReasons[0]}
              icon={result.schemaPassed ? CheckCircle2 : CircleX}
              tone={result.schemaPassed ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Policy stage"
              value={!result.schemaPassed ? 'Not reached' : result.policyPassed ? 'Pass' : 'Deny'}
              detail={!result.schemaPassed
                ? 'Invalid input never reaches authorization.'
                : result.policyPassed ? 'Tenant and permission match.' : result.policyReasons[0]}
              icon={result.policyPassed && result.schemaPassed ? LockKeyhole : CircleAlert}
              tone={!result.schemaPassed ? 'neutral' : result.policyPassed ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Final decision"
              value={result.allowed ? 'Execute' : 'Blocked'}
              detail={`Stopped at: ${result.stoppedAt}`}
              icon={result.allowed ? Play : ShieldCheck}
              tone={result.allowed ? 'blue' : 'rose'}
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Proposed arguments</p>
                <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">lookup_order</p>
              </div>
              <span className="rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                {call.id}
              </span>
            </div>
            <pre className="mt-3 max-w-full overflow-x-auto rounded-md bg-neutral-950 p-4 text-xs leading-6 text-neutral-100">
              <code>{JSON.stringify(call.arguments, null, 2)}</code>
            </pre>
          </section>

          <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <BoundaryStage
              label="JSON Schema"
              detail={result.schemaPassed ? 'Shape accepted' : result.schemaReasons.join(' | ')}
              state={result.schemaPassed ? 'pass' : 'deny'}
              icon={Braces}
            />
            <Connector />
            <BoundaryStage
              label="Trusted policy"
              detail={!result.schemaPassed
                ? 'Not evaluated'
                : result.policyPassed ? 'Authority accepted' : result.policyReasons.join(' | ')}
              state={!result.schemaPassed ? 'idle' : result.policyPassed ? 'pass' : 'deny'}
              icon={KeyRound}
            />
            <Connector />
            <BoundaryStage
              label="Order service"
              detail={result.allowed ? 'Returns bounded shipping status' : 'Receives no request'}
              state={result.allowed ? 'pass' : 'idle'}
              icon={Play}
            />
          </div>

          <div className={`mt-5 rounded-md border p-4 ${
            result.allowed
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
          }`}>
            <p className="font-semibold text-neutral-950 dark:text-white">
              {result.allowed
                ? 'The proposal is both structurally valid and authorized.'
                : result.schemaPassed
                  ? 'Valid JSON is not sufficient authority.'
                  : 'The contract stopped invalid arguments before policy or execution.'}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {result.allowed
                ? 'The executor can now use its own scoped credential and return only the allowed result fields.'
                : result.schemaPassed
                  ? 'The model produced a valid tool call, but trusted caller and resource context still denied it.'
                  : 'Tight schemas reduce ambiguity and attack surface, while policy remains responsible for business authority.'}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BoundaryStage({
  label,
  detail,
  state,
  icon: Icon,
}: {
  label: string;
  detail: string;
  state: 'pass' | 'deny' | 'idle';
  icon: typeof Braces;
}) {
  const styles = {
    pass: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    deny: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50',
    idle: 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
  };

  return (
    <div className={`min-h-28 rounded-md border p-4 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 break-words text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function Connector() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-neutral-400">
      <span className="hidden md:inline">→</span>
      <span className="md:hidden">↓</span>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Tool contract boundary lab"
        title="Trace a proposal through schema and policy"
        description="Loading the contract scenarios..."
        icon={ShieldCheck}
        accent="violet"
      />
      <LearningLabBody>
        <div className="grid min-h-72 place-items-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
              <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Contract data could not load</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading contract scenarios...</p>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
