'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChartNoAxesCombined,
  Clock3,
  DatabaseZap,
  Gauge,
  GitCommitHorizontal,
  Siren,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type IncidentId = 'deploy-errors' | 'dependency-timeout' | 'backlog-growth' | 'brief-retry-spike';
type Threshold = 0.5 | 1 | 2 | 5;
type WindowMinutes = 1 | 5 | 10;

type Incident = {
  id: IncidentId;
  label: string;
  detail: string;
  errorRate: number;
  durationMinutes: number;
  diagnosis: string;
  nextSignal: string;
  action: string;
  icon: LucideIcon;
};

const incidents: Incident[] = [
  {
    id: 'deploy-errors',
    label: 'Bad release raises checkout errors',
    detail: '4.2% of eligible payments fail for 12 minutes after a deployment.',
    errorRate: 4.2,
    durationMinutes: 12,
    diagnosis: 'The release version is the leading suspect because the error increase begins with the rollout.',
    nextSignal: 'Break down failed authorizations by release version and payment-provider response code.',
    action: 'Stop promotion and route new traffic to the previous healthy release while preserving incident evidence.',
    icon: GitCommitHorizontal,
  },
  {
    id: 'dependency-timeout',
    label: 'Payment provider slows down',
    detail: '1.4% of eligible payments time out for 18 minutes; application CPU stays normal.',
    errorRate: 1.4,
    durationMinutes: 18,
    diagnosis: 'A downstream dependency is likely failing because the user SLI moves without local resource pressure.',
    nextSignal: 'Compare provider timeout ratio, connection wait time, and fallback completion rate.',
    action: 'Apply the bounded fallback or provider failover path, then reduce retries that amplify the dependency.',
    icon: DatabaseZap,
  },
  {
    id: 'backlog-growth',
    label: 'Workers fall behind accepted updates',
    detail: '2.3% of updates miss the five-minute freshness deadline for 14 minutes.',
    errorRate: 2.3,
    durationMinutes: 14,
    diagnosis: 'Backlog pressure is now customer-visible because events have crossed the freshness promise.',
    nextSignal: 'Inspect oldest-message age, consumer throughput, dead-letter growth, and recent worker changes.',
    action: 'Add safe consumer capacity or pause the expensive producer path while the oldest-message age recovers.',
    icon: Gauge,
  },
  {
    id: 'brief-retry-spike',
    label: 'Short retry spike after a network flap',
    detail: '2.5% of eligible requests fail for 45 seconds, then recover without intervention.',
    errorRate: 2.5,
    durationMinutes: 0.75,
    diagnosis: 'The spike is real evidence, but its short duration may be a dashboard investigation rather than a page.',
    nextSignal: 'Check retry volume, network errors, and whether a second window remains elevated.',
    action: 'Record and review the event; page only if it persists, repeats, or burns the objective at the chosen rate.',
    icon: TimerReset,
  },
];

const thresholds: Threshold[] = [0.5, 1, 2, 5];
const windows: WindowMinutes[] = [1, 5, 10];

function thresholdLabel(value: Threshold) {
  return `${value}% failure`;
}

export default function MonitoringMetricsIncidentThresholdLab() {
  const [incidentId, setIncidentId] = useState<IncidentId>('deploy-errors');
  const [threshold, setThreshold] = useState<Threshold>(1);
  const [windowMinutes, setWindowMinutes] = useState<WindowMinutes>(5);

  const incident = incidents.find((item) => item.id === incidentId) ?? incidents[0];
  const result = useMemo(() => {
    const exceedsThreshold = incident.errorRate >= threshold;
    const persists = incident.durationMinutes >= windowMinutes;
    const page = exceedsThreshold && persists;
    const failedPerThousand = Math.round(incident.errorRate * 10);
    const reason = !exceedsThreshold
      ? `The observed ${incident.errorRate}% failure rate stays below the selected ${threshold}% threshold.`
      : !persists
        ? `The condition clears after ${incident.durationMinutes < 1 ? 'less than one minute' : `${incident.durationMinutes} minutes`}, before the selected ${windowMinutes}-minute confirmation window.`
        : `The condition is above ${threshold}% and lasts at least ${windowMinutes} minutes, so it threatens the customer promise long enough to page.`;
    return { exceedsThreshold, persists, page, failedPerThousand, reason };
  }, [incident, threshold, windowMinutes]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Incident threshold lab"
        title="Page on sustained customer risk"
        description="Inject a failure, then set a threshold and confirmation window. A useful policy names why it pages and which diagnostic evidence comes next."
        icon={Siren}
        accent="rose"
        onReset={() => {
          setIncidentId('deploy-errors');
          setThreshold(1);
          setWindowMinutes(5);
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject an incident
              </legend>
              <div className="mt-3 space-y-2">
                {incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={incidentId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.icon}
                    accent="rose"
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Failure threshold
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {thresholds.map((value) => (
                  <LabChoice
                    key={value}
                    selected={threshold === value}
                    label={thresholdLabel(value)}
                    detail="Failure ratio in the selected SLI window"
                    accent="amber"
                    onClick={() => setThreshold(value)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Confirmation window
              </legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {windows.map((value) => (
                  <LabChoice
                    key={value}
                    selected={windowMinutes === value}
                    label={`${value} min`}
                    detail="Sustained before paging"
                    accent="blue"
                    onClick={() => setWindowMinutes(value)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Observed failure"
              value={`${incident.errorRate}%`}
              detail={`${result.failedPerThousand} failed events per 1,000 eligible events`}
              icon={AlertTriangle}
              tone={result.exceedsThreshold ? 'rose' : 'emerald'}
            />
            <LabMetric
              label="Observed duration"
              value={incident.durationMinutes < 1 ? '45 sec' : `${incident.durationMinutes} min`}
              detail={`Must persist for ${windowMinutes} min`}
              icon={Clock3}
              tone={result.persists ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Alert decision"
              value={result.page ? 'Page now' : 'Do not page'}
              detail={result.page ? 'Actionable customer risk' : 'Keep evidence on the dashboard'}
              icon={result.page ? Siren : BadgeCheck}
              tone={result.page ? 'rose' : 'emerald'}
            />
          </div>

          <section className={`mt-5 border-l-4 px-4 py-4 ${result.page ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
            <p className="text-xs font-semibold uppercase opacity-75">Policy explanation</p>
            <p className="mt-2 text-sm leading-6 opacity-90">{result.reason}</p>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Likely failure boundary</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{incident.diagnosis}</p>
              <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Next evidence</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{incident.nextSignal}</p>
            </section>
            <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="text-sm font-semibold">First operator action</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{incident.action}</p>
            </section>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
