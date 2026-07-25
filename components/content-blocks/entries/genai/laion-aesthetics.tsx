'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Filter,
  Fingerprint,
  Image as ImageIcon,
  Languages,
  Layers3,
  LoaderCircle,
  Scale,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Cohort = {
  id: string;
  label: string;
  detail: string;
  candidatesMillions: number;
  aestheticScore: number;
  alignmentScore: number;
  minimumSidePx: number;
  policyRiskPct: number;
  duplicatePct: number;
  provenanceCoveragePct: number;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  applySafety: boolean;
  deduplicate: boolean;
  requireRecordedProvenance: boolean;
};

type CurationModel = {
  kind: 'multimodal-curation-portfolio';
  title: string;
  description: string;
  defaults: {
    aestheticThreshold: number;
    alignmentThreshold: number;
    minimumSidePx: number;
    policyId: string;
  };
  ranges: {
    aestheticThreshold: { min: number; max: number; step: number };
    alignmentThreshold: { min: number; max: number; step: number };
    minimumSidePx: { min: number; max: number; step: number };
  };
  cohorts: Cohort[];
  policies: Policy[];
};

const BLOCK_ID = 'genai/laion-aesthetics';
const DEFAULT_DATA_FILE =
  '/api/content/genai/laion-aesthetics/data/curation-portfolio-model.json';

function isCurationModel(value: unknown): value is CurationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CurationModel>;
  return Boolean(
    candidate.kind === 'multimodal-curation-portfolio'
      && typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && candidate.ranges
      && Array.isArray(candidate.cohorts)
      && candidate.cohorts.length > 0
      && candidate.cohorts.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.candidatesMillions === 'number'
        && typeof item.aestheticScore === 'number'
        && typeof item.alignmentScore === 'number'
        && typeof item.minimumSidePx === 'number'
        && typeof item.policyRiskPct === 'number'
        && typeof item.duplicatePct === 'number'
        && typeof item.provenanceCoveragePct === 'number')
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((item) =>
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.applySafety === 'boolean'
        && typeof item.deduplicate === 'boolean'
        && typeof item.requireRecordedProvenance === 'boolean'),
  );
}

export default function LaionCurationCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CurationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [aestheticThreshold, setAestheticThreshold] = useState(0);
  const [alignmentThreshold, setAlignmentThreshold] = useState(0);
  const [minimumSidePx, setMinimumSidePx] = useState(0);
  const [policyId, setPolicyId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCurationModel(payload)) {
          throw new Error('The curation portfolio model is incomplete.');
        }
        setModel(payload);
        setAestheticThreshold(payload.defaults.aestheticThreshold);
        setAlignmentThreshold(payload.defaults.alignmentThreshold);
        setMinimumSidePx(payload.defaults.minimumSidePx);
        setPolicyId(payload.defaults.policyId);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load curation data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const policy = model?.policies.find((item) => item.id === policyId) ?? model?.policies[0];
  const result = useMemo(() => {
    if (!model || !policy) return null;

    const rows = model.cohorts.map((cohort) => {
      const scoreEligible =
        cohort.aestheticScore >= aestheticThreshold
        && cohort.alignmentScore >= alignmentThreshold
        && cohort.minimumSidePx >= minimumSidePx;
      const eligibleMillions = scoreEligible ? cohort.candidatesMillions : 0;
      const afterSafetyMillions = policy.applySafety
        ? eligibleMillions * (1 - cohort.policyRiskPct / 100)
        : eligibleMillions;
      const afterDedupeMillions = policy.deduplicate
        ? afterSafetyMillions * (1 - cohort.duplicatePct / 100)
        : afterSafetyMillions;
      const retainedMillions = policy.requireRecordedProvenance
        ? afterDedupeMillions * cohort.provenanceCoveragePct / 100
        : afterDedupeMillions;
      const retentionPct = retainedMillions / cohort.candidatesMillions * 100;
      return {
        ...cohort,
        eligibleMillions,
        retainedMillions,
        retentionPct,
        removedByPolicyMillions: eligibleMillions - afterSafetyMillions,
        removedAsDuplicateMillions: afterSafetyMillions - afterDedupeMillions,
        missingProvenanceMillions: afterDedupeMillions - retainedMillions,
        scoreEligible,
      };
    });

    const candidateMillions = rows.reduce((sum, row) => sum + row.candidatesMillions, 0);
    const eligibleMillions = rows.reduce((sum, row) => sum + row.eligibleMillions, 0);
    const retainedMillions = rows.reduce((sum, row) => sum + row.retainedMillions, 0);
    const policyRemovedMillions = rows.reduce(
      (sum, row) => sum + row.removedByPolicyMillions,
      0,
    );
    const duplicateRemovedMillions = rows.reduce(
      (sum, row) => sum + row.removedAsDuplicateMillions,
      0,
    );
    const provenanceHeldMillions = rows.reduce(
      (sum, row) => sum + row.missingProvenanceMillions,
      0,
    );
    const retainedRows = rows.filter((row) => row.retentionPct > 0);
    const retentionGapPct = retainedRows.length > 1
      ? Math.max(...retainedRows.map((row) => row.retentionPct))
        - Math.min(...retainedRows.map((row) => row.retentionPct))
      : 100;
    const highRiskEligibleMillions = policy.applySafety
      ? 0
      : rows.reduce(
        (sum, row) => sum + row.eligibleMillions * row.policyRiskPct / 100,
        0,
      );

    return {
      candidateMillions,
      duplicateRemovedMillions,
      eligibleMillions,
      highRiskEligibleMillions,
      policyRemovedMillions,
      provenanceHeldMillions,
      retainedMillions,
      retentionGapPct,
      rows,
    };
  }, [aestheticThreshold, alignmentThreshold, minimumSidePx, model, policy]);

  if (!model || !policy || !result) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Curation portfolio lab"
            title="See what every threshold removes"
            description="Loading illustrative multimodal slices and governance controls."
            icon={Filter}
            accent="violet"
          />
          <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ? (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
              >
                {error} Retry
              </button>
            ) : (
              <>
                <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
                Loading curation portfolio...
              </>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  const reset = () => {
    setAestheticThreshold(model.defaults.aestheticThreshold);
    setAlignmentThreshold(model.defaults.alignmentThreshold);
    setMinimumSidePx(model.defaults.minimumSidePx);
    setPolicyId(model.defaults.policyId);
  };
  const dangerous = result.highRiskEligibleMillions > 0;
  const empty = result.retainedMillions === 0;
  const concentrated = result.retentionGapPct > 35;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Curation portfolio lab"
          title={model.title}
          description={model.description}
          icon={Filter}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <div className="space-y-6">
                <LabRange
                  label="Predicted aesthetic floor"
                  value={aestheticThreshold}
                  output={aestheticThreshold.toFixed(1)}
                  {...model.ranges.aestheticThreshold}
                  lowLabel="broad style coverage"
                  highLabel="narrow preference"
                  accent="violet"
                  onChange={setAestheticThreshold}
                />
                <LabRange
                  label="Image-text alignment floor"
                  value={alignmentThreshold}
                  output={alignmentThreshold.toFixed(2)}
                  {...model.ranges.alignmentThreshold}
                  lowLabel="more noisy captions"
                  highLabel="narrow match"
                  accent="cyan"
                  onChange={setAlignmentThreshold}
                />
                <LabRange
                  label="Minimum shorter side"
                  value={minimumSidePx}
                  output={`${minimumSidePx} px`}
                  {...model.ranges.minimumSidePx}
                  lowLabel="small sources"
                  highLabel="large sources"
                  accent="blue"
                  onChange={setMinimumSidePx}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Governance policy
                </legend>
                <div className="mt-3 space-y-2">
                  {model.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'score-only' ? BarChart3 : ShieldCheck}
                      accent={item.id === 'score-only' ? 'rose' : item.id === 'safety-dedupe' ? 'amber' : 'emerald'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Score eligible"
                value={`${result.eligibleMillions.toFixed(1)}M`}
                detail={`of ${result.candidateMillions.toFixed(1)}M illustrative pairs`}
                icon={ImageIcon}
                tone="violet"
              />
              <LabMetric
                label="Manifest ready"
                value={`${result.retainedMillions.toFixed(1)}M`}
                detail="After selected governance controls"
                icon={Database}
                tone={dangerous || empty ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Policy removals"
                value={`${result.policyRemovedMillions.toFixed(1)}M`}
                detail={`${result.duplicateRemovedMillions.toFixed(1)}M duplicate-equivalent removals`}
                icon={ShieldCheck}
                tone={policy.applySafety ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Slice retention gap"
                value={`${result.retentionGapPct.toFixed(0)} pp`}
                detail="Largest minus smallest retained slice"
                icon={Scale}
                tone={concentrated ? 'rose' : 'cyan'}
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Cohort-level retention
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                  Aggregate teaching slices expose which content shapes disappear first.
                </p>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {result.rows.map((row) => (
                  <div key={row.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_100px_minmax(180px,1fr)] md:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {row.id === 'multilingual-scenes' ? (
                          <Languages aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                        ) : row.id === 'diagrams-documents' ? (
                          <Layers3 aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                        ) : (
                          <ImageIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                        )}
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{row.label}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{row.detail}</p>
                    </div>
                    <div className="text-sm tabular-nums text-neutral-700 dark:text-neutral-200">
                      <p className="font-semibold">{row.retainedMillions.toFixed(1)}M</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        of {row.candidatesMillions.toFixed(1)}M
                      </p>
                    </div>
                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full ${
                            row.retentionPct === 0
                              ? 'bg-rose-500'
                              : row.retentionPct < 35
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(row.retentionPct, row.retentionPct ? 3 : 0)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {row.scoreEligible ? `${row.retentionPct.toFixed(0)}% retained` : 'Excluded by score or size threshold'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-4 ${
                dangerous || empty || concentrated
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {dangerous || empty || concentrated ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {dangerous
                      ? 'Score thresholds are not a safety or rights policy'
                      : empty
                        ? 'No modeled cohort survives the selected thresholds'
                      : concentrated
                        ? 'The selected portfolio concentrates the retained corpus'
                        : 'The selected controls create a reviewable candidate manifest'}
                  </p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {dangerous
                      ? `${result.highRiskEligibleMillions.toFixed(1)}M modeled high-risk-equivalent pairs remain eligible because the selected policy applies no separate safety stage.`
                      : empty
                        ? 'Lower or redesign the score and size gates before evaluating governance policy; an empty manifest cannot support the intended training objective.'
                      : concentrated
                        ? 'Inspect excluded slices and downstream evaluations before accepting this trade-off; a high aggregate retention rate can hide total loss of a content shape.'
                        : `${result.provenanceHeldMillions.toFixed(1)}M pairs are held because recorded provenance is missing. Recorded source context still does not itself grant permission.`}
                  </p>
                </div>
              </div>
            </section>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Values are an illustrative cohort model, not measured LAION counts or predictor calibration.
              Aesthetic and CLIP scores are model-version-specific and should not be compared as universal units.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
