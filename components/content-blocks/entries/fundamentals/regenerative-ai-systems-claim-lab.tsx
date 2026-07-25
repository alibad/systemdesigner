'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Leaf,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UsersRound,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Scenario = {
  id: string;
  label: string;
  detail: string;
  baselineFootprintKgco2e: number;
  baselineMonthlyUses: number;
  reportedAdditionalOutcome: number;
  outcomeUnit: string;
};
type Intervention = {
  id: string;
  label: string;
  detail: string;
  directReductionPercent: number;
  externalOutcomeLiftPercent: number;
  claimScope: 'own-footprint' | 'external-contribution' | 'bounded-regenerative';
};
type EvidenceLevel = {
  id: string;
  label: string;
  detail: string;
  confidence: number;
};
type ClaimModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    interventionId: string;
    evidenceId: string;
    demandGrowthPercent: number;
    monitorDurability: boolean;
  };
  bounds: { demandGrowthPercent: Bound };
  scenarios: Scenario[];
  interventions: Intervention[];
  evidenceLevels: EvidenceLevel[];
};

const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/regenerative-ai-systems/data/intervention-claim-scenarios.json';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return typeof candidate.min === 'number'
    && typeof candidate.max === 'number'
    && typeof candidate.step === 'number';
}

function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Scenario>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.baselineFootprintKgco2e === 'number'
      && typeof candidate.baselineMonthlyUses === 'number'
      && typeof candidate.reportedAdditionalOutcome === 'number'
      && candidate.outcomeUnit,
  );
}

function isIntervention(value: unknown): value is Intervention {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Intervention>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.directReductionPercent === 'number'
      && typeof candidate.externalOutcomeLiftPercent === 'number'
      && ['own-footprint', 'external-contribution', 'bounded-regenerative'].includes(candidate.claimScope ?? ''),
  );
}

function isEvidenceLevel(value: unknown): value is EvidenceLevel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceLevel>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && typeof candidate.confidence === 'number'
      && candidate.confidence > 0
      && candidate.confidence <= 1,
  );
}

function isClaimModel(value: unknown): value is ClaimModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ClaimModel>;
  const defaults = candidate.defaults;
  return Boolean(
    candidate.title
      && candidate.description
      && defaults?.scenarioId
      && defaults.interventionId
      && defaults.evidenceId
      && typeof defaults.demandGrowthPercent === 'number'
      && typeof defaults.monitorDurability === 'boolean'
      && isBound(candidate.bounds?.demandGrowthPercent)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 3
      && candidate.scenarios.every(isScenario)
      && Array.isArray(candidate.interventions)
      && candidate.interventions.length >= 3
      && candidate.interventions.every(isIntervention)
      && Array.isArray(candidate.evidenceLevels)
      && candidate.evidenceLevels.length >= 3
      && candidate.evidenceLevels.every(isEvidenceLevel),
  );
}

function formatKg(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)} tCO2e`;
  return `${value.toFixed(0)} kgCO2e`;
}

export default function RegenerativeAISystemsClaimLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ClaimModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isClaimModel(payload)) {
          throw new Error('The claim model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load claim scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <ClaimStressTest data={data} />;
}

function ClaimStressTest({ data }: { data: ClaimModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [interventionId, setInterventionId] = useState(data.defaults.interventionId);
  const [evidenceId, setEvidenceId] = useState(data.defaults.evidenceId);
  const [demandGrowthPercent, setDemandGrowthPercent] = useState(
    data.defaults.demandGrowthPercent,
  );
  const [monitorDurability, setMonitorDurability] = useState(
    data.defaults.monitorDurability,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const intervention = data.interventions.find((item) => item.id === interventionId)
    ?? data.interventions[0];
  const evidence = data.evidenceLevels.find((item) => item.id === evidenceId)
    ?? data.evidenceLevels[0];

  const result = useMemo(() => {
    const demandMultiplier = 1 + demandGrowthPercent / 100;
    const postFootprint = scenario.baselineFootprintKgco2e
      * (1 - intervention.directReductionPercent / 100)
      * demandMultiplier;
    const footprintReduction = scenario.baselineFootprintKgco2e - postFootprint;
    const postUses = scenario.baselineMonthlyUses * demandMultiplier;
    const reportedAdditionalOutcome = scenario.reportedAdditionalOutcome
      * intervention.externalOutcomeLiftPercent
      / 100
      * demandMultiplier;
    const supportedAdditionalOutcome = reportedAdditionalOutcome * evidence.confidence;
    const ownFootprintImproved = footprintReduction > 0;
    const hasExternalOutcome = intervention.externalOutcomeLiftPercent > 0;
    const hasCounterfactual = evidence.id !== 'modeled-only';
    const independentlyReviewed = evidence.confidence >= 0.8;
    const claimReady = ownFootprintImproved
      && hasExternalOutcome
      && hasCounterfactual
      && independentlyReviewed
      && monitorDurability;
    const verdict = !ownFootprintImproved
      ? 'Demand growth erased the modeled reduction'
      : !hasExternalOutcome
        ? 'Report a bounded own-footprint reduction'
        : claimReady
          ? 'Candidate for a bounded regenerative contribution claim'
          : 'Keep the external contribution claim in review';
    const detail = !ownFootprintImproved
      ? 'The service became more efficient per use, but its absolute footprint rose above the baseline.'
      : !hasExternalOutcome
        ? 'This intervention improves the AI system ledger. It does not by itself demonstrate an external ecological outcome.'
        : claimReady
          ? 'The model shows separate footprint and outcome evidence. Publish the boundary, methods, uncertainty, owners, and review scope rather than one net-positive number.'
          : 'A potential outcome exists, but the evidence package, counterfactual, independent review, or durability monitoring is incomplete.';

    return {
      claimReady,
      detail,
      footprintReduction,
      hasCounterfactual,
      hasExternalOutcome,
      independentlyReviewed,
      ownFootprintImproved,
      postFootprint,
      postUses,
      reportedAdditionalOutcome,
      supportedAdditionalOutcome,
      verdict,
    };
  }, [demandGrowthPercent, evidence, intervention, monitorDurability, scenario]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setInterventionId(data.defaults.interventionId);
    setEvidenceId(data.defaults.evidenceId);
    setDemandGrowthPercent(data.defaults.demandGrowthPercent);
    setMonitorDurability(data.defaults.monitorDurability);
  }

  const verdictClass = result.claimReady
    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
    : result.ownFootprintImproved
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Impact claim lab"
        title={data.title}
        description={data.description}
        icon={Scale}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Environmental use case</legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={item.id === 'grid-maintenance' ? Gauge : item.id === 'water-leak-triage' ? Workflow : Leaf} accent={item.id === 'grid-maintenance' ? 'amber' : item.id === 'water-leak-triage' ? 'blue' : 'emerald'} onClick={() => setScenarioId(item.id)} />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Intervention</legend>
              <div className="mt-3 space-y-2">
                {data.interventions.map((item) => (
                  <LabChoice key={item.id} selected={item.id === intervention.id} label={item.label} detail={item.detail} icon={item.claimScope === 'own-footprint' ? BarChart3 : item.claimScope === 'external-contribution' ? UsersRound : Sparkles} accent={item.claimScope === 'own-footprint' ? 'blue' : item.claimScope === 'external-contribution' ? 'amber' : 'violet'} onClick={() => setInterventionId(item.id)} />
                ))}
              </div>
            </fieldset>

            <LabRange label="Demand growth after release" value={demandGrowthPercent} output={`+${demandGrowthPercent}%`} {...data.bounds.demandGrowthPercent} accent="rose" lowLabel="no rebound" highLabel="rapid expansion" onChange={setDemandGrowthPercent} />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence package</legend>
              <div className="mt-3 space-y-2">
                {data.evidenceLevels.map((item) => (
                  <LabChoice key={item.id} selected={item.id === evidence.id} label={item.label} detail={item.detail} icon={item.id === 'independent-review' ? ShieldCheck : ClipboardCheck} accent={item.id === 'independent-review' ? 'emerald' : item.id === 'measured-pilot' ? 'cyan' : 'amber'} onClick={() => setEvidenceId(item.id)} />
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Monitor durability and leakage</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Check whether the outcome persists or shifts damage beyond the chosen boundary.</span>
              </span>
              <input type="checkbox" checked={monitorDurability} onChange={(event) => setMonitorDurability(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-violet-600" />
            </label>
          </div>
        }
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${verdictClass}`}>
            <div className="flex items-start gap-3">
              {result.claimReady ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">Claim verdict</p>
                <h4 className="mt-1 text-xl font-semibold">{result.verdict}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Post-release footprint" value={formatKg(result.postFootprint)} detail={`Baseline ${formatKg(scenario.baselineFootprintKgco2e)}`} icon={Gauge} tone={result.ownFootprintImproved ? 'emerald' : 'rose'} />
            <LabMetric label="Absolute footprint change" value={`${result.footprintReduction >= 0 ? '-' : '+'}${formatKg(Math.abs(result.footprintReduction))}`} detail="Negative display means a reduction" icon={BarChart3} tone={result.ownFootprintImproved ? 'blue' : 'rose'} />
            <LabMetric label="Monthly service uses" value={Math.round(result.postUses).toLocaleString()} detail={`${demandGrowthPercent}% above the baseline`} icon={UsersRound} tone={demandGrowthPercent >= 75 ? 'amber' : 'cyan'} />
            <LabMetric label="Evidence-supported outcome" value={result.hasExternalOutcome ? result.supportedAdditionalOutcome.toFixed(1) : 'Not claimed'} detail={result.hasExternalOutcome ? scenario.outcomeUnit : 'This intervention changes only the system ledger'} icon={Leaf} tone={result.claimReady ? 'emerald' : result.hasExternalOutcome ? 'amber' : 'neutral'} />
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <LedgerComparison title="AI system footprint" label="kgCO2e per month" baseline={scenario.baselineFootprintKgco2e} after={result.postFootprint} baselineLabel="Baseline" afterLabel="After intervention and demand" tone={result.ownFootprintImproved ? 'blue' : 'rose'} />
            <LedgerComparison title="External environmental outcome" label={scenario.outcomeUnit} baseline={result.reportedAdditionalOutcome} after={result.supportedAdditionalOutcome} baselineLabel="Reported additional outcome" afterLabel="Evidence-supported amount" tone="violet" />
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-start gap-3">
              <ClipboardCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Claim gate</p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Every row must stand on its own evidence. Passing this model is a review prompt, not certification.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Gate passed={result.ownFootprintImproved} label="Absolute footprint falls" />
              <Gate passed={result.hasExternalOutcome} label="External outcome is separately measured" />
              <Gate passed={result.hasCounterfactual} label="Counterfactual baseline is observed" />
              <Gate passed={result.independentlyReviewed} label="Evidence receives independent review" />
              <Gate passed={monitorDurability} label="Durability and leakage are monitored" />
              <Gate passed={result.claimReady} label="Bounded contribution claim is reviewable" />
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LedgerComparison({ title, label, baseline, after, baselineLabel, afterLabel, tone }: { title: string; label: string; baseline: number; after: number; baselineLabel: string; afterLabel: string; tone: 'blue' | 'rose' | 'violet' }) {
  const max = Math.max(baseline, after, 1);
  const afterBar = { blue: 'bg-blue-500 dark:bg-blue-400', rose: 'bg-rose-500 dark:bg-rose-400', violet: 'bg-violet-500 dark:bg-violet-400' }[tone];

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-4 space-y-4">
        <ComparisonBar label={baselineLabel} value={baseline} width={baseline / max * 100} className="bg-neutral-400 dark:bg-neutral-500" />
        <ComparisonBar label={afterLabel} value={after} width={after / max * 100} className={afterBar} />
      </div>
    </div>
  );
}

function ComparisonBar({ label, value, width, className }: { label: string; value: number; width: number; className: string }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-xs">
        <span className="leading-5 text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">{value.toFixed(value >= 100 ? 0 : 1)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${className}`} style={{ width: `${Math.max(2, width)}%` }} />
      </div>
    </div>
  );
}

function Gate({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${passed ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'}`}>
      {passed ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="leading-5">{label}</span>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Impact claim lab" title="Stress-test a regenerative claim" description="Loading the lesson-owned intervention and evidence model." icon={Scale} accent="violet" />
      <LearningLabBody>
        <div className="flex min-h-64 items-center justify-center text-center">
          {error ? (
            <div className="max-w-md" role="alert">
              <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Claim scenarios could not be loaded</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
              <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500">
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <div role="status">
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
              <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading claim model...</p>
            </div>
          )}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
