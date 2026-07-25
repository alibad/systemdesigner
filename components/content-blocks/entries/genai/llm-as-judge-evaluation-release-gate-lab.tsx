'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileWarning,
  Gauge,
  Scale,
  ShieldAlert,
  Shuffle,
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
  successAction: string;
  minimumPanelAgreementPct: number;
  maximumOrderFlipPct: number;
  maximumVerbosityUpsetPct: number;
  maximumRepeatDisagreementPct: number;
  minimumWorstSliceAgreementPct: number;
  minimumHumanAuditCoveragePct: number;
};

type EvidenceBatch = {
  id: string;
  label: string;
  detail: string;
  panelMatches: number;
  panelComparable: number;
  orderFlips: number;
  orderPairs: number;
  verbosityUpsets: number;
  verbosityPairs: number;
  repeatDisagreements: number;
  repeatPairs: number;
  worstSliceLabel: string;
  worstSliceMatches: number;
  worstSliceComparable: number;
};

type ReleaseGateData = {
  title: string;
  description: string;
  defaultBatchId: string;
  defaultPolicyId: string;
  defaultAuditCoveragePct: number;
  policies: ReleasePolicy[];
  batches: EvidenceBatch[];
};

type GateCheck = {
  id: string;
  label: string;
  numerator?: number;
  denominator?: number;
  actual: number;
  threshold: number;
  direction: 'minimum' | 'maximum';
  passed: boolean;
};

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultBatchId
      && candidate.defaultPolicyId
      && typeof candidate.defaultAuditCoveragePct === 'number'
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        Boolean(policy.id && policy.label && policy.successAction)
          && typeof policy.minimumPanelAgreementPct === 'number'
      ))
      && Array.isArray(candidate.batches)
      && candidate.batches.length > 0
      && candidate.batches.every((batch) => (
        batch.panelComparable > 0
          && batch.orderPairs > 0
          && batch.verbosityPairs > 0
          && batch.repeatPairs > 0
          && batch.worstSliceComparable > 0
      )),
  );
}

export default function LlmJudgeReleaseGateLab({
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
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateData(payload)) {
          throw new Error('Release-gate data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release evidence.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        title="Release gate unavailable"
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  if (!data) {
    return <LoadState error={null} title="Loading release evidence" onRetry={() => undefined} />;
  }

  return <ReleaseGate data={data} />;
}

function ReleaseGate({ data }: { data: ReleaseGateData }) {
  const defaultBatch = data.batches.find((batch) => batch.id === data.defaultBatchId)
    ?? data.batches[0];
  const defaultPolicy = data.policies.find((policy) => policy.id === data.defaultPolicyId)
    ?? data.policies[0];
  const [batchId, setBatchId] = useState(defaultBatch.id);
  const [policyId, setPolicyId] = useState(defaultPolicy.id);
  const [auditCoveragePct, setAuditCoveragePct] = useState(data.defaultAuditCoveragePct);

  const batch = data.batches.find((item) => item.id === batchId) ?? data.batches[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const panelAgreementPct = percent(batch.panelMatches, batch.panelComparable);
    const orderFlipPct = percent(batch.orderFlips, batch.orderPairs);
    const verbosityUpsetPct = percent(batch.verbosityUpsets, batch.verbosityPairs);
    const repeatDisagreementPct = percent(batch.repeatDisagreements, batch.repeatPairs);
    const worstSliceAgreementPct = percent(
      batch.worstSliceMatches,
      batch.worstSliceComparable,
    );
    const checks: GateCheck[] = [
      minimumCheck(
        'panel',
        'Panel-reference agreement',
        batch.panelMatches,
        batch.panelComparable,
        panelAgreementPct,
        policy.minimumPanelAgreementPct,
      ),
      maximumCheck(
        'position',
        'Order-flip rate',
        batch.orderFlips,
        batch.orderPairs,
        orderFlipPct,
        policy.maximumOrderFlipPct,
      ),
      maximumCheck(
        'verbosity',
        'Verbosity upset rate',
        batch.verbosityUpsets,
        batch.verbosityPairs,
        verbosityUpsetPct,
        policy.maximumVerbosityUpsetPct,
      ),
      maximumCheck(
        'repeat',
        'Repeated-judgment disagreement',
        batch.repeatDisagreements,
        batch.repeatPairs,
        repeatDisagreementPct,
        policy.maximumRepeatDisagreementPct,
      ),
      minimumCheck(
        'slice',
        batch.worstSliceLabel,
        batch.worstSliceMatches,
        batch.worstSliceComparable,
        worstSliceAgreementPct,
        policy.minimumWorstSliceAgreementPct,
      ),
      {
        id: 'audit',
        label: 'Human audit coverage',
        actual: auditCoveragePct,
        threshold: policy.minimumHumanAuditCoveragePct,
        direction: 'minimum',
        passed: auditCoveragePct >= policy.minimumHumanAuditCoveragePct,
      },
    ];

    return {
      checks,
      failed: checks.filter((check) => !check.passed),
      orderFlipPct,
      panelAgreementPct,
      proceed: checks.every((check) => check.passed),
      repeatDisagreementPct,
      verbosityUpsetPct,
      worstSliceAgreementPct,
    };
  }, [auditCoveragePct, batch, policy]);

  function choosePolicy(nextPolicy: ReleasePolicy) {
    setPolicyId(nextPolicy.id);
  }

  function reset() {
    setBatchId(defaultBatch.id);
    setPolicyId(defaultPolicy.id);
    setAuditCoveragePct(data.defaultAuditCoveragePct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Bias and disagreement gate"
        title={data.title}
        description={data.description}
        icon={ShieldAlert}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect an evidence batch
              </legend>
              <div className="mt-3 space-y-2">
                {data.batches.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={batch.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'controlled' ? BadgeCheck : FileWarning}
                    accent={item.id === 'controlled' ? 'emerald' : 'rose'}
                    onClick={() => setBatchId(item.id)}
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
                    selected={policy.id === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'high-impact' ? Users : Scale}
                    accent={item.id === 'high-impact' ? 'amber' : 'blue'}
                    onClick={() => choosePolicy(item)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Human audit coverage"
              value={auditCoveragePct}
              output={`${auditCoveragePct}%`}
              min={0}
              max={100}
              step={5}
              lowLabel="No sampled review"
              highLabel="Review every case"
              accent="emerald"
              onChange={setAuditCoveragePct}
            />
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Panel agreement"
            value={formatPct(result.panelAgreementPct)}
            detail={`${batch.panelMatches} / ${batch.panelComparable} comparable cases`}
            icon={Users}
            tone={result.panelAgreementPct >= policy.minimumPanelAgreementPct ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Order flips"
            value={formatPct(result.orderFlipPct)}
            detail={`${batch.orderFlips} / ${batch.orderPairs} reversed pairs`}
            icon={Shuffle}
            tone={result.orderFlipPct <= policy.maximumOrderFlipPct ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Worst slice"
            value={formatPct(result.worstSliceAgreementPct)}
            detail={`${batch.worstSliceLabel}: ${batch.worstSliceMatches} / ${batch.worstSliceComparable}`}
            icon={Gauge}
            tone={result.worstSliceAgreementPct >= policy.minimumWorstSliceAgreementPct ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Gate outcome"
            value={result.proceed ? 'Proceed' : 'Hold'}
            detail={result.proceed ? policy.successAction : `${result.failed.length} required checks fail`}
            icon={result.proceed ? BadgeCheck : ShieldAlert}
            tone={result.proceed ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
                {policy.label}
              </span>
              <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                Synthetic batch
              </span>
            </div>

            <p className="mt-4 text-sm font-semibold text-neutral-950 dark:text-white">
              Controlled probe results
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <EvidenceRate
                label="Verbosity upsets"
                value={formatPct(result.verbosityUpsetPct)}
                counts={`${batch.verbosityUpsets} / ${batch.verbosityPairs}`}
                icon={BarChart3}
              />
              <EvidenceRate
                label="Repeat disagreements"
                value={formatPct(result.repeatDisagreementPct)}
                counts={`${batch.repeatDisagreements} / ${batch.repeatPairs}`}
                icon={Activity}
              />
              <EvidenceRate
                label={batch.worstSliceLabel}
                value={formatPct(result.worstSliceAgreementPct)}
                counts={`${batch.worstSliceMatches} / ${batch.worstSliceComparable}`}
                icon={Gauge}
              />
              <EvidenceRate
                label="Human audit"
                value={`${auditCoveragePct}%`}
                counts={`Policy requires ${policy.minimumHumanAuditCoveragePct}%`}
                icon={Users}
              />
            </dl>

            <div className="mt-5 rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <p className="font-semibold text-neutral-950 dark:text-white">How the gate computes</p>
              <p className="mt-2">
                Every rate is numerator / denominator. Minimum checks use actual &gt;= floor;
                bias and disagreement checks use actual &lt;= ceiling.
              </p>
              <p className="mt-1">
                The decision proceeds only when all six checks pass. No weighted average is used.
              </p>
            </div>
          </section>

          <section className="min-w-0">
            <div
              aria-live="polite"
              className={`rounded-md border p-5 ${
                result.proceed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.proceed ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release decision</p>
                  <p className="mt-2 text-xl font-semibold">
                    {result.proceed ? policy.successAction : 'Hold for recalibration or review'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.proceed
                      ? 'This evidence batch satisfies the selected policy. The judge remains one bounded signal in the release process.'
                      : `${result.failed.length} independent checks fail. Fix or narrow the evaluator before it can influence this decision.`}
                  </p>
                </div>
              </div>
            </div>

            {result.panelAgreementPct >= policy.minimumPanelAgreementPct && !result.proceed ? (
              <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50">
                <BarChart3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">The aggregate would hide this hold</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    Overall panel agreement clears its floor, but at least one bias, stability,
                    slice, or human-audit requirement still fails.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {result.checks.map((check) => (
                <div
                  key={check.id}
                  className={`flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    check.passed
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-50'
                      : 'border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {check.passed ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{check.label}</span>
                  </div>
                  <div className="text-left text-xs sm:text-right">
                    <span className="font-semibold">
                      {formatPct(check.actual)}
                      {check.denominator ? ` (${check.numerator}/${check.denominator})` : ''}
                    </span>
                    <span className="ml-2 opacity-70">
                      {check.direction === 'minimum' ? 'min' : 'max'} {check.threshold}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
              <Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                Passing means this evaluator is eligible for the policy&apos;s bounded next step.
                It does not certify candidate correctness or replace the release owner.
              </p>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidenceRate({
  label,
  value,
  counts,
  icon: Icon,
}: {
  label: string;
  value: string;
  counts: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {label}
      </dt>
      <dd className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</dd>
      <dd className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{counts}</dd>
    </div>
  );
}

function LoadState({
  error,
  title,
  onRetry,
}: {
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
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
        {error ? (
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
        )}
        <div>
          <p className="font-semibold">{title}</p>
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

function minimumCheck(
  id: string,
  label: string,
  numerator: number,
  denominator: number,
  actual: number,
  threshold: number,
): GateCheck {
  return {
    id,
    label,
    numerator,
    denominator,
    actual,
    threshold,
    direction: 'minimum',
    passed: actual >= threshold,
  };
}

function maximumCheck(
  id: string,
  label: string,
  numerator: number,
  denominator: number,
  actual: number,
  threshold: number,
): GateCheck {
  return {
    id,
    label,
    numerator,
    denominator,
    actual,
    threshold,
    direction: 'maximum',
    passed: actual <= threshold,
  };
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}
