'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, LockKeyhole, ShoppingBag, Split } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Strategy = 'read-then-write' | 'guarded-update' | 'serializable';

const strategies: Record<Strategy, { label: string; detail: string; accent: 'rose' | 'emerald' | 'violet' }> = {
  'read-then-write': {
    label: 'Read, then write',
    detail: 'Both requests trust the same earlier read before changing stock.',
    accent: 'rose',
  },
  'guarded-update': {
    label: 'Guarded update',
    detail: 'The stock condition and decrement happen in one write.',
    accent: 'emerald',
  },
  serializable: {
    label: 'Serializable transaction',
    detail: 'The database aborts one conflicting buyer so the caller can retry.',
    accent: 'violet',
  },
};

export default function AcidPropertiesInventoryLab() {
  const [strategy, setStrategy] = useState<Strategy>('read-then-write');

  const outcome = useMemo(() => {
    if (strategy === 'read-then-write') {
      return {
        accepted: 2,
        remaining: -1,
        safe: false,
        headline: 'Both buyers were accepted for one item.',
        explanation: 'Each buyer read available = 1 before either write completed. The separate check and write did not protect the shared invariant.',
        trace: ['Buyer 1 reads 1 available', 'Buyer 2 reads 1 available', 'Buyer 1 reserves the item', 'Buyer 2 also reserves the item'],
      };
    }

    if (strategy === 'guarded-update') {
      return {
        accepted: 1,
        remaining: 0,
        safe: true,
        headline: 'One buyer is accepted; the second update affects zero rows.',
        explanation: 'The database evaluates available > 0 while it performs the decrement. The second buyer receives a sold-out result instead of a stale success.',
        trace: ['Buyer 1 updates where available > 0', 'Buyer 1 reserves the item', 'Buyer 2 updates where available > 0', 'Buyer 2 gets zero affected rows'],
      };
    }

    return {
      accepted: 1,
      remaining: 0,
      safe: true,
      headline: 'One buyer commits; the other is aborted and must retry.',
      explanation: 'Serializable isolation detects the conflicting read-write outcome. Retrying the aborted request observes sold-out inventory and does not create a second reservation.',
      trace: ['Both buyers begin a transaction', 'Buyer 1 reserves and commits', 'Buyer 2 is aborted for serialization conflict', 'Buyer 2 retries and sees sold out'],
    };
  }, [strategy]);

  const reset = () => setStrategy('read-then-write');

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Isolation lab"
        title="Race two buyers for one item"
        description="Both buyers begin when inventory shows one item. Pick the concurrency strategy and inspect the resulting reservation trace."
        icon={ShoppingBag}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Concurrency strategy</p>
            <div className="mt-3 space-y-2">
              {(Object.keys(strategies) as Strategy[]).map((id) => (
                <LabChoice
                  key={id}
                  selected={strategy === id}
                  label={strategies[id].label}
                  detail={strategies[id].detail}
                  icon={id === 'read-then-write' ? Split : id === 'guarded-update' ? CheckCircle2 : LockKeyhole}
                  accent={strategies[id].accent}
                  onClick={() => setStrategy(id)}
                />
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">This is a simplified race. Real engine behavior also depends on the isolation level, query shape, indexes, and retry policy.</p>
          </div>
        }
      >
        <div className={`rounded-md border p-4 ${outcome.safe ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'}`}>
          <div className="flex items-start gap-3">
            {outcome.safe ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{outcome.headline}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{outcome.explanation}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LabMetric label="Starting stock" value="1" detail="Both buyers begin together" icon={ShoppingBag} tone="blue" />
          <LabMetric label="Accepted orders" value={String(outcome.accepted)} detail={outcome.safe ? 'Exactly one reservation' : 'One order is oversold'} icon={CheckCircle2} tone={outcome.safe ? 'emerald' : 'rose'} />
          <LabMetric label="Remaining stock" value={String(outcome.remaining)} detail={outcome.safe ? 'Invariant holds' : 'Negative stock signals oversell'} icon={LockKeyhole} tone={outcome.safe ? 'emerald' : 'rose'} />
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Request trace</p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {outcome.trace.map((step, index) => (
              <li key={step} className="flex min-w-0 items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{index + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
