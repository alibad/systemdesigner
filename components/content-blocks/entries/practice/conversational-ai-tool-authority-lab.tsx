'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, CircleAlert, FileSearch, RotateCcw, ShieldCheck, Wrench } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type RequestId = 'policy-answer' | 'account-lookup' | 'refund-request';

const requests: Array<{
  id: RequestId;
  label: string;
  detail: string;
  action: string;
  requiresConfirmation: boolean;
  requiresIdempotency: boolean;
}> = [
  {
    id: 'policy-answer',
    label: 'Policy question',
    detail: 'Answer from authorized knowledge without changing account state.',
    action: 'Retrieve and answer',
    requiresConfirmation: false,
    requiresIdempotency: false,
  },
  {
    id: 'account-lookup',
    label: 'Account lookup',
    detail: 'Read a live subscription status through a scoped API.',
    action: 'Read account status',
    requiresConfirmation: false,
    requiresIdempotency: false,
  },
  {
    id: 'refund-request',
    label: 'Refund request',
    detail: 'Start a state-changing workflow that must survive retries.',
    action: 'Initiate refund',
    requiresConfirmation: true,
    requiresIdempotency: true,
  },
];

export default function ConversationalAiToolAuthorityLab() {
  const [requestId, setRequestId] = useState<RequestId>('refund-request');
  const [tenantScope, setTenantScope] = useState(true);
  const [confirmed, setConfirmed] = useState(true);
  const [idempotency, setIdempotency] = useState(true);

  const result = useMemo(() => {
    const request = requests.find((item) => item.id === requestId) ?? requests[2];
    const needsTool = request.id !== 'policy-answer';
    const blockedByScope = !tenantScope;
    const blockedByConfirmation = request.requiresConfirmation && !confirmed;
    const blockedByIdempotency = request.requiresIdempotency && !idempotency;
    const canExecute = !blockedByScope && !blockedByConfirmation && !blockedByIdempotency;
    const outcome = !needsTool
      ? 'Answer with permitted evidence'
      : canExecute
        ? request.action
        : blockedByScope
          ? 'Block: tenant scope is missing'
          : blockedByConfirmation
            ? 'Ask for explicit confirmation'
            : 'Block: retry protection is missing';

    return {
      canExecute,
      needsTool,
      outcome,
      request,
      safeguards: [
        { label: 'Tenant scope', active: tenantScope, required: needsTool, detail: 'Server-side policy check' },
        { label: 'Confirmation', active: confirmed, required: request.requiresConfirmation, detail: 'User accepts side effect' },
        { label: 'Idempotency', active: idempotency, required: request.requiresIdempotency, detail: 'Safe retry key' },
      ],
    };
  }, [confirmed, idempotency, requestId, tenantScope]);

  const reset = () => {
    setRequestId('refund-request');
    setTenantScope(true);
    setConfirmed(true);
    setIdempotency(true);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Tool authority lab"
        title="Separate a model proposal from permission to act"
        description="Select a request and remove safeguards. The policy outcome changes before a tool is allowed to read or modify a tenant system."
        icon={ShieldCheck}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Requested outcome
              </legend>
              <div className="mt-3 space-y-2">
                {requests.map((request) => (
                  <LabChoice
                    key={request.id}
                    selected={request.id === requestId}
                    label={request.label}
                    detail={request.detail}
                    icon={request.id === 'policy-answer' ? FileSearch : Wrench}
                    accent="emerald"
                    onClick={() => setRequestId(request.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Policy safeguards
              </legend>
              <div className="mt-3 space-y-2">
                <GuardrailToggle label="Tenant scope" detail="Match tenant, user role, and API permission server-side." checked={tenantScope} onChange={() => setTenantScope((value) => !value)} />
                <GuardrailToggle label="Explicit confirmation" detail="Require the user to approve an irreversible or costly side effect." checked={confirmed} onChange={() => setConfirmed((value) => !value)} />
                <GuardrailToggle label="Idempotency key" detail="Make a timeout retry safe for a state-changing request." checked={idempotency} onChange={() => setIdempotency((value) => !value)} />
              </div>
            </fieldset>
          </div>
        }
      >
        <div className="space-y-5">
          <div className={`rounded-md border p-4 ${result.canExecute || !result.needsTool ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
            <p className="text-xs font-semibold uppercase opacity-75">Policy result</p>
            <p className="mt-2 text-xl font-semibold">{result.outcome}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              The model may suggest an intent, but only the scoped policy and tool service can authorize execution.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {result.safeguards.map((safeguard) => (
              <LabMetric
                key={safeguard.label}
                label={safeguard.label}
                value={safeguard.required ? (safeguard.active ? 'Present' : 'Missing') : 'Not needed'}
                detail={safeguard.detail}
                icon={safeguard.active || !safeguard.required ? BadgeCheck : CircleAlert}
                tone={safeguard.active || !safeguard.required ? 'emerald' : 'rose'}
              />
            ))}
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
            A policy answer needs grounded evidence but no operational tool. A read requires tenant scope. A write requires tenant scope, confirmation, and a retry-safe idempotency key.
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function GuardrailToggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
        <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full ${checked ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </span>
    </button>
  );
}
