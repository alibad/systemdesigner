'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CloudOff,
  FileClock,
  Gauge,
  LockKeyhole,
  Radar,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  Zap,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type IncidentId = 'features' | 'scorer' | 'attack';
type PolicyId = 'open' | 'closed' | 'rules' | 'review';

type Incident = {
  id: IncidentId;
  label: string;
  detail: string;
  icon: typeof CloudOff;
  recommended: PolicyId;
};

type Policy = {
  id: PolicyId;
  label: string;
  detail: string;
  icon: typeof Zap;
};

const incidents: Incident[] = [
  {
    id: 'features',
    label: 'Feature store timeout',
    detail: 'Velocity and device signals miss their deadline for one region.',
    icon: CloudOff,
    recommended: 'rules',
  },
  {
    id: 'scorer',
    label: 'Model scorer unavailable',
    detail: 'The model service exceeds its deadline during zone failover.',
    icon: FileClock,
    recommended: 'rules',
  },
  {
    id: 'attack',
    label: 'Novel attack surge',
    detail: 'Scores shift sharply and the current rules miss a coordinated pattern.',
    icon: Radar,
    recommended: 'review',
  },
];

const policies: Policy[] = [
  {
    id: 'open',
    label: 'Fail open',
    detail: 'Approve affected attempts when risk evidence is incomplete.',
    icon: Zap,
  },
  {
    id: 'closed',
    label: 'Fail closed',
    detail: 'Block every affected attempt until the dependency recovers.',
    icon: LockKeyhole,
  },
  {
    id: 'rules',
    label: 'Versioned rules fallback',
    detail: 'Use fresh request data, cached profiles, and a rehearsed rule snapshot.',
    icon: ShieldCheck,
  },
  {
    id: 'review',
    label: 'Bounded challenge and review',
    detail: 'Challenge high-value uncertainty and admit cases only within queue limits.',
    icon: UserRoundCheck,
  },
];

const policyMetrics: Record<PolicyId, { exposure: number; friction: number; latency: number; audit: number }> = {
  open: { exposure: 78, friction: 4, latency: 18, audit: 38 },
  closed: { exposure: 5, friction: 94, latency: 14, audit: 72 },
  rules: { exposure: 28, friction: 19, latency: 36, audit: 96 },
  review: { exposure: 20, friction: 36, latency: 58, audit: 91 },
};

export default function FraudDetectionDegradedModeLab() {
  const [incidentId, setIncidentId] = useState<IncidentId>('features');
  const [policyId, setPolicyId] = useState<PolicyId>('rules');

  const model = useMemo(() => {
    const incident = incidents.find((item) => item.id === incidentId) ?? incidents[0];
    const policy = policies.find((item) => item.id === policyId) ?? policies[0];
    const base = policyMetrics[policy.id];

    const attackPenalty = incident.id === 'attack' && policy.id === 'rules' ? 24 : 0;
    const stalePenalty = incident.id === 'features' && policy.id === 'review' ? 8 : 0;
    const exposure = Math.min(100, base.exposure + attackPenalty + stalePenalty);
    const friction = Math.min(100, base.friction + (incident.id === 'attack' && policy.id === 'closed' ? 4 : 0));
    const latency = base.latency + (incident.id === 'scorer' && policy.id === 'review' ? 8 : 0);
    const audit = Math.max(0, base.audit - (incident.id === 'attack' && policy.id === 'open' ? 10 : 0));
    const recommended = policy.id === incident.recommended;

    let title = 'Incident contained with bounded degradation';
    let detail =
      'The path remains auditable and avoids turning one dependency failure into universal denial or approval.';
    let tone: 'healthy' | 'warning' | 'danger' = 'healthy';

    if (policy.id === 'open') {
      title = 'Availability hides unacceptable fraud exposure';
      detail = 'Fast approval preserves checkout, but missing evidence becomes a broad, unaudited risk exception.';
      tone = 'danger';
    } else if (policy.id === 'closed') {
      title = 'The risk incident becomes a customer outage';
      detail = 'Fraud exposure is low, but almost every affected legitimate payment is denied.';
      tone = 'danger';
    } else if (!recommended) {
      title = incident.id === 'attack' ? 'Known rules cannot contain a novel pattern' : 'Safe, but more disruptive than necessary';
      detail =
        incident.id === 'attack'
          ? 'Shift suspicious cohorts into bounded challenge and review while responders add targeted controls.'
          : 'The selected policy limits harm, but the versioned rules path gives a faster and more predictable authorization result.';
      tone = 'warning';
    }

    return { incident, policy, exposure, friction, latency, audit, recommended, title, detail, tone };
  }, [incidentId, policyId]);

  const reset = () => {
    setIncidentId('features');
    setPolicyId('rules');
  };

  const outcomeStyle =
    model.tone === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.tone === 'warning'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  const OutcomeIcon = model.tone === 'healthy' ? CheckCircle2 : CircleAlert;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Degraded-mode simulator"
        title="Choose what the payment path does when risk evidence fails"
        description="Inject an incident, then compare fail-open, fail-closed, rules, and bounded-review policies. The fastest response is not automatically the safest one."
        icon={ShieldAlert}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject an incident
              </legend>
              <div className="mt-3 grid gap-2">
                {incidents.map((incident) => (
                  <LabChoice
                    key={incident.id}
                    selected={incident.id === incidentId}
                    label={incident.label}
                    detail={incident.detail}
                    icon={incident.icon}
                    accent="amber"
                    onClick={() => setIncidentId(incident.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            2. Select the authorization playbook
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {policies.map((policy) => (
              <LabChoice
                key={policy.id}
                selected={policy.id === policyId}
                label={policy.label}
                detail={policy.detail}
                icon={policy.icon}
                accent="blue"
                onClick={() => setPolicyId(policy.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Fraud exposure"
            value={`${model.exposure}/100`}
            detail="Relative risk while the incident is active"
            icon={AlertTriangle}
            tone={model.exposure <= 30 ? 'emerald' : model.exposure <= 55 ? 'amber' : 'rose'}
          />
          <LabMetric
            label="Customer friction"
            value={`${model.friction}/100`}
            detail="Challenges, reviews, and legitimate denials"
            icon={Gauge}
            tone={model.friction <= 25 ? 'blue' : model.friction <= 50 ? 'amber' : 'rose'}
          />
          <LabMetric
            label="Decision latency"
            value={`${model.latency} ms`}
            detail="Estimated degraded-path p99 contribution"
            icon={Clock3}
            tone={model.latency <= 60 ? 'cyan' : 'amber'}
          />
          <LabMetric
            label="Audit integrity"
            value={`${model.audit}%`}
            detail="Evidence, version, and reconciliation coverage"
            icon={ShieldCheck}
            tone={model.audit >= 90 ? 'emerald' : model.audit >= 65 ? 'amber' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.78fr)]">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              User-visible path
            </p>
            <div className="mt-4 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                <p className="text-xs font-semibold uppercase opacity-70">Incident</p>
                <p className="mt-1 text-sm font-semibold">{model.incident.label}</p>
              </div>
              <span aria-hidden="true" className="hidden text-neutral-400 sm:block">→</span>
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50">
                <p className="text-xs font-semibold uppercase opacity-70">Policy</p>
                <p className="mt-1 text-sm font-semibold">{model.policy.label}</p>
              </div>
              <span aria-hidden="true" className="hidden text-neutral-400 sm:block">→</span>
              <div className="rounded-md border border-neutral-200 bg-white p-3 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                <p className="text-xs font-semibold uppercase text-neutral-500">Payment</p>
                <p className="mt-1 text-sm font-semibold">
                  {policyId === 'open'
                    ? 'Approve'
                    : policyId === 'closed'
                      ? 'Block'
                      : policyId === 'rules'
                        ? 'Rules decision'
                        : 'Challenge or review'}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
              The degraded action records the missing dependency, policy version, reason code, and whether delayed reconciliation is required.
            </p>
          </div>

          <div className={`rounded-md border p-5 ${outcomeStyle}`} aria-live="polite">
            <OutcomeIcon
              aria-hidden="true"
              className={`h-6 w-6 ${
                model.tone === 'healthy'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : model.tone === 'warning'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-rose-700 dark:text-rose-300'
              }`}
            />
            <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Observed outcome
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.title}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.detail}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
