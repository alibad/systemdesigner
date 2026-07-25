'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PromiseId = 'checkout' | 'delivery' | 'search';
type SignalId = 'success-ratio' | 'latency-percentile' | 'freshness-lag' | 'cpu' | 'queue-depth';

type PromiseDefinition = {
  id: PromiseId;
  label: string;
  detail: string;
  objective: string;
  owner: string;
  bestSignal: SignalId;
};

type Signal = {
  id: SignalId;
  label: string;
  detail: string;
  kind: 'Outcome' | 'Diagnostic';
  icon: LucideIcon;
};

const promises: PromiseDefinition[] = [
  {
    id: 'checkout',
    label: 'Complete checkout',
    detail: 'A customer submits payment and receives a confirmed order within 30 seconds.',
    objective: 'At least 99.9% of eligible payment attempts succeed.',
    owner: 'Checkout service',
    bestSignal: 'success-ratio',
  },
  {
    id: 'delivery',
    label: 'See an accepted update',
    detail: 'An accepted order update becomes visible to the customer within five minutes.',
    objective: 'At least 99% of accepted updates are fresh within five minutes.',
    owner: 'Delivery pipeline',
    bestSignal: 'freshness-lag',
  },
  {
    id: 'search',
    label: 'Receive a timely search result',
    detail: 'A customer sees a result page within 800 milliseconds after sending a search.',
    objective: 'At least 95% of eligible searches finish below 800 milliseconds.',
    owner: 'Search API',
    bestSignal: 'latency-percentile',
  },
];

const signals: Signal[] = [
  {
    id: 'success-ratio',
    label: 'Successful eligible events',
    detail: 'Successes divided by all eligible attempts in the same window.',
    kind: 'Outcome',
    icon: BadgeCheck,
  },
  {
    id: 'latency-percentile',
    label: 'Latency below the user boundary',
    detail: 'The share of eligible requests that finish within the promised time.',
    kind: 'Outcome',
    icon: Clock3,
  },
  {
    id: 'freshness-lag',
    label: 'End-to-end freshness lag',
    detail: 'Accepted events that become visible before the freshness deadline.',
    kind: 'Outcome',
    icon: Activity,
  },
  {
    id: 'cpu',
    label: 'Application CPU utilization',
    detail: 'Useful capacity evidence, but not proof of a customer outcome.',
    kind: 'Diagnostic',
    icon: Cpu,
  },
  {
    id: 'queue-depth',
    label: 'Queue depth',
    detail: 'Useful backlog evidence, but the user can still be within the deadline.',
    kind: 'Diagnostic',
    icon: Database,
  },
];

function signalResult(promise: PromiseDefinition, signal: Signal) {
  if (signal.id === promise.bestSignal) {
    const formulas: Record<PromiseId, string> = {
      checkout: 'successful payment authorizations / eligible payment attempts',
      delivery: 'accepted updates visible within 5 minutes / eligible accepted updates',
      search: 'eligible searches below 800 ms / eligible searches',
    };
    return {
      fit: 'Direct SLI',
      tone: 'emerald' as const,
      formula: formulas[promise.id],
      explanation: `This measurement directly answers whether users receive the promise. It can anchor ${promise.objective.toLowerCase()}`,
      alert: 'Page when sustained error-budget risk is high; break down by route, region, release, and dependency.',
    };
  }

  if (signal.kind === 'Diagnostic') {
    return {
      fit: 'Diagnostic signal',
      tone: 'amber' as const,
      formula: 'observed resource or backlog value',
      explanation: `This can explain why ${promise.label.toLowerCase()} degrades, but it cannot show whether the customer promise was met.`,
      alert: 'Keep it beside the SLI for diagnosis. Page only when its own saturation creates an immediate, proven failure boundary.',
    };
  }

  return {
    fit: 'Partial fit',
    tone: 'rose' as const,
    formula: 'valid measurement, wrong primary promise',
    explanation: `This is a useful outcome signal for another promise, but it does not directly prove ${promise.label.toLowerCase()}.`,
    alert: 'Use it as a secondary guardrail or choose the signal that measures this promise directly.',
  };
}

export default function MonitoringMetricsSliSelectionLab() {
  const [promiseId, setPromiseId] = useState<PromiseId>('checkout');
  const [signalId, setSignalId] = useState<SignalId>('success-ratio');

  const promise = promises.find((item) => item.id === promiseId) ?? promises[0];
  const signal = signals.find((item) => item.id === signalId) ?? signals[0];
  const result = useMemo(() => signalResult(promise, signal), [promise, signal]);

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="SLI selection lab"
        title="Measure the promise, not the machinery"
        description="Choose a customer promise and a candidate signal. The result identifies whether the signal is an SLI, a helpful diagnostic, or a mismatch."
        icon={Target}
        accent="violet"
        onReset={() => {
          setPromiseId('checkout');
          setSignalId('success-ratio');
        }}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. User promise
              </legend>
              <div className="mt-3 space-y-2">
                {promises.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={promiseId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Users}
                    accent="violet"
                    onClick={() => setPromiseId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Candidate measurement
              </legend>
              <div className="mt-3 space-y-2">
                {signals.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={signalId === item.id}
                    label={item.label}
                    detail={`${item.kind}: ${item.detail}`}
                    icon={item.icon}
                    accent={item.kind === 'Outcome' ? 'blue' : 'amber'}
                    onClick={() => setSignalId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric
              label="Decision"
              value={result.fit}
              detail="A primary SLI must directly represent the user-visible promise."
              icon={result.tone === 'emerald' ? BadgeCheck : CircleAlert}
              tone={result.tone}
            />
            <LabMetric
              label="Operational owner"
              value={promise.owner}
              detail={promise.objective}
              icon={ChartNoAxesCombined}
              tone="blue"
            />
          </div>

          <section className="mt-5 border-l-4 border-violet-500 bg-violet-50 px-4 py-4 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50">
            <p className="text-xs font-semibold uppercase opacity-75">Selected SLI expression</p>
            <p className="mt-2 break-words font-mono text-sm font-semibold leading-6">{result.formula}</p>
            <p className="mt-3 text-sm leading-6 opacity-85">{result.explanation}</p>
          </section>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Gauge aria-hidden="true" className="h-4 w-4" />
              Alert and dashboard role
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.alert}</p>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
