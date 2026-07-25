'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CircleAlert,
  Copy,
  Fingerprint,
  KeyRound,
  PackageCheck,
  Receipt,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type Guarantee = 'at-most-once' | 'at-least-once' | 'effectively-once';

interface GuaranteeOption {
  label: string;
  eyebrow: string;
  short: string;
  icon: LucideIcon;
  selectedClass: string;
  iconClass: string;
  eyebrowClass: string;
}

const guarantees: Record<Guarantee, GuaranteeOption> = {
  'at-most-once': {
    label: 'At most once',
    eyebrow: 'Loss tolerant',
    short: 'Send once. A lost message is not retried.',
    icon: Ban,
    selectedClass:
      'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-50',
    iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    eyebrowClass: 'text-amber-700 dark:text-amber-300',
  },
  'at-least-once': {
    label: 'At least once',
    eyebrow: 'Retryable',
    short: 'Retry until acknowledged. Duplicate delivery is possible.',
    icon: Repeat2,
    selectedClass:
      'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50',
    iconClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    eyebrowClass: 'text-blue-700 dark:text-blue-300',
  },
  'effectively-once': {
    label: 'Effectively once',
    eyebrow: 'Retry + dedupe',
    short: 'Retry safely. An idempotency key collapses duplicate effects.',
    icon: KeyRound,
    selectedClass:
      'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500 dark:border-emerald-400 dark:bg-emerald-950/60 dark:text-emerald-50',
    iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    eyebrowClass: 'text-emerald-700 dark:text-emerald-300',
  },
};

export default function DeliverySemanticsLab() {
  const [guarantee, setGuarantee] = useState<Guarantee>('at-least-once');
  const [idempotent, setIdempotent] = useState(false);
  const [duplicates, setDuplicates] = useState(1);

  const effectiveIdempotency = idempotent || guarantee === 'effectively-once';
  const outcome = useMemo(() => {
    const attempts = guarantee === 'at-most-once' ? 1 : 1 + duplicates;
    const sideEffects = effectiveIdempotency ? 1 : attempts;
    const risk = guarantee === 'at-most-once' ? 'message loss' : sideEffects > 1 ? 'duplicate charges' : 'controlled retries';
    return { attempts, sideEffects, risk, safe: sideEffects === 1 && guarantee !== 'at-most-once' };
  }, [duplicates, effectiveIdempotency, guarantee]);

  const reset = () => {
    setGuarantee('at-least-once');
    setIdempotent(false);
    setDuplicates(1);
  };

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl shadow-neutral-950/5 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/30">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6 md:py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <Fingerprint aria-hidden="true" className="h-4 w-4" />
              Delivery semantics lab
            </div>
            <h3 className="mt-2 text-xl font-semibold leading-tight text-white md:text-2xl">Inject a duplicate delivery</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
              Separate the broker&apos;s delivery promise from the application&apos;s business effect.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-right md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Current run</p>
              <p className="mt-0.5 text-xs font-semibold text-neutral-200">
                {outcome.attempts} attempt{outcome.attempts === 1 ? '' : 's'} · {outcome.sideEffects} effect{outcome.sideEffects === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Step 1</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Choose the delivery contract</h4>
            </div>
            <p className="hidden text-xs text-neutral-500 sm:block">One message, three guarantees</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(Object.keys(guarantees) as Guarantee[]).map((id) => {
              const item = guarantees[id];
              const selected = guarantee === id;
              const Icon = item.icon;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setGuarantee(id)}
                  className={`min-h-[154px] rounded-lg border p-4 text-left transition-[border-color,background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950 ${
                    selected
                      ? item.selectedClass
                      : 'border-neutral-200 bg-white text-neutral-900 hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-600'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${item.iconClass}`}>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-current/20 bg-white/65 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-current dark:bg-black/20">
                        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                        Selected
                      </span>
                    ) : null}
                  </span>
                  <span className={`mt-4 block text-[10px] font-bold uppercase tracking-wider ${selected ? item.eyebrowClass : 'text-neutral-500'}`}>
                    {item.eyebrow}
                  </span>
                  <span className="mt-1 block text-sm font-bold leading-5">{item.label}</span>
                  <span className={`mt-2 block text-xs leading-5 ${selected ? 'text-current/75' : 'text-neutral-500 dark:text-neutral-400'}`}>
                    {item.short}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Step 2</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Configure failure handling</h4>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-4 transition-colors ${effectiveIdempotency ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'}`}>
              <div className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${effectiveIdempotency ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                    <KeyRound aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Idempotent handler</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Deduplicate by payment ID.</span>
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={effectiveIdempotency}
                  disabled={guarantee === 'effectively-once'}
                  onClick={() => setIdempotent((value) => !value)}
                  className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
                    effectiveIdempotency
                      ? 'border-emerald-600 bg-emerald-500'
                      : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
                  }`}
                >
                  <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${effectiveIdempotency ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  <span className="sr-only">Toggle idempotent handler</span>
                </button>
              </div>
              {guarantee === 'effectively-once' ? (
                <p className="mt-3 border-t border-emerald-200 pt-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900 dark:text-emerald-200">
                  Required by this contract and enabled automatically.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  <Repeat2 aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                  Duplicate deliveries
                </span>
                <output className="rounded-md bg-violet-100 px-2 py-1 text-sm font-bold tabular-nums text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                  {guarantee === 'at-most-once' ? 0 : duplicates}
                </output>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                value={duplicates}
                disabled={guarantee === 'at-most-once'}
                onChange={(event) => setDuplicates(Number(event.target.value))}
                className="mt-5 h-2 w-full cursor-pointer accent-violet-600 disabled:cursor-not-allowed disabled:opacity-35"
              />
              <div className="mt-2 flex justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <span>No retry</span>
                <span>Retry storm</span>
              </div>
            </div>
          </div>

          <div className="mt-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Step 3</p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Trace every attempt</h4>
              </div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {effectiveIdempotency ? 'Duplicates collapse' : 'Every attempt applies'}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: outcome.attempts }).map((_, index) => {
                  const deduped = effectiveIdempotency && index > 0;
                  return (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                        deduped
                          ? 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400'
                          : outcome.sideEffects > 1 && index > 0
                            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                      }`}
                    >
                      {deduped ? <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> : <Receipt aria-hidden="true" className="h-3.5 w-3.5" />}
                      Attempt {index + 1}: {deduped ? 'deduped' : 'applied'}
                    </span>
                  );
                })}
              </div>

              <div className="mt-4 overflow-x-auto pb-1">
                <div className="grid min-w-[590px] grid-cols-[150px_40px_180px_40px_150px] items-center justify-between gap-2">
                  <div className="rounded-md border border-blue-300 bg-blue-50 p-4 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
                    <Copy aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    <p className="mt-3 text-sm font-bold">Broker</p>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">{outcome.attempts} deliveries</p>
                  </div>
                  <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                  <div className={`rounded-md border p-4 ${effectiveIdempotency ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'}`}>
                    <Fingerprint aria-hidden="true" className={`h-5 w-5 ${effectiveIdempotency ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`} />
                    <p className="mt-3 text-sm font-bold">Payment handler</p>
                    <p className="mt-1 text-xs opacity-75">{effectiveIdempotency ? 'Key enforced' : 'No deduplication'}</p>
                  </div>
                  <ArrowRight aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 dark:text-neutral-600" />
                  <div className={`rounded-md border p-4 ${outcome.sideEffects === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'}`}>
                    <PackageCheck aria-hidden="true" className={`h-5 w-5 ${outcome.sideEffects === 1 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`} />
                    <p className="mt-3 text-sm font-bold">Ledger</p>
                    <p className="mt-1 text-xs opacity-75">{outcome.sideEffects} charge{outcome.sideEffects === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-t border-neutral-800 bg-neutral-950 p-5 text-white lg:border-l lg:border-t-0 md:p-6">
          <div className={`rounded-lg border p-5 ${outcome.sideEffects === 1 ? 'border-emerald-700 bg-emerald-950/60' : 'border-rose-700 bg-rose-950/60'}`}>
            <div className="flex items-center justify-between gap-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-md ${outcome.sideEffects === 1 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                {outcome.sideEffects === 1 ? <Sparkles aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}
              </span>
              <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${outcome.safe ? 'border-emerald-600 text-emerald-300' : 'border-rose-700 text-rose-300'}`}>
                {outcome.safe ? 'Safe retry' : 'Unsafe outcome'}
              </span>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-neutral-400">Observed outcome</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
              {outcome.sideEffects} side effect{outcome.sideEffects === 1 ? '' : 's'}
            </p>
            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {outcome.sideEffects === 1
                ? effectiveIdempotency
                  ? 'Every delivery resolves to the same payment operation.'
                  : 'Only one delivery occurred, so the duplicate risk has not been exercised.'
                : 'The broker retried correctly, but the handler repeated the payment.'}
            </p>
          </div>

          <dl className="mt-6 divide-y divide-neutral-800 border-y border-neutral-800 text-sm">
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-neutral-400">Delivery attempts</dt>
              <dd className="font-bold tabular-nums text-white">{outcome.attempts}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-neutral-400">Business effects</dt>
              <dd className={`font-bold tabular-nums ${outcome.sideEffects === 1 ? 'text-emerald-300' : 'text-rose-300'}`}>{outcome.sideEffects}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-neutral-400">Dedupe</dt>
              <dd className="text-right font-semibold text-white">{effectiveIdempotency ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3.5">
              <dt className="text-neutral-400">Primary risk</dt>
              <dd className="text-right font-semibold text-white">{outcome.risk}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-violet-300" />
              Design invariant
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              At-least-once delivery is safe only when repeated attempts converge on one durable business effect.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
