'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/data-quality-filtering/data/threshold-audit-slices.json';
const BLOCK_ID = 'ml-systems/data-quality-filtering-threshold-lab';

type ScoreBin = {
  score: number;
  eligible: number;
  ineligible: number;
};

type AuditSlice = {
  id: string;
  label: string;
  context: string;
  bins: ScoreBin[];
};

type LabData = {
  title: string;
  description: string;
  fixtureNote: string;
  defaults: {
    sliceId: string;
    threshold: number;
  };
  guardrails: {
    maximumFalseRejectionPct: number;
    maximumLeakagePct: number;
  };
  slices: AuditSlice[];
};

type SliceResult = {
  acceptedEligible: number;
  acceptedIneligible: number;
  falseRejectionPct: number;
  leakagePct: number;
  rejectedEligible: number;
  rejectedIneligible: number;
  slice: AuditSlice;
  total: number;
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  const sliceIds = new Set(data.slices?.map((slice) => slice.id) ?? []);
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.fixtureNote === 'string' &&
      data.defaults &&
      typeof data.defaults.sliceId === 'string' &&
      Number.isFinite(data.defaults.threshold) &&
      data.defaults.threshold >= 0 &&
      data.defaults.threshold <= 100 &&
      data.guardrails &&
      Number.isFinite(data.guardrails.maximumFalseRejectionPct) &&
      data.guardrails.maximumFalseRejectionPct >= 0 &&
      data.guardrails.maximumFalseRejectionPct <= 100 &&
      Number.isFinite(data.guardrails.maximumLeakagePct) &&
      data.guardrails.maximumLeakagePct >= 0 &&
      data.guardrails.maximumLeakagePct <= 100 &&
      Array.isArray(data.slices) &&
      data.slices.length >= 2 &&
      sliceIds.size === data.slices.length &&
      data.slices.some((slice) => slice.id === data.defaults?.sliceId) &&
      data.slices.every(
        (slice) =>
          typeof slice.id === 'string' &&
          typeof slice.label === 'string' &&
          typeof slice.context === 'string' &&
          Array.isArray(slice.bins) &&
          slice.bins.length > 0 &&
          slice.bins.every(
            (bin) =>
              Number.isFinite(bin.score) &&
              bin.score >= 0 &&
              bin.score <= 100 &&
              Number.isInteger(bin.eligible) &&
              bin.eligible >= 0 &&
              Number.isInteger(bin.ineligible) &&
              bin.ineligible >= 0,
          ),
      ),
  );
}

function evaluateSlice(slice: AuditSlice, threshold: number): SliceResult {
  let acceptedEligible = 0;
  let acceptedIneligible = 0;
  let rejectedEligible = 0;
  let rejectedIneligible = 0;

  for (const bin of slice.bins) {
    if (bin.score >= threshold) {
      acceptedEligible += bin.eligible;
      acceptedIneligible += bin.ineligible;
    } else {
      rejectedEligible += bin.eligible;
      rejectedIneligible += bin.ineligible;
    }
  }

  const totalEligible = acceptedEligible + rejectedEligible;
  const totalAccepted = acceptedEligible + acceptedIneligible;
  const total = totalEligible + acceptedIneligible + rejectedIneligible;
  return {
    acceptedEligible,
    acceptedIneligible,
    falseRejectionPct: totalEligible === 0 ? 0 : (rejectedEligible / totalEligible) * 100,
    leakagePct: totalAccepted === 0 ? 0 : (acceptedIneligible / totalAccepted) * 100,
    rejectedEligible,
    rejectedIneligible,
    slice,
    total,
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function DataQualityFilteringThresholdLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliceId, setSliceId] = useState('');
  const [threshold, setThreshold] = useState(60);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the threshold audit fixture (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isLabData(value)) {
          throw new Error('The threshold audit fixture has an invalid data contract.');
        }
        setData(value);
        setSliceId(value.defaults.sliceId);
        setThreshold(value.defaults.threshold);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Could not load the threshold audit lab.',
          );
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const slice = data.slices.find((item) => item.id === sliceId) ?? data.slices[0];
    return {
      selected: evaluateSlice(slice, threshold),
      allSlices: data.slices.map((item) => evaluateSlice(item, threshold)),
    };
  }, [data, sliceId, threshold]);

  const reset = () => {
    if (!data) return;
    setSliceId(data.defaults.sliceId);
    setThreshold(data.defaults.threshold);
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading threshold audit lab"
      />
    );
  }

  const falseRejectionPass =
    result.selected.falseRejectionPct <= data.guardrails.maximumFalseRejectionPct;
  const leakagePass = result.selected.leakagePct <= data.guardrails.maximumLeakagePct;
  const healthy = falseRejectionPass && leakagePass;
  const accepted = result.selected.acceptedEligible + result.selected.acceptedIneligible;
  const rejected = result.selected.rejectedEligible + result.selected.rejectedIneligible;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Threshold audit lab"
          title={data.title}
          description={data.description}
          icon={SlidersHorizontal}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Reviewed audit slice
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.slices.map((slice) => (
                    <LabChoice
                      key={slice.id}
                      selected={slice.id === result.selected.slice.id}
                      label={slice.label}
                      detail={slice.context}
                      icon={Users}
                      accent="violet"
                      onClick={() => setSliceId(slice.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Accept when score is at least"
                value={threshold}
                output={`${threshold} / 100`}
                min={10}
                max={90}
                step={10}
                accent="violet"
                lowLabel="Keep more"
                highLabel="Reject more"
                onChange={setThreshold}
              />

              <div className="rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                <p className="font-semibold text-neutral-950 dark:text-white">Release guardrails</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>
                    False rejection ≤ {data.guardrails.maximumFalseRejectionPct}% of
                    human-eligible records
                  </li>
                  <li>
                    Leakage ≤ {data.guardrails.maximumLeakagePct}% of accepted records
                  </li>
                </ul>
              </div>
            </div>
          }
        >
          <div className="space-y-6" aria-live="polite">
            <div
              className={`rounded-md border p-5 ${
                healthy
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {healthy ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Slice verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {healthy
                      ? 'This threshold clears both fixture guardrails'
                      : !falseRejectionPass && !leakagePass
                        ? 'One threshold fails both error budgets'
                        : !falseRejectionPass
                          ? 'The gate over-filters this slice'
                          : 'The gate leaks too many ineligible records'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {healthy
                      ? 'The reviewed slice is within the example release limits. Production approval still needs representative sampling and confidence intervals.'
                      : 'Do not hide this outcome inside a corpus-wide average. Recalibrate, improve the classifier, route uncertain records to review, or narrow the policy claim.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Accepted"
                value={formatCount(accepted)}
                detail={`${((accepted / result.selected.total) * 100).toFixed(1)}% of this slice`}
                icon={Filter}
                tone="blue"
              />
              <LabMetric
                label="Rejected"
                value={formatCount(rejected)}
                detail={`${((rejected / result.selected.total) * 100).toFixed(1)}% of this slice`}
                icon={ScanSearch}
                tone="neutral"
              />
              <LabMetric
                label="False rejection"
                value={`${result.selected.falseRejectionPct.toFixed(1)}%`}
                detail={`Limit: ${data.guardrails.maximumFalseRejectionPct}%`}
                icon={Users}
                tone={falseRejectionPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Policy leakage"
                value={`${result.selected.leakagePct.toFixed(1)}%`}
                detail={`Limit: ${data.guardrails.maximumLeakagePct}%`}
                icon={ShieldCheck}
                tone={leakagePass ? 'emerald' : 'rose'}
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Human review versus automated decision
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Eligible and accepted
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCount(result.selected.acceptedEligible)}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    Useful records retained by the gate
                  </p>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Ineligible but accepted
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCount(result.selected.acceptedIneligible)}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    Policy failures leaked into the release
                  </p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Eligible but rejected
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCount(result.selected.rejectedEligible)}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    Coverage lost through false rejection
                  </p>
                </div>
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    Ineligible and rejected
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatCount(result.selected.rejectedIneligible)}
                  </p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    Policy failures correctly quarantined
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Same threshold, every slice
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    A global average can hide who pays the error cost
                  </h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Threshold: {threshold}
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {result.allSlices.map((sliceResult) => {
                  const sliceHealthy =
                    sliceResult.falseRejectionPct <=
                      data.guardrails.maximumFalseRejectionPct &&
                    sliceResult.leakagePct <= data.guardrails.maximumLeakagePct;
                  return (
                    <button
                      key={sliceResult.slice.id}
                      type="button"
                      aria-pressed={sliceResult.slice.id === result.selected.slice.id}
                      onClick={() => setSliceId(sliceResult.slice.id)}
                      className={`grid w-full gap-3 rounded-md border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center ${
                        sliceResult.slice.id === result.selected.slice.id
                          ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-400 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-100'
                          : 'border-neutral-200 bg-white text-neutral-950 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:hover:border-neutral-600'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {sliceResult.slice.label}
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
                          {sliceHealthy ? 'Within both guardrails' : 'Requires policy work'}
                        </span>
                      </span>
                      <span className="text-xs">
                        <span className="block text-neutral-500 dark:text-neutral-400">
                          False rejection
                        </span>
                        <span className="mt-1 block font-semibold tabular-nums">
                          {sliceResult.falseRejectionPct.toFixed(1)}%
                        </span>
                      </span>
                      <span className="text-xs">
                        <span className="block text-neutral-500 dark:text-neutral-400">
                          Leakage
                        </span>
                        <span className="mt-1 block font-semibold tabular-nums">
                          {sliceResult.leakagePct.toFixed(1)}%
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="rounded-md border border-neutral-200 bg-white p-4 text-xs leading-5 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <strong className="text-neutral-950 dark:text-white">Fixture boundary:</strong>{' '}
              {data.fixtureNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
