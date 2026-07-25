'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileWarning,
  Gauge,
  Languages,
  ScanSearch,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ReleasePolicy = {
  id: string;
  label: string;
  detail: string;
  semanticFloor: number;
  terminologyFloor: number;
  placeholderFloor: number;
  maxCriticalErrors: number;
  p95BudgetMs: number;
  humanReviewRequired: boolean;
};

type EvaluationSlice = {
  id: string;
  label: string;
  detail: string;
  languagePair: string;
  domain: string;
  aggregateSemantic: number;
  semanticScore: number;
  lexicalScore: number;
  terminologyPercent: number;
  placeholderPercent: number;
  criticalErrors: string[];
  p95Ms: number;
  humanReviewCoverage: number;
  sampleCount: number;
};

type ReleaseGateData = {
  title: string;
  description: string;
  defaults: {
    sliceId: string;
    policyId: string;
  };
  policies: ReleasePolicy[];
  slices: EvaluationSlice[];
};

type Gate = {
  id: string;
  label: string;
  actual: string;
  required: string;
  passed: boolean;
};

const BLOCK_ID = 'genai/translation-systems-release-gate-lab';

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.sliceId
      && candidate.defaults.policyId
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.semanticFloor === 'number'
          && typeof policy.maxCriticalErrors === 'number'
      ))
      && Array.isArray(candidate.slices)
      && candidate.slices.length > 0
      && candidate.slices.every((slice) => Array.isArray(slice.criticalErrors)),
  );
}

export default function TranslationSystemsReleaseGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No release evidence was supplied.');
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
        if (!isReleaseGateData(payload)) throw new Error('Release-gate data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <ReleaseGate data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function ReleaseGate({ data }: { data: ReleaseGateData }) {
  const initialSlice = data.slices.find((item) => item.id === data.defaults.sliceId)
    ?? data.slices[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [sliceId, setSliceId] = useState(initialSlice.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [semanticFloor, setSemanticFloor] = useState(initialPolicy.semanticFloor);

  const slice = data.slices.find((item) => item.id === sliceId) ?? data.slices[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const gates: Gate[] = [
      {
        id: 'semantic',
        label: 'Source-aware semantic quality',
        actual: `${slice.semanticScore} / 100`,
        required: `at least ${semanticFloor}`,
        passed: slice.semanticScore >= semanticFloor,
      },
      {
        id: 'terminology',
        label: 'Approved terminology',
        actual: `${slice.terminologyPercent}%`,
        required: `at least ${policy.terminologyFloor}%`,
        passed: slice.terminologyPercent >= policy.terminologyFloor,
      },
      {
        id: 'placeholders',
        label: 'Protected-span preservation',
        actual: `${slice.placeholderPercent}%`,
        required: `at least ${policy.placeholderFloor}%`,
        passed: slice.placeholderPercent >= policy.placeholderFloor,
      },
      {
        id: 'critical',
        label: 'Critical errors',
        actual: `${slice.criticalErrors.length}`,
        required: `at most ${policy.maxCriticalErrors}`,
        passed: slice.criticalErrors.length <= policy.maxCriticalErrors,
      },
      {
        id: 'latency',
        label: 'Complete-path p95 latency',
        actual: `${slice.p95Ms} ms`,
        required: `at most ${policy.p95BudgetMs} ms`,
        passed: slice.p95Ms <= policy.p95BudgetMs,
      },
      {
        id: 'human',
        label: 'Expert review coverage',
        actual: `${slice.humanReviewCoverage}%`,
        required: policy.humanReviewRequired ? '100% required' : 'sampled evidence allowed',
        passed: !policy.humanReviewRequired || slice.humanReviewCoverage >= 100,
      },
    ];
    const failures = gates.filter((gate) => !gate.passed);
    const aggregateWouldPass = slice.aggregateSemantic >= semanticFloor;
    const release = failures.length === 0;

    return {
      aggregateWouldPass,
      failures,
      gates,
      release,
    };
  }, [policy, semanticFloor, slice]);

  function choosePolicy(next: ReleasePolicy) {
    setPolicyId(next.id);
    setSemanticFloor(next.semanticFloor);
  }

  function reset() {
    setSliceId(initialSlice.id);
    setPolicyId(initialPolicy.id);
    setSemanticFloor(initialPolicy.semanticFloor);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evaluation evidence gate"
        title={data.title}
        description={data.description}
        icon={ScanSearch}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect a required slice
              </legend>
              <div className="mt-3 space-y-2">
                {data.slices.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={sliceId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Languages}
                    accent="blue"
                    onClick={() => setSliceId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Apply a release policy
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={policyId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.humanReviewRequired ? Users : BadgeCheck}
                    accent={item.humanReviewRequired ? 'amber' : 'emerald'}
                    onClick={() => choosePolicy(item)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Semantic quality floor"
              value={semanticFloor}
              output={`${semanticFloor} / 100`}
              min={70}
              max={95}
              step={1}
              lowLabel="Broad admission"
              highLabel="Stricter evidence"
              accent="emerald"
              onChange={setSemanticFloor}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Aggregate semantic"
            value={`${slice.aggregateSemantic} / 100`}
            detail="Portfolio average before this slice is inspected"
            icon={BarChart3}
            tone={result.aggregateWouldPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Slice semantic"
            value={`${slice.semanticScore} / 100`}
            detail={`${slice.languagePair}; ${slice.sampleCount.toLocaleString()} examples`}
            icon={Gauge}
            tone={slice.semanticScore >= semanticFloor ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Critical errors"
            value={`${slice.criticalErrors.length}`}
            detail={`Policy allows ${policy.maxCriticalErrors}`}
            icon={FileWarning}
            tone={slice.criticalErrors.length <= policy.maxCriticalErrors ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Release decision"
            value={result.release ? 'Ship' : 'Block'}
            detail={result.release ? 'Every required gate passes' : `${result.failures.length} required gates fail`}
            icon={result.release ? BadgeCheck : ShieldAlert}
            tone={result.release ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
                {slice.languagePair}
              </span>
              <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                {slice.domain}
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Evidence profile
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <EvidenceValue label="Lexical" value={`${slice.lexicalScore}`} />
              <EvidenceValue label="Terminology" value={`${slice.terminologyPercent}%`} />
              <EvidenceValue label="Protected spans" value={`${slice.placeholderPercent}%`} />
              <EvidenceValue label="p95 latency" value={`${slice.p95Ms} ms`} />
              <EvidenceValue label="Human review" value={`${slice.humanReviewCoverage}%`} />
              <EvidenceValue label="Examples" value={slice.sampleCount.toLocaleString()} />
            </dl>

            {slice.criticalErrors.length > 0 ? (
              <div className="mt-5 rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <FileWarning aria-hidden="true" className="h-4 w-4" />
                  Observed critical errors
                </p>
                <ul className="mt-3 space-y-2 pl-5 text-sm leading-6 marker:text-rose-500 dark:marker:text-rose-300">
                  {slice.criticalErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                No critical error was observed in this modeled slice.
              </div>
            )}
          </section>

          <section className="min-w-0">
            <div
              aria-live="polite"
              className={`rounded-md border p-5 ${
                result.release
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.release ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Policy outcome</p>
                  <p className="mt-2 text-xl font-semibold">
                    {result.release ? 'This slice supports release' : 'This slice blocks the bundle'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.release
                      ? 'Every required gate passes under the selected policy. Other required slices must still pass independently.'
                      : `${result.failures.length} required checks fail. A healthy aggregate cannot compensate for this slice.`}
                  </p>
                </div>
              </div>
            </div>

            {result.aggregateWouldPass && !result.release ? (
              <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
                <BarChart3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Aggregate-only evaluation would miss this block</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    The portfolio semantic score clears {semanticFloor}, but the selected slice still violates its release contract.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {result.gates.map((gate) => (
                <div
                  key={gate.id}
                  className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    gate.passed
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-50'
                      : 'border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {gate.passed ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{gate.label}</span>
                  </div>
                  <div className="text-left text-xs sm:text-right">
                    <span className="font-semibold">{gate.actual}</span>
                    <span className="ml-2 opacity-70">{gate.required}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidenceValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <dt className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 break-words font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</dd>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div
      className={`not-prose my-7 rounded-lg border p-6 ${
        error
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
      role={error ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        {error ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />}
        <div>
          <p className="font-semibold">{error ? 'Release gate unavailable' : 'Loading release evidence'}</p>
          {error ? <p className="mt-2 text-sm opacity-80">{error}</p> : null}
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
