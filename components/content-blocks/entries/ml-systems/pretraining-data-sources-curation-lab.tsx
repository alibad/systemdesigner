'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Binary,
  BookX,
  Filter,
  Fingerprint,
  FlaskConical,
  Languages,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
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
  '/api/content/ml-systems/pretraining-data-sources/data/curation-threshold-model.json';
const BLOCK_ID = 'ml-systems/pretraining-data-sources-curation-lab';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type CorpusCohorts = {
  cleanUniquePct: number;
  lowQualityPct: number;
  duplicatePct: number;
  longTailPct: number;
};

type CorpusScenario = {
  id: string;
  label: string;
  detail: string;
  rawTokensB: number;
  cohorts: CorpusCohorts;
  longTailSensitivity: number;
  evaluationOverlapPct: number;
};

type DecontaminationPolicy = {
  id: string;
  label: string;
  detail: string;
  overlapRemovalPct: number;
  collateralPct: number;
};

type CurationData = {
  kind: 'curation-threshold';
  blockId: string;
  title: string;
  description: string;
  note: string;
  defaults: {
    scenarioId: string;
    qualityThreshold: number;
    similarityThreshold: number;
    decontaminationId: string;
  };
  ranges: {
    qualityThreshold: RangeDefinition;
    similarityThreshold: RangeDefinition;
  };
  scenarios: CorpusScenario[];
  decontaminationPolicies: DecontaminationPolicy[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isRange(value: unknown): value is RangeDefinition {
  return (
    isRecord(value)
    && isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0
  );
}

function isCohorts(value: unknown): value is CorpusCohorts {
  if (!isRecord(value)) return false;
  const shares = [
    value.cleanUniquePct,
    value.lowQualityPct,
    value.duplicatePct,
    value.longTailPct,
  ];
  return (
    shares.every(isPercent)
    && shares.reduce<number>((sum, share) => sum + Number(share), 0) === 100
  );
}

function isCurationData(value: unknown): value is CurationData {
  if (
    !isRecord(value)
    || value.kind !== 'curation-threshold'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || !isRecord(value.defaults)
    || !isRecord(value.ranges)
    || !isRange(value.ranges.qualityThreshold)
    || !isRange(value.ranges.similarityThreshold)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 2
    || !Array.isArray(value.decontaminationPolicies)
    || value.decontaminationPolicies.length < 2
  ) {
    return false;
  }

  const defaults = value.defaults;
  if (
    typeof defaults.scenarioId !== 'string'
    || !isFiniteNumber(defaults.qualityThreshold)
    || !isFiniteNumber(defaults.similarityThreshold)
    || typeof defaults.decontaminationId !== 'string'
  ) {
    return false;
  }

  const scenariosValid = value.scenarios.every((scenario) => (
    isRecord(scenario)
    && typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && isFiniteNumber(scenario.rawTokensB)
    && scenario.rawTokensB > 0
    && isCohorts(scenario.cohorts)
    && isPercent(scenario.longTailSensitivity)
    && isPercent(scenario.evaluationOverlapPct)
  ));
  if (!scenariosValid) return false;

  const policiesValid = value.decontaminationPolicies.every((policy) => (
    isRecord(policy)
    && typeof policy.id === 'string'
    && typeof policy.label === 'string'
    && typeof policy.detail === 'string'
    && isPercent(policy.overlapRemovalPct)
    && isPercent(policy.collateralPct)
  ));
  if (!policiesValid) return false;

  const scenarioIds = value.scenarios.map((scenario) => scenario.id);
  const policyIds = value.decontaminationPolicies.map((policy) => policy.id);
  return (
    new Set(scenarioIds).size === scenarioIds.length
    && new Set(policyIds).size === policyIds.length
    && scenarioIds.includes(defaults.scenarioId)
    && policyIds.includes(defaults.decontaminationId)
    && defaults.qualityThreshold >= value.ranges.qualityThreshold.min
    && defaults.qualityThreshold <= value.ranges.qualityThreshold.max
    && defaults.similarityThreshold >= value.ranges.similarityThreshold.min
    && defaults.similarityThreshold <= value.ranges.similarityThreshold.max
  );
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatTokens(value: number) {
  return `${Math.max(0, value).toFixed(value >= 100 ? 0 : 1)}B`;
}

function formatPercent(value: number, digits = 1) {
  return `${Math.max(0, value).toFixed(digits)}%`;
}

export default function PretrainingDataSourcesCurationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CurationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the curation model (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCurationData(payload)) {
          throw new Error('The curation-lab data contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the curation lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Curation lab unavailable</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="h-[34rem] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading curation lab"
        role="status"
      />
    );
  }

  return <CurationThresholdLab data={data} />;
}

function CurationThresholdLab({ data }: { data: CurationData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [qualityThreshold, setQualityThreshold] = useState(data.defaults.qualityThreshold);
  const [similarityThreshold, setSimilarityThreshold] = useState(
    data.defaults.similarityThreshold,
  );
  const [decontaminationId, setDecontaminationId] = useState(
    data.defaults.decontaminationId,
  );

  const scenario = data.scenarios.find((item) => item.id === scenarioId)
    ?? data.scenarios[0];
  const policy = data.decontaminationPolicies.find(
    (item) => item.id === decontaminationId,
  ) ?? data.decontaminationPolicies[0];

  const result = useMemo(() => {
    const qualityRange = data.ranges.qualityThreshold;
    const similarityRange = data.ranges.similarityThreshold;
    const qualityStrictness = clamp(
      (qualityThreshold - qualityRange.min) / (qualityRange.max - qualityRange.min),
    );
    const dedupAggressiveness = clamp(
      (similarityRange.max - similarityThreshold)
        / (similarityRange.max - similarityRange.min),
    );
    const raw = scenario.rawTokensB;
    const cohortTokens = {
      clean: raw * scenario.cohorts.cleanUniquePct / 100,
      lowQuality: raw * scenario.cohorts.lowQualityPct / 100,
      duplicate: raw * scenario.cohorts.duplicatePct / 100,
      longTail: raw * scenario.cohorts.longTailPct / 100,
    };

    const afterQualityByCohort = {
      clean: cohortTokens.clean * (0.995 - qualityStrictness * 0.08),
      lowQuality: cohortTokens.lowQuality * (0.72 - qualityStrictness * 0.64),
      duplicate: cohortTokens.duplicate * (0.98 - qualityStrictness * 0.16),
      longTail: cohortTokens.longTail * (
        0.97 - qualityStrictness * (scenario.longTailSensitivity / 100)
      ),
    };
    const afterQuality = Object.values(afterQualityByCohort).reduce(
      (sum, value) => sum + value,
      0,
    );

    const duplicateRemovalRate = 0.18 + dedupAggressiveness * 0.74;
    const cleanCollateralRate = 0.005 + dedupAggressiveness * 0.018;
    const longTailCollateralRate = 0.01 + dedupAggressiveness * 0.11;
    const duplicateRemoved = afterQualityByCohort.duplicate * duplicateRemovalRate;
    const cleanCollateral = afterQualityByCohort.clean * cleanCollateralRate;
    const longTailCollateral = afterQualityByCohort.longTail * longTailCollateralRate;
    const afterDedup = afterQuality - duplicateRemoved - cleanCollateral - longTailCollateral;
    const survivingDuplicates = afterQualityByCohort.duplicate - duplicateRemoved;
    const survivingLongTail = afterQualityByCohort.longTail - longTailCollateral;

    const overlapCandidates = afterDedup * scenario.evaluationOverlapPct / 100;
    const overlapRemoved = overlapCandidates * policy.overlapRemovalPct / 100;
    const decontaminationCollateral = afterDedup * policy.collateralPct / 100;
    const finalTokens = afterDedup - overlapRemoved - decontaminationCollateral;
    const remainingOverlapPct = scenario.evaluationOverlapPct
      * (1 - policy.overlapRemovalPct / 100);
    const duplicateSharePct = finalTokens > 0 ? survivingDuplicates / finalTokens * 100 : 0;
    const longTailRetentionPct = cohortTokens.longTail > 0
      ? survivingLongTail / cohortTokens.longTail * 100
      : 100;
    const totalRetentionPct = finalTokens / raw * 100;

    const stages = [
      {
        id: 'raw',
        label: 'Registered input',
        detail: 'Source snapshot with provenance and permission metadata.',
        value: raw,
        removed: 0,
      },
      {
        id: 'quality',
        label: 'After quality gate',
        detail: 'Rule and classifier decisions, measured by source and language slice.',
        value: afterQuality,
        removed: raw - afterQuality,
      },
      {
        id: 'dedup',
        label: 'After near-dedup',
        detail: 'Duplicate clusters removed with unique and long-tail collateral tracked.',
        value: afterDedup,
        removed: afterQuality - afterDedup,
      },
      {
        id: 'release',
        label: 'Release candidate',
        detail: 'Evaluation matches and policy collateral removed before tokenization.',
        value: finalTokens,
        removed: afterDedup - finalTokens,
      },
    ];

    const diagnosis = longTailRetentionPct < 65
      ? {
          tone: 'rose' as const,
          icon: BookX,
          title: 'The gate is erasing too much long-tail evidence',
          detail: `Only ${formatPercent(longTailRetentionPct)} of the illustrative long-tail cohort survives. Calibrate thresholds per language or source and inspect false rejections before release.`,
        }
      : remainingOverlapPct > 0.35
        ? {
            tone: 'rose' as const,
            icon: ShieldAlert,
            title: 'Evaluation overlap remains material',
            detail: `${formatPercent(remainingOverlapPct, 2)} of the release candidate is still modeled as benchmark-related. Expand the evaluation inventory and near-match review before training.`,
          }
        : duplicateSharePct > 6
          ? {
              tone: 'amber' as const,
              icon: TriangleAlert,
              title: 'Repeated exposure remains high',
              detail: `${formatPercent(duplicateSharePct)} of retained tokens are still modeled as duplicate-family content. Lower the similarity threshold carefully and inspect collateral clusters.`,
            }
          : totalRetentionPct < 55
            ? {
                tone: 'amber' as const,
                icon: TriangleAlert,
                title: 'The recipe keeps less than 55% of registered tokens',
                detail: 'A smaller corpus may be correct, but the compute plan and source mixture must use measured retained tokens rather than raw crawl size.',
              }
            : {
                tone: 'emerald' as const,
                icon: ShieldCheck,
                title: 'The illustrative gates are balanced',
                detail: 'Duplicate and overlap risk are bounded without collapsing long-tail retention. Validate this shape with labeled samples and downstream ablations.',
              };

    return {
      stages,
      finalTokens,
      duplicateSharePct,
      longTailRetentionPct,
      remainingOverlapPct,
      diagnosis,
    };
  }, [
    data.ranges.qualityThreshold,
    data.ranges.similarityThreshold,
    policy,
    qualityThreshold,
    scenario,
    similarityThreshold,
  ]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setQualityThreshold(data.defaults.qualityThreshold);
    setSimilarityThreshold(data.defaults.similarityThreshold);
    setDecontaminationId(data.defaults.decontaminationId);
  };
  const DiagnosisIcon = result.diagnosis.icon;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Curation decision lab"
        title={data.title}
        description={data.description}
        icon={Filter}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Corpus slice
              </p>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'multilingual-web' ? Languages : FlaskConical}
                    accent="emerald"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-6 border-t border-neutral-200 pr-8 pt-5 sm:pr-0 dark:border-neutral-800">
              <LabRange
                label="Quality threshold"
                value={qualityThreshold}
                output={`${qualityThreshold} / 100`}
                min={data.ranges.qualityThreshold.min}
                max={data.ranges.qualityThreshold.max}
                step={data.ranges.qualityThreshold.step}
                accent="emerald"
                lowLabel="Permissive"
                highLabel="Strict"
                onChange={setQualityThreshold}
              />
              <LabRange
                label="Near-duplicate similarity"
                value={similarityThreshold}
                output={`${similarityThreshold}%`}
                min={data.ranges.similarityThreshold.min}
                max={data.ranges.similarityThreshold.max}
                step={data.ranges.similarityThreshold.step}
                accent="violet"
                lowLabel="Broader matches"
                highLabel="Near-identical only"
                onChange={setSimilarityThreshold}
              />
            </div>

            <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evaluation protection
              </p>
              <div className="mt-3 space-y-2">
                {data.decontaminationPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Fingerprint}
                    accent="violet"
                    onClick={() => setDecontaminationId(item.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Release tokens"
            value={formatTokens(result.finalTokens)}
            detail={`From ${formatTokens(scenario.rawTokensB)} registered input.`}
            icon={BadgeCheck}
            tone="emerald"
          />
          <LabMetric
            label="Duplicate share"
            value={formatPercent(result.duplicateSharePct)}
            detail="Modeled repeated exposure after dedup."
            icon={Binary}
            tone={result.duplicateSharePct > 6 ? 'amber' : 'blue'}
          />
          <LabMetric
            label="Long-tail retained"
            value={formatPercent(result.longTailRetentionPct)}
            detail="Relative to the original long-tail cohort."
            icon={Languages}
            tone={result.longTailRetentionPct < 65 ? 'rose' : 'violet'}
          />
          <LabMetric
            label="Eval overlap"
            value={formatPercent(result.remainingOverlapPct, 2)}
            detail="Modeled benchmark-related content remaining."
            icon={ScanSearch}
            tone={result.remainingOverlapPct > 0.35 ? 'rose' : 'emerald'}
          />
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Token survival funnel
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Width encodes tokens retained relative to registered input.
              </p>
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {scenario.label}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {result.stages.map((stage, index) => {
              const width = Math.max(3, stage.value / scenario.rawTokensB * 100);
              return (
                <div key={stage.id}>
                  <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        <span className="mr-2 text-xs text-neutral-400">{index + 1}</span>
                        {stage.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                        {stage.detail}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {formatTokens(stage.value)}
                      </p>
                      {stage.removed > 0 ? (
                        <p className="text-xs tabular-nums text-rose-600 dark:text-rose-300">
                          -{formatTokens(stage.removed)} at this gate
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 h-4 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={`h-full transition-[width] motion-reduce:transition-none ${
                        index === 0
                          ? 'bg-blue-500 dark:bg-blue-400'
                          : index === 1
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : index === 2
                              ? 'bg-violet-500 dark:bg-violet-400'
                              : 'bg-amber-500 dark:bg-amber-400'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`mt-6 rounded-md border p-4 ${
            result.diagnosis.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              : result.diagnosis.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            <DiagnosisIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{result.diagnosis.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{result.diagnosis.detail}</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {data.note}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
