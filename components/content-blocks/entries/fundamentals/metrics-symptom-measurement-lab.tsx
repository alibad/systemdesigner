'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, Gauge, Waypoints } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type SymptomId = 'slow-tail' | 'fast-errors' | 'growing-queue' | 'dependency-pressure';
type MeasurementId = 'p99' | 'error-rate' | 'queue-age' | 'pool-wait';

type Symptom = {
  label: string;
  detail: string;
  primary: MeasurementId;
  evidence: string;
  nextStep: string;
};

const symptoms: Record<SymptomId, Symptom> = {
  'slow-tail': {
    label: 'Only a small group reports long waits',
    detail: 'The average API latency is 110 ms, but checkout complaints rise during the busiest five minutes.',
    primary: 'p99',
    evidence: 'Segment the end-to-end request path by P95/P99 and compare it with the same interval of traffic and dependency timing.',
    nextStep: 'Trace the slow cohort. A low average does not disprove a tail problem.',
  },
  'fast-errors': {
    label: 'Requests fail quickly after a deployment',
    detail: 'Latency falls because a validation or dependency failure returns immediately, while completed orders drop.',
    primary: 'error-rate',
    evidence: 'Measure failed outcomes by route, status class, and deployment version, then compare attempts with successful completions.',
    nextStep: 'Roll back or disable the failing path before optimizing its response time.',
  },
  'growing-queue': {
    label: 'Accepted work keeps getting older',
    detail: 'Incoming RPS rises, completed RPS stays flat, and background jobs are still technically succeeding.',
    primary: 'queue-age',
    evidence: 'Measure queue age and depth beside arrivals and completions. Depth alone can be normal when consumers drain quickly.',
    nextStep: 'Protect the constrained consumer, shed low-priority work, or add capacity with verified downstream headroom.',
  },
  'dependency-pressure': {
    label: 'Application CPU is normal, yet timeouts rise',
    detail: 'Many requests wait before a database call even begins; adding web servers has not changed throughput.',
    primary: 'pool-wait',
    evidence: 'Measure connection-pool wait time, checked-out connections, query latency, and database saturation in one time window.',
    nextStep: 'Treat the pool or database as the suspected constraint, then test a targeted change.',
  },
};

const measurements: Record<MeasurementId, { label: string; detail: string; icon: typeof Clock3 }> = {
  p99: { label: 'End-to-end P99 latency', detail: 'The slowest one percent of the user path.', icon: Clock3 },
  'error-rate': { label: 'Failed-outcome rate', detail: 'Failures per attempted user action, not just fast HTTP responses.', icon: AlertTriangle },
  'queue-age': { label: 'Queue age and depth', detail: 'How long accepted work has waited, plus how much is waiting.', icon: Waypoints },
  'pool-wait': { label: 'Connection-pool wait', detail: 'Time spent waiting for a bounded downstream connection.', icon: Database },
};

const symptomIds = Object.keys(symptoms) as SymptomId[];
const measurementIds = Object.keys(measurements) as MeasurementId[];

export default function PerformanceMetricsSymptomMeasurementLab() {
  const [symptomId, setSymptomId] = useState<SymptomId>('slow-tail');
  const [measurementId, setMeasurementId] = useState<MeasurementId>('p99');
  const symptom = symptoms[symptomId];
  const selected = measurements[measurementId];
  const correct = measurementId === symptom.primary;
  const recommended = measurements[symptom.primary];

  const diagnosis = useMemo(() => correct
    ? `This is the leading measurement because it tests the failure described. ${symptom.evidence}`
    : `${selected.label} can add context, but it does not directly test this symptom first. Start with ${recommended.label.toLowerCase()}.`, [correct, recommended.label, selected.label, symptom.evidence]);

  const reset = () => {
    setSymptomId('slow-tail');
    setMeasurementId('p99');
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Failure symptom and measurement lab"
        title="Choose evidence that can disprove the first hypothesis"
        description="Select a user-visible symptom, then choose the first measurement worth opening. A metric is useful when it changes the next operational decision, not when it is merely available on a dashboard."
        icon={Activity}
        accent="amber"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Observed symptom</legend>
              <div className="mt-3 space-y-2">
                {symptomIds.map((id) => (
                  <LabChoice key={id} selected={symptomId === id} label={symptoms[id].label} detail={symptoms[id].detail} icon={AlertTriangle} accent="amber" onClick={() => setSymptomId(id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. First measurement</legend>
              <div className="mt-3 space-y-2">
                {measurementIds.map((id) => {
                  const item = measurements[id];
                  return <LabChoice key={id} selected={measurementId === id} label={item.label} detail={item.detail} icon={item.icon} accent={id === symptom.primary ? 'emerald' : 'blue'} onClick={() => setMeasurementId(id)} />;
                })}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div aria-live="polite">
          <div className={`rounded-md border p-5 ${correct ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {correct ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-lg font-semibold">{correct ? 'Evidence matches the symptom' : 'Measure the failure more directly'}</p>
                <p className="mt-2 text-sm leading-6 opacity-90">{diagnosis}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LabMetric label="Selected measurement" value={selected.label} detail={selected.detail} icon={selected.icon} tone={correct ? 'emerald' : 'amber'} />
            <LabMetric label="Next operational move" value={correct ? 'Collect correlated evidence' : 'Change the first metric'} detail={symptom.nextStep} icon={Gauge} tone={correct ? 'blue' : 'rose'} />
          </div>

          <section className="mt-5 rounded-md border-l-4 border-rose-500 bg-rose-50 p-4 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50">
            <p className="text-xs font-semibold uppercase opacity-75">Failure behavior under investigation</p>
            <p className="mt-2 text-lg font-semibold leading-7">{symptom.detail}</p>
          </section>

          <p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">After the first measurement points to a cause, add the companion signals that distinguish load, failure, and saturation. Do not alert from one metric in isolation: a fast error, a full queue, and a slow successful request require different actions.</p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
