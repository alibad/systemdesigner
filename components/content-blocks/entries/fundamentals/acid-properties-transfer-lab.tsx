'use client';

import { useMemo, useState } from 'react';
import { ArrowRightLeft, CircleAlert, Landmark, ReceiptText, ShieldCheck } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Boundary = 'one-transaction' | 'separate-writes';
type Failure = 'none' | 'credit-fails';

const startingBalance = 100;

export default function AcidPropertiesTransferLab() {
  const [boundary, setBoundary] = useState<Boundary>('one-transaction');
  const [failure, setFailure] = useState<Failure>('credit-fails');
  const [amount, setAmount] = useState(80);

  const outcome = useMemo(() => {
    const insufficientFunds = amount > startingBalance;
    const creditFails = failure === 'credit-fails';
    const rollback = boundary === 'one-transaction' && (insufficientFunds || creditFails);
    const debitApplied = !rollback && !insufficientFunds;
    const creditApplied = !rollback && !insufficientFunds && !creditFails;
    const accountA = startingBalance - (debitApplied ? amount : 0);
    const accountB = startingBalance + (creditApplied ? amount : 0);
    const total = accountA + accountB;
    const valid = total === 200 && accountA >= 0;

    return {
      accountA,
      accountB,
      total,
      valid,
      rollback,
      debitApplied,
      creditApplied,
      message: insufficientFunds
        ? rollback
          ? 'The balance rule rejects the transfer before either account changes.'
          : 'The split flow leaves the debit untouched only because the application checked funds before writing.'
        : creditFails
          ? rollback
            ? 'The failed credit rolls the debit back. Both accounts keep their original balances.'
            : 'The debit escaped before the credit failed. $' + amount + ' is missing from the two-account total.'
          : 'Both writes complete, so the transfer preserves the total balance.',
    };
  }, [amount, boundary, failure]);

  const reset = () => {
    setBoundary('one-transaction');
    setFailure('credit-fails');
    setAmount(80);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Atomicity and consistency lab"
        title="Trace one money transfer through a failure"
        description="A has $100 and B has $100. Change the boundary and inject a failed credit to see which facts remain true."
        icon={ArrowRightLeft}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Transaction boundary</p>
              <div className="mt-3 space-y-2">
                <LabChoice
                  selected={boundary === 'one-transaction'}
                  label="One transaction"
                  detail="Debit and credit commit together or both roll back."
                  icon={ShieldCheck}
                  accent="blue"
                  onClick={() => setBoundary('one-transaction')}
                />
                <LabChoice
                  selected={boundary === 'separate-writes'}
                  label="Separate writes"
                  detail="The debit can become visible before the credit is attempted."
                  icon={ReceiptText}
                  accent="rose"
                  onClick={() => setBoundary('separate-writes')}
                />
              </div>
            </div>

            <LabRange
              label="Transfer amount"
              value={amount}
              output={'$' + amount}
              min={20}
              max={140}
              step={20}
              accent="blue"
              lowLabel="$20"
              highLabel="$140"
              onChange={setAmount}
            />

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject a failure</p>
              <div className="mt-3 space-y-2">
                <LabChoice
                  selected={failure === 'none'}
                  label="Credit succeeds"
                  detail="Both account writes can finish."
                  accent="emerald"
                  onClick={() => setFailure('none')}
                />
                <LabChoice
                  selected={failure === 'credit-fails'}
                  label="Credit write fails"
                  detail="The destination update rejects or the process fails before it completes."
                  icon={CircleAlert}
                  accent="rose"
                  onClick={() => setFailure('credit-fails')}
                />
              </div>
            </div>
          </div>
        }
      >
        <div className={`rounded-md border p-4 ${outcome.valid ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'}`}>
          <div className="flex items-start gap-3">
            {outcome.valid ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{outcome.valid ? 'Invariant preserved' : 'Invariant broken'}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{outcome.message}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <LabMetric label="Account A" value={'$' + outcome.accountA} detail={outcome.debitApplied ? 'Debit applied' : 'No debit visible'} icon={Landmark} tone="blue" />
          <LabMetric label="Account B" value={'$' + outcome.accountB} detail={outcome.creditApplied ? 'Credit applied' : 'No credit visible'} icon={Landmark} tone="violet" />
          <LabMetric label="Combined total" value={'$' + outcome.total} detail={outcome.total === 200 ? 'Original total preserved' : 'Money is missing'} icon={ArrowRightLeft} tone={outcome.total === 200 ? 'emerald' : 'rose'} />
        </div>

        <ol className="mt-6 space-y-3 text-sm">
          <li className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">1</span><span className="pt-0.5 text-neutral-700 dark:text-neutral-300">Validate that A has enough funds for the requested transfer.</span></li>
          <li className={`flex items-start gap-3 ${outcome.debitApplied ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">2</span><span className="pt-0.5">Debit A by ${amount}{outcome.debitApplied ? '.' : outcome.rollback ? ', then roll it back.' : '.'}</span></li>
          <li className={`flex items-start gap-3 ${outcome.creditApplied ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200">3</span><span className="pt-0.5">Credit B by ${amount}{outcome.creditApplied ? '.' : failure === 'credit-fails' ? ', but this write fails.' : '.'}</span></li>
        </ol>
      </LearningLabBody>
    </LearningLab>
  );
}
