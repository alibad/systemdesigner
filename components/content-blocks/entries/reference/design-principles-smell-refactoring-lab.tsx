'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitFork, ShieldCheck, Siren, Wrench } from 'lucide-react';
import { LabChoice, LabMetric, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

type SmellId = 'shared-data' | 'critical-chain' | 'god-module' | 'broad-token';

type Refactor = {
  id: string;
  label: string;
  detail: string;
  effective: boolean;
  result: string;
};

type Smell = {
  id: SmellId;
  label: string;
  symptom: string;
  failure: string;
  principle: string;
  safePlan: string;
  refactors: Refactor[];
};

const smells: Smell[] = [
  {
    id: 'shared-data',
    label: 'Services share private tables',
    symptom: 'Shipping changes requires coordinating several callers of the same schema.',
    failure: 'One schema migration can silently break another service and corrupt its assumptions.',
    principle: 'Loose coupling and explicit ownership',
    safePlan: 'Publish a supported API or event, migrate consumers in compatibility mode, then revoke direct table access.',
    refactors: [
      { id: 'contract', label: 'Publish a versioned contract', detail: 'Move consumers to an owned API or event.', effective: true, result: 'Consumers depend on supported behavior instead of private storage.' },
      { id: 'replica', label: 'Give everyone a read replica', detail: 'Keep the shared schema but reduce load.', effective: false, result: 'Load may improve, but ownership and migration coupling remain.' },
    ],
  },
  {
    id: 'critical-chain',
    label: 'Optional service sits on checkout',
    symptom: 'A recommendation, email, or analytics timeout rejects a valid order.',
    failure: 'A non-critical outage becomes a customer-visible payment failure.',
    principle: 'Graceful degradation and bounded dependency failure',
    safePlan: 'Set a timeout, serve a defined fallback, emit telemetry, and keep the authoritative order path independent.',
    refactors: [
      { id: 'fallback', label: 'Add a timeout and bounded fallback', detail: 'Continue checkout without optional enrichment.', effective: true, result: 'The dependency can fail visibly without controlling the critical task.' },
      { id: 'retry', label: 'Retry until the dependency responds', detail: 'Wait for a successful recommendation before checkout.', effective: false, result: 'Retries can amplify the outage and still block the user.' },
    ],
  },
  {
    id: 'god-module',
    label: 'One module owns policy and orchestration',
    symptom: 'A handler validates orders, prices them, sends notifications, and formats responses.',
    failure: 'An unrelated policy edit increases regression risk across the entire request path.',
    principle: 'Single responsibility with extension points',
    safePlan: 'Extract the independent policy behind a focused contract, keep orchestration stable, and cover old and new behavior with contract tests.',
    refactors: [
      { id: 'extract', label: 'Extract the changing policy', detail: 'Give rules one cohesive owner and stable input/output.', effective: true, result: 'A policy variation changes its own boundary rather than the entire handler.' },
      { id: 'inheritance', label: 'Add a subclass for every variation', detail: 'Spread behavior across a growing inheritance tree.', effective: false, result: 'The variation remains coupled to unrelated orchestration and becomes harder to trace.' },
    ],
  },
  {
    id: 'broad-token',
    label: 'A worker uses an administrator token',
    symptom: 'A queue consumer can read customer data and administer unrelated queues.',
    failure: 'One leaked credential has the authority to damage a broad part of the system.',
    principle: 'Least privilege and defense in depth',
    safePlan: 'Issue a task-scoped identity, enforce authorization at the asset, audit access, and rehearse revocation.',
    refactors: [
      { id: 'scoped-token', label: 'Issue a task-scoped identity', detail: 'Grant publish access only to the required queue.', effective: true, result: 'A compromised worker is constrained to the narrow task it performs.' },
      { id: 'rotate', label: 'Rotate the administrator token more often', detail: 'Keep broad privileges but shorten token life.', effective: false, result: 'Rotation helps recovery but does not reduce the token’s blast radius.' },
    ],
  },
];

export default function DesignPrinciplesSmellRefactoringLab() {
  const [smellId, setSmellId] = useState<SmellId>('critical-chain');
  const [refactorId, setRefactorId] = useState('fallback');
  const [compatibilityTest, setCompatibilityTest] = useState(true);
  const [operationalSignal, setOperationalSignal] = useState(true);
  const smell = smells.find((item) => item.id === smellId) ?? smells[0];
  const refactor = smell.refactors.find((item) => item.id === refactorId) ?? smell.refactors[0];
  const ready = refactor.effective && compatibilityTest && operationalSignal;
  const guardCount = Number(compatibilityTest) + Number(operationalSignal);
  const readiness = useMemo(() => (ready ? 'Ready to stage' : refactor.effective ? 'Mechanism needs guards' : 'Failure moved, not removed'), [ready, refactor.effective]);

  const selectSmell = (id: SmellId) => {
    const next = smells.find((item) => item.id === id) ?? smells[0];
    setSmellId(id);
    setRefactorId(next.refactors[0].id);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Architecture smell lab"
        title="Refactor the failure path, not only the code shape"
        description="Select a smell and proposed refactor. A useful change needs the right principle plus migration and operational guards that preserve behavior while it rolls out."
        icon={Wrench}
        accent="amber"
        onReset={() => {
          setSmellId('critical-chain');
          setRefactorId('fallback');
          setCompatibilityTest(true);
          setOperationalSignal(true);
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">1. Architecture smell</legend>
              <div className="mt-3 space-y-2">
                {smells.map((item) => (
                  <LabChoice key={item.id} selected={smell.id === item.id} label={item.label} detail={item.symptom} icon={Siren} accent="amber" onClick={() => selectSmell(item.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">2. Proposed refactor</legend>
              <div className="mt-3 space-y-2">
                {smell.refactors.map((item) => (
                  <LabChoice key={item.id} selected={refactor.id === item.id} label={item.label} detail={item.detail} icon={GitFork} accent={item.effective ? 'emerald' : 'rose'} onClick={() => setRefactorId(item.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">3. Migration guards</legend>
              <div className="mt-3 space-y-3">
                <GuardToggle checked={compatibilityTest} onChange={setCompatibilityTest} label="Prove old and new behavior" detail="Use a contract or compatibility test before cutover." />
                <GuardToggle checked={operationalSignal} onChange={setOperationalSignal} label="Observe the new failure mode" detail="Alert on fallback use, denied access, or migration errors." />
              </div>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric label="Principle under test" value={smell.principle} detail="The protection this refactor must actually provide." icon={ShieldCheck} tone="amber" />
            <LabMetric label="Migration guards" value={`${guardCount}/2`} detail={compatibilityTest && operationalSignal ? 'Behavior and production signals are covered.' : 'A rollout guard is still missing.'} icon={CheckCircle2} tone={guardCount === 2 ? 'emerald' : 'rose'} />
          </div>
          <section className="mt-5 border-l-4 border-rose-500 bg-rose-50 px-4 py-4 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Current failure behavior</p>
            <p className="mt-2 text-lg font-semibold leading-7">{smell.failure}</p>
          </section>
          <section className={`mt-5 border p-5 ${ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {ready ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-lg font-semibold">{readiness}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">{refactor.result}</p>
                <p className="mt-3 text-sm leading-6"><strong>Safe rollout:</strong> {smell.safePlan}</p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function GuardToggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left dark:border-neutral-800 dark:bg-neutral-950">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600" />
      <span>
        <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</span>
      </span>
    </label>
  );
}
