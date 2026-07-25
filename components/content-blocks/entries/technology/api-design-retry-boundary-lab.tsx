'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  Database,
  FileKey2,
  Network,
  ReceiptText,
  Repeat2,
  SearchCheck,
  Server,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Option = {
  id: string;
  label: string;
  detail: string;
};

type FailurePoint = Option & {
  originalEffects: number;
  clientObserved: string;
};

type RetryPolicy = Option & {
  kind: 'write-same-key' | 'write-new-key' | 'reconcile';
};

type RetryModel = {
  title: string;
  description: string;
  defaults: {
    failureId: string;
    retryPolicyId: string;
    replayStoreId: string;
    retries: number;
  };
  retryBounds: { min: number; max: number; step: number };
  failurePoints: FailurePoint[];
  retryPolicies: RetryPolicy[];
  replayStores: Option[];
};

const BLOCK_ID = 'technology/api-design-retry-boundary-lab';

function isOption(value: unknown): value is Option {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Option>;
  return Boolean(candidate.id && candidate.label && candidate.detail);
}

function isRetryModel(value: unknown): value is RetryModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RetryModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.failureId
      && candidate.defaults.retryPolicyId
      && candidate.defaults.replayStoreId
      && typeof candidate.defaults.retries === 'number'
      && typeof candidate.retryBounds?.min === 'number'
      && typeof candidate.retryBounds.max === 'number'
      && typeof candidate.retryBounds.step === 'number'
      && Array.isArray(candidate.failurePoints)
      && candidate.failurePoints.length > 0
      && candidate.failurePoints.every(isOption)
      && Array.isArray(candidate.retryPolicies)
      && candidate.retryPolicies.every(isOption)
      && Array.isArray(candidate.replayStores)
      && candidate.replayStores.every(isOption),
  );
}

export default function ApiDesignRetryBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RetryModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No retry model was supplied.');
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
        if (!isRetryModel(payload)) throw new Error('The retry model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the retry lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RetryWorkbench data={data} />;
}

function RetryWorkbench({ data }: { data: RetryModel }) {
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [retryPolicyId, setRetryPolicyId] = useState(data.defaults.retryPolicyId);
  const [replayStoreId, setReplayStoreId] = useState(data.defaults.replayStoreId);
  const [retries, setRetries] = useState(data.defaults.retries);

  const failure = data.failurePoints.find((item) => item.id === failureId) ?? data.failurePoints[0];
  const retryPolicy = data.retryPolicies.find((item) => item.id === retryPolicyId) ?? data.retryPolicies[0];
  const replayStore = data.replayStores.find((item) => item.id === replayStoreId) ?? data.replayStores[0];

  const result = useMemo(() => {
    const replayProtection = replayStore.id === 'atomic';
    const writeRetries = retryPolicy.kind === 'reconcile' ? 0 : retries;
    const attempts = 1 + writeRetries;
    let effects = failure.originalEffects;
    if (writeRetries > 0) {
      if (retryPolicy.kind === 'write-same-key' && replayProtection) {
        effects = Math.max(1, failure.originalEffects);
      } else {
        effects += writeRetries;
      }
    }

    const lookupCount = retryPolicy.kind === 'reconcile' ? retries : 0;
    const duplicateEffects = Math.max(0, effects - 1);
    const safe = duplicateEffects === 0 && effects === 1;
    const outcome = duplicateEffects > 0
      ? `${effects} charges for one client intent`
      : effects === 1
        ? 'One charge with a recoverable result'
        : 'No charge; intent remains unresolved';
    const response = retryPolicy.kind === 'reconcile'
      ? failure.originalEffects === 1
        ? 'Status lookup finds the committed payment without another write.'
        : 'Status lookup finds no payment; application policy decides whether to submit a new intent.'
      : retryPolicy.kind === 'write-same-key' && replayProtection
        ? 'The replay store returns the recorded result for the same key and request fingerprint.'
        : duplicateEffects > 0
          ? 'Every retry is treated as another write because the server cannot prove it is the same intent.'
          : 'The retry becomes the first committed write, but only because the original did not commit.';
    const recommendation = duplicateEffects > 0
      ? 'Stop blind retries. Reconcile by business reference, then add a caller-scoped idempotency key bound atomically to the result.'
      : effects === 0
        ? 'Do not report success. Expose a status resource or a deliberate resubmission decision.'
        : retryPolicy.kind === 'write-same-key' && replayProtection
          ? 'Keep the same key and request fingerprint across network retries; reject key reuse with a changed body.'
          : 'The selected path avoids duplicate writes by reconciling state before another side effect.';

    return {
      attempts,
      duplicateEffects,
      effects,
      lookupCount,
      outcome,
      recommendation,
      response,
      safe,
      writeRetries,
    };
  }, [failure.originalEffects, replayStore.id, retries, retryPolicy.kind]);

  const reset = () => {
    setFailureId(data.defaults.failureId);
    setRetryPolicyId(data.defaults.retryPolicyId);
    setReplayStoreId(data.defaults.replayStoreId);
    setRetries(data.defaults.retries);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Uncertain write drill"
          title={data.title}
          description={data.description}
          icon={Repeat2}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <ChoiceGroup
                label="1. Response is lost"
                options={data.failurePoints}
                selectedId={failure.id}
                icon={Network}
                accent="rose"
                onSelect={setFailureId}
              />
              <ChoiceGroup
                label="2. Client recovery policy"
                options={data.retryPolicies}
                selectedId={retryPolicy.id}
                icon={retryPolicy.kind === 'reconcile' ? SearchCheck : Repeat2}
                accent="amber"
                onSelect={setRetryPolicyId}
              />
              <ChoiceGroup
                label="3. Server replay record"
                options={data.replayStores}
                selectedId={replayStore.id}
                icon={FileKey2}
                accent="violet"
                onSelect={setReplayStoreId}
              />
              <LabRange
                label={retryPolicy.kind === 'reconcile' ? 'Status checks' : 'Automatic retries'}
                value={retries}
                output={String(retries)}
                min={data.retryBounds.min}
                max={data.retryBounds.max}
                step={data.retryBounds.step}
                accent="rose"
                lowLabel="No follow-up"
                highLabel="Retry storm"
                onChange={setRetries}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Write attempts"
                value={String(result.attempts)}
                detail={`One original plus ${result.writeRetries} write retries.`}
                icon={Server}
                tone="blue"
              />
              <LabMetric
                label="Durable effects"
                value={String(result.effects)}
                detail="Charges created for one logical client intent."
                icon={Database}
                tone={result.duplicateEffects > 0 ? 'rose' : result.effects === 1 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Duplicate charges"
                value={String(result.duplicateEffects)}
                detail="Correctness fails when this value is greater than zero."
                icon={result.duplicateEffects > 0 ? TriangleAlert : ShieldCheck}
                tone={result.duplicateEffects > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Status reads"
                value={String(result.lookupCount)}
                detail="Read-only reconciliation can replace another uncertain write."
                icon={SearchCheck}
                tone="violet"
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Attempt trace</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <FlowNode icon={ReceiptText} label="Client intent" detail="Create one $42 payment" tone="blue" />
                <FlowArrow />
                <FlowNode icon={Server} label="Original request" detail={failure.clientObserved} tone={failure.originalEffects ? 'amber' : 'neutral'} />
                <FlowArrow />
                <FlowNode
                  icon={result.safe ? BadgeCheck : TriangleAlert}
                  label={result.outcome}
                  detail={result.response}
                  tone={result.duplicateEffects > 0 ? 'rose' : result.effects === 1 ? 'emerald' : 'amber'}
                />
              </div>
            </section>

            <section className={`mt-5 border-l-4 px-4 py-4 ${result.duplicateEffects > 0 ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : result.effects === 1 ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Recovery decision</p>
              <p className="mt-2 text-base font-semibold">{result.recommendation}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">The invariant is one durable business effect per logical intent, regardless of how many network attempts occur.</p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  options: Option[];
  selectedId: string;
  icon: LucideIcon;
  accent: 'rose' | 'amber' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={selectedId === option.id}
            label={option.label}
            detail={option.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function FlowNode({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  tone: 'neutral' | 'blue' | 'amber' | 'emerald' | 'rose';
}) {
  const styles = {
    neutral: 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white',
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <Icon aria-hidden="true" className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-neutral-400">
      <span className="hidden h-px w-8 bg-current md:block" />
      <span className="md:hidden">↓</span>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[680px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading API retry boundary lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      role="alert"
      className="min-h-48 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
    >
      <p className="flex items-center gap-2 font-semibold"><CircleAlert aria-hidden="true" className="h-4 w-4" /> API retry lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
