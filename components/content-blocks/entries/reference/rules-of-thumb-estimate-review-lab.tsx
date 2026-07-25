'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  SearchCheck,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type CheckStatus = 'pass' | 'warn' | 'fail';

type EstimateClaim = {
  id: string;
  label: string;
  detail: string;
  value: number;
  unit: string;
  decimals: number;
  baseUncertaintyPercent: number;
  checks: Array<{ label: string; status: CheckStatus; detail: string }>;
  nextMeasurement: string;
  hiddenRisk: string;
};

type EvidenceOption = {
  id: string;
  label: string;
  detail: string;
  confidence: number;
  bandMultiplier: number;
};

type ImpactOption = {
  id: string;
  label: string;
  detail: string;
  additionalMarginPercent: number;
};

type EstimateReviewModel = {
  claims: EstimateClaim[];
  evidenceOptions: EvidenceOption[];
  impactOptions: ImpactOption[];
};

const checkStyles = {
  pass: {
    icon: CheckCircle2,
    label: 'Pass',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  },
  warn: {
    icon: TriangleAlert,
    label: 'Needs evidence',
    className: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
  },
  fail: {
    icon: XCircle,
    label: 'Contradiction',
    className: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
  },
} as const;

function LabState({ block, label, error }: { block: string; label: string; error?: string }) {
  return (
    <div data-content-block={block}>
      <div
        className={`min-h-48 rounded-md border p-5 text-sm ${error ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : 'border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'}`}
        aria-label={label}
        role={error ? 'alert' : undefined}
      >
        {error ? <><p className="font-semibold">Estimate review unavailable</p><p className="mt-2 opacity-80">{error}</p></> : null}
      </div>
    </div>
  );
}

export default function RulesOfThumbEstimateReviewLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<EstimateReviewModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimId, setClaimId] = useState('fleet');
  const [evidenceId, setEvidenceId] = useState('analogy');
  const [impactId, setImpactId] = useState('slo');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The estimate review data file was not provided.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<EstimateReviewModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the estimate review.');
      });
    return () => controller.abort();
  }, [dataFile]);

  const block = 'reference/rules-of-thumb-estimate-review-lab';
  if (loadError) return <LabState block={block} label="Estimate review unavailable" error={loadError} />;
  if (!data) return <LabState block={block} label="Loading estimate review model" />;

  const claim = data.claims.find((option) => option.id === claimId) ?? data.claims[0];
  const evidence = data.evidenceOptions.find((option) => option.id === evidenceId) ?? data.evidenceOptions[0];
  const impact = data.impactOptions.find((option) => option.id === impactId) ?? data.impactOptions[0];
  if (!claim || !evidence || !impact) {
    return <LabState block={block} label="Estimate review unavailable" error="Claim, evidence, or impact options are missing." />;
  }

  const failures = claim.checks.filter((check) => check.status === 'fail').length;
  const warnings = claim.checks.filter((check) => check.status === 'warn').length;
  const confidence = Math.max(0, evidence.confidence - failures * 18 - warnings * 8);
  const uncertaintyPercent = Math.min(95, claim.baseUncertaintyPercent * evidence.bandMultiplier + impact.additionalMarginPercent);
  const low = Math.max(0, claim.value * (1 - uncertaintyPercent / 100));
  const high = claim.value * (1 + uncertaintyPercent / 100);
  const formatQuantity = (value: number) => `${value.toFixed(claim.decimals)} ${claim.unit}`;
  const decision = failures > 0
    ? 'Reject the point estimate'
    : confidence >= 70 && impact.id === 'reversible'
      ? 'Run a guarded experiment'
      : evidence.id === 'representative' && confidence >= 60
        ? 'Stage with explicit headroom'
        : 'Measure before commitment';
  const decisionTone = failures > 0 ? 'rose' : confidence >= 70 ? 'emerald' : 'amber';

  return (
    <div data-content-block={block}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Estimate review desk"
          title="Decide how much confidence the claim deserves"
          description="A point estimate is only one input. Change the claim, evidence quality, and downside to see how contradictions, uncertainty, and the next decision should change."
          icon={SearchCheck}
          accent="rose"
          onReset={() => {
            setClaimId('fleet');
            setEvidenceId('analogy');
            setImpactId('slo');
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Planning claim</legend>
                <div className="mt-3 space-y-2">
                  {data.claims.map((option) => (
                    <LabChoice key={option.id} selected={claim.id === option.id} label={option.label} detail={option.detail} icon={ClipboardCheck} accent="blue" onClick={() => setClaimId(option.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Strongest evidence available</legend>
                <div className="mt-3 space-y-2">
                  {data.evidenceOptions.map((option) => (
                    <LabChoice key={option.id} selected={evidence.id === option.id} label={option.label} detail={option.detail} icon={Gauge} accent={option.id === 'representative' ? 'emerald' : option.id === 'analogy' ? 'violet' : 'amber'} onClick={() => setEvidenceId(option.id)} />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Cost of underestimating</legend>
                <div className="mt-3 space-y-2">
                  {data.impactOptions.map((option) => (
                    <LabChoice key={option.id} selected={impact.id === option.id} label={option.label} detail={option.detail} icon={option.id === 'correctness' ? ShieldAlert : BadgeCheck} accent={option.id === 'correctness' ? 'rose' : option.id === 'slo' ? 'amber' : 'emerald'} onClick={() => setImpactId(option.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Point claim" value={formatQuantity(claim.value)} detail={claim.label} icon={ClipboardCheck} tone="blue" />
            <LabMetric label="Review range" value={`${formatQuantity(low)}–${formatQuantity(high)}`} detail={`${Math.round(uncertaintyPercent)}% modeled uncertainty and consequence margin.`} icon={Gauge} tone="violet" />
            <LabMetric label="Evidence confidence" value={`${confidence}/100`} detail={`${evidence.label}; reduced by ${failures} contradiction(s) and ${warnings} warning(s).`} icon={SearchCheck} tone={confidence >= 70 ? 'emerald' : confidence >= 40 ? 'amber' : 'rose'} />
            <LabMetric label="Decision" value={decision} detail={impact.label} icon={failures > 0 ? XCircle : CheckCircle2} tone={decisionTone} />
          </div>

          <section className="mt-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Sanity-check ledger</p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Can the claim survive an independent review?</h4>
              </div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{claim.checks.length - failures} of {claim.checks.length} without contradiction</p>
            </div>
            <ul className="mt-4 grid gap-3 lg:grid-cols-3">
              {claim.checks.map((check) => {
                const style = checkStyles[check.status];
                const Icon = style.icon;
                return (
                  <li key={check.label} className={`border p-4 ${style.className}`}>
                    <div className="flex items-start gap-3">
                      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold uppercase opacity-70">{style.label}</p>
                        <p className="mt-1 text-sm font-semibold">{check.label}</p>
                        <p className="mt-2 text-xs leading-5 opacity-80">{check.detail}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={`mt-6 border-l-4 p-5 ${failures > 0 ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50' : confidence >= 70 ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50'}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {failures > 0 ? <XCircle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : confidence >= 70 ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Recommended next move</p>
                <h4 className="mt-2 text-lg font-semibold">{decision}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{claim.nextMeasurement}</p>
                <p className="mt-3 border-t border-current/20 pt-3 text-sm leading-6"><strong>Hidden risk:</strong> {claim.hiddenRisk}</p>
              </div>
            </div>
          </section>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
