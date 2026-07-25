'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseZap,
  GitCompareArrows,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Siren,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  invariant: string;
  failureMode: string;
  baseRiskPercent: Record<string, number>;
  baseAbortPercent: Record<string, number>;
  guardEffects: Record<string, { riskMultiplier: number; waitMs: number; explanation: string }>;
};
type IsolationLevel = { id: string; label: string; detail: string; snapshot: string };
type Guard = { id: string; label: string; detail: string };
type IsolationData = {
  title: string;
  description: string;
  defaults: { scenarioId: string; isolationId: string; guardId: string; concurrency: number };
  concurrency: { min: number; max: number; step: number };
  scenarios: Scenario[];
  isolationLevels: IsolationLevel[];
  guards: Guard[];
};

const BLOCK_ID = 'technology/postgresql-isolation-lab';

function isIsolationData(value: unknown): value is IsolationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<IsolationData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.isolationId
      && candidate.defaults.guardId
      && typeof candidate.defaults.concurrency === 'number'
      && typeof candidate.concurrency?.min === 'number'
      && typeof candidate.concurrency.max === 'number'
      && typeof candidate.concurrency.step === 'number'
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.isolationLevels)
      && candidate.isolationLevels.length > 0
      && Array.isArray(candidate.guards)
      && candidate.guards.length > 0,
  );
}

export default function PostgreSQLIsolationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<IsolationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No isolation scenario model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isIsolationData(payload)) throw new Error('The isolation model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the isolation lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <IsolationWorkbench data={data} />;
}

function IsolationWorkbench({ data }: { data: IsolationData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [isolationId, setIsolationId] = useState(data.defaults.isolationId);
  const [guardId, setGuardId] = useState(data.defaults.guardId);
  const [concurrency, setConcurrency] = useState(data.defaults.concurrency);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const isolation = data.isolationLevels.find((item) => item.id === isolationId)
    ?? data.isolationLevels[0];
  const guard = data.guards.find((item) => item.id === guardId) ?? data.guards[0];

  const result = useMemo(() => {
    const pressure = Math.max(0.5, concurrency / 8);
    const guardEffect = scenario.guardEffects[guard.id] ?? scenario.guardEffects.none;
    const baseRisk = scenario.baseRiskPercent[isolation.id] ?? 0;
    const baseAbort = scenario.baseAbortPercent[isolation.id] ?? 0;
    const anomalyRisk = Math.min(99, baseRisk * pressure * guardEffect.riskMultiplier);
    const abortRisk = Math.min(95, baseAbort * pressure);
    const retryExpected = abortRisk > 0;
    const waitMs = Math.round(guardEffect.waitMs * Math.max(1, concurrency / 4));
    const correct = anomalyRisk < 1;
    const available = abortRisk < 20 || guard.id === 'retry-loop';

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'The invariant is protected under this concurrency';
    let detail = guardEffect.explanation;

    if (!correct) {
      tone = 'rose';
      verdict = `${scenario.failureMode} remains possible`;
      detail = `${guardEffect.explanation} The modeled anomaly risk rises as more transactions overlap.`;
    } else if (retryExpected && guard.id !== 'retry-loop') {
      tone = 'amber';
      verdict = 'Correctness is protected, but aborted work is not recovered';
      detail = 'PostgreSQL can reject conflicting work at this isolation level. The application must retry the complete transaction with a fresh snapshot and bounded backoff.';
    } else if (waitMs > 250) {
      tone = 'amber';
      verdict = 'The invariant is safe, but lock contention dominates latency';
      detail = 'The guard serializes competing writers. Shorten the transaction, lock rows in one order, and measure lock wait at peak concurrency.';
    }

    return {
      abortRisk,
      anomalyRisk,
      available,
      correct,
      detail,
      retryExpected,
      tone,
      verdict,
      waitMs,
    };
  }, [concurrency, guard, isolation, scenario]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setIsolationId(data.defaults.isolationId);
    setGuardId(data.defaults.guardId);
    setConcurrency(data.defaults.concurrency);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="MVCC and isolation lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Concurrent operation"
                items={data.scenarios}
                selectedId={scenario.id}
                icon={Users}
                accent="rose"
                onSelect={setScenarioId}
              />
              <ChoiceGroup
                label="2. Isolation level"
                items={data.isolationLevels}
                selectedId={isolation.id}
                icon={DatabaseZap}
                accent="violet"
                onSelect={setIsolationId}
              />
              <ChoiceGroup
                label="3. Application guard"
                items={data.guards}
                selectedId={guard.id}
                icon={LockKeyhole}
                accent="blue"
                onSelect={setGuardId}
              />
              <LabRange
                label="Overlapping transactions"
                value={concurrency}
                output={String(concurrency)}
                min={data.concurrency.min}
                max={data.concurrency.max}
                step={data.concurrency.step}
                lowLabel="Light contention"
                highLabel="Hot invariant"
                accent="amber"
                onChange={setConcurrency}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
              <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Invariant to protect</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-violet-950 dark:text-violet-50">{scenario.invariant}</p>
            </section>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Anomaly risk"
                value={`${result.anomalyRisk.toFixed(0)}%`}
                detail="Modeled overlapping conflict"
                icon={Siren}
                tone={result.anomalyRisk < 1 ? 'emerald' : result.anomalyRisk < 15 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Abort risk"
                value={`${result.abortRisk.toFixed(0)}%`}
                detail="Transaction must be retried"
                icon={RefreshCcw}
                tone={result.abortRisk < 5 ? 'emerald' : result.abortRisk < 20 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Lock wait"
                value={`${result.waitMs} ms`}
                detail="Estimated serialization delay"
                icon={Clock3}
                tone={result.waitMs < 80 ? 'cyan' : result.waitMs < 250 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Outcome"
                value={result.correct ? 'Correct' : 'Unsafe'}
                detail={result.available ? 'Request path can make progress' : 'Retries or admission control required'}
                icon={ShieldCheck}
                tone={result.correct && result.available ? 'emerald' : result.correct ? 'amber' : 'rose'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="grid gap-px bg-neutral-200 sm:grid-cols-3 dark:bg-neutral-800">
                <TraceStep label="Snapshot" value={isolation.snapshot} />
                <TraceStep label="Conflict" value={`${concurrency} transactions overlap`} />
                <TraceStep
                  label="Commit boundary"
                  value={result.anomalyRisk < 1 ? 'Invariant preserved' : scenario.failureMode}
                />
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends { id: string; label: string; detail: string }>({
  label,
  items,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: T[];
  selectedId: string;
  icon: typeof Users;
  accent: 'rose' | 'violet' | 'blue';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function TraceStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-white p-4 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-neutral-900 dark:text-white">{value}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <DatabaseZap aria-hidden="true" className="h-5 w-5 animate-pulse motion-reduce:animate-none" />
        Loading the transaction scenarios...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Isolation lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
