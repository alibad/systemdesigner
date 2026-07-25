'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudCog,
  KeyRound,
  Network,
  Scale,
  ShieldCheck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { LabChoice, LabMetric, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

type PressureId = 'change' | 'dependency' | 'traffic' | 'access' | 'integrity';
type BoundaryId = 'module' | 'service' | 'data' | 'access';
type Complexity = 'low' | 'balanced' | 'high';

type Pressure = {
  id: PressureId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const pressures: Pressure[] = [
  { id: 'change', label: 'Change breaks unrelated code', detail: 'Rules and delivery paths move together.', icon: Workflow },
  { id: 'dependency', label: 'A dependency blocks the critical path', detail: 'One timeout makes a user task fail.', icon: Network },
  { id: 'traffic', label: 'One worker cannot meet demand', detail: 'Load exceeds an instance budget.', icon: CloudCog },
  { id: 'access', label: 'A credential can do too much', detail: 'A compromise has a broad blast radius.', icon: KeyRound },
  { id: 'integrity', label: 'Invalid or stale data changes outcomes', detail: 'Errors reach an authoritative record.', icon: ShieldCheck },
];

const boundaries: Array<{ id: BoundaryId; label: string; detail: string }> = [
  { id: 'module', label: 'Module', detail: 'Code ownership and change scope' },
  { id: 'service', label: 'Service', detail: 'Runtime contracts and dependencies' },
  { id: 'data', label: 'Data boundary', detail: 'Validation and authoritative state' },
  { id: 'access', label: 'Access boundary', detail: 'Identity, scope, and enforcement' },
];

const complexityOptions: Array<{ id: Complexity; label: string; detail: string }> = [
  { id: 'low', label: 'Keep it simple', detail: 'Prefer a narrow local change.' },
  { id: 'balanced', label: 'Accept a measured cost', detail: 'Add only the mechanism the risk needs.' },
  { id: 'high', label: 'Protect a high-cost path', detail: 'More coordination is justified by the impact.' },
];

function recommendationFor(pressure: PressureId, boundary: BoundaryId, complexity: Complexity) {
  const byPressure = {
    change: {
      principle: 'Single responsibility, then open for extension',
      invariant: 'A new policy changes its own module and registration, not unrelated orchestration.',
      evidence: 'Track the files and owners touched by each policy change.',
      cost: 'An interface can obscure a simple flow when variations are not real.',
      action: boundary === 'module' ? 'Extract the policy from the request handler.' : 'Keep the variation behind a stable service contract.',
    },
    dependency: {
      principle: 'Loose coupling with graceful degradation',
      invariant: 'An optional dependency outage cannot block the critical user task.',
      evidence: 'Measure timeout rate and successful degraded completions.',
      cost: 'Fallbacks can be stale and need explicit ownership.',
      action: boundary === 'service' ? 'Set a timeout, use a versioned contract, and define a bounded fallback.' : 'Separate optional work from the authoritative path.',
    },
    traffic: {
      principle: 'Horizontal scaling with stateless workers',
      invariant: 'Removing one worker still leaves enough capacity for the latency target.',
      evidence: 'Observe p95 latency, utilization, queue depth, and headroom after a worker loss.',
      cost: 'State placement, retries, and distributed diagnosis add operational work.',
      action: boundary === 'data' ? 'Externalize worker state and inspect the store as the next bottleneck.' : 'Make workers interchangeable behind a load balancer.',
    },
    access: {
      principle: 'Least privilege with defense in depth',
      invariant: 'A caller can perform only its explicit task, even when one control fails.',
      evidence: 'Audit grants, denied actions, token age, and revocation time.',
      cost: 'Fine-grained policy needs lifecycle and review discipline.',
      action: boundary === 'access' ? 'Issue a scoped identity and enforce it at each sensitive operation.' : 'Move authorization to the boundary nearest the protected asset.',
    },
    integrity: {
      principle: 'Fail fast with deliberate consistency',
      invariant: 'Invalid state cannot reach the authoritative record or downstream consumers.',
      evidence: 'Track validation failures, reconciliation lag, and duplicate side effects.',
      cost: 'Validation and coordination can add latency or reduce availability.',
      action: boundary === 'data' ? 'Validate before commit and make one store authoritative.' : 'Reject invalid inputs at the boundary before irreversible work.',
    },
  } as const;

  const recommendation = byPressure[pressure];
  const posture = complexity === 'low'
    ? 'Start with the narrowest boundary; do not introduce distributed machinery yet.'
    : complexity === 'high'
      ? 'The impact justifies explicit redundancy, observability, and a rehearsed recovery path.'
      : 'Add the smallest mechanism that can be measured against the stated invariant.';

  return { ...recommendation, posture };
}

export default function DesignPrinciplesConstraintSelector() {
  const [pressure, setPressure] = useState<PressureId>('dependency');
  const [boundary, setBoundary] = useState<BoundaryId>('service');
  const [complexity, setComplexity] = useState<Complexity>('balanced');
  const result = useMemo(() => recommendationFor(pressure, boundary, complexity), [boundary, complexity, pressure]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Constraint-driven selector"
        title="Choose the property that needs protection"
        description="Change the observed pressure, the boundary, and the complexity posture. The recommendation names a principle, an invariant, and the cost that must remain visible."
        icon={Scale}
        accent="blue"
        onReset={() => {
          setPressure('dependency');
          setBoundary('service');
          setComplexity('balanced');
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">1. Observed pressure</legend>
              <div className="mt-3 space-y-2">
                {pressures.map((item) => (
                  <LabChoice key={item.id} selected={pressure === item.id} label={item.label} detail={item.detail} icon={item.icon} accent="blue" onClick={() => setPressure(item.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">2. Smallest boundary</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {boundaries.map((item) => (
                  <LabChoice key={item.id} selected={boundary === item.id} label={item.label} detail={item.detail} accent="violet" onClick={() => setBoundary(item.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">3. Complexity posture</legend>
              <div className="mt-3 space-y-2">
                {complexityOptions.map((item) => (
                  <LabChoice key={item.id} selected={complexity === item.id} label={item.label} detail={item.detail} accent="amber" onClick={() => setComplexity(item.id)} />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric label="Recommended principle" value={result.principle} detail="Chosen from the pressure, not a pattern catalog." icon={CheckCircle2} tone="blue" />
            <LabMetric label="Boundary action" value={boundaries.find((item) => item.id === boundary)?.label ?? 'Boundary'} detail={result.action} icon={ShieldCheck} tone="violet" />
          </div>
          <section className="mt-5 border-l-4 border-blue-500 bg-blue-50 px-4 py-4 text-blue-950 dark:bg-blue-950/30 dark:text-blue-50">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Testable invariant</p>
            <p className="mt-2 text-lg font-semibold leading-7">{result.invariant}</p>
            <p className="mt-3 text-sm leading-6 opacity-80"><strong>Evidence:</strong> {result.evidence}</p>
          </section>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <section className="border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
              <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle aria-hidden="true" className="h-4 w-4" /> Cost to accept</div>
              <p className="mt-2 text-sm leading-6 opacity-85">{result.cost}</p>
            </section>
            <section className="border border-neutral-200 bg-neutral-50 p-4 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
              <p className="text-sm font-semibold">Decision posture</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.posture}</p>
            </section>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
