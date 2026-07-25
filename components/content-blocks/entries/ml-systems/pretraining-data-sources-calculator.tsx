'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Braces,
  ChartNoAxesCombined,
  CircleGauge,
  FileKey2,
  Globe2,
  Languages,
  Layers3,
  Scale,
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
  '/api/content/ml-systems/pretraining-data-sources/data/source-mixture-model.json';
const BLOCK_ID = 'ml-systems/pretraining-data-sources-calculator';

type SignalKey =
  | 'generalKnowledge'
  | 'code'
  | 'multilingual'
  | 'rightsConfidence';

type SourceSignals = Record<SignalKey, number> & {
  duplicateExposure: number;
};

type SourceFamily = {
  id: string;
  label: string;
  shortLabel: string;
  detail: string;
  defaultShare: number;
  signals: SourceSignals;
};

type ProductProfile = {
  id: string;
  label: string;
  detail: string;
  shares: Record<string, number>;
  minimumSignals: Record<SignalKey, number>;
};

type MixtureData = {
  kind: 'source-mixture';
  blockId: string;
  title: string;
  description: string;
  note: string;
  totalTokensB: number;
  defaultProfileId: string;
  sources: SourceFamily[];
  profiles: ProductProfile[];
};

const signalLabels: Array<{
  key: SignalKey;
  label: string;
  icon: typeof Globe2;
  color: string;
}> = [
  {
    key: 'generalKnowledge',
    label: 'General knowledge',
    icon: BookOpenCheck,
    color: 'bg-blue-500 dark:bg-blue-400',
  },
  {
    key: 'code',
    label: 'Code signal',
    icon: Braces,
    color: 'bg-violet-500 dark:bg-violet-400',
  },
  {
    key: 'multilingual',
    label: 'Multilingual reach',
    icon: Languages,
    color: 'bg-emerald-500 dark:bg-emerald-400',
  },
  {
    key: 'rightsConfidence',
    label: 'Rights confidence',
    icon: FileKey2,
    color: 'bg-amber-500 dark:bg-amber-400',
  },
];

const sourceColors = [
  'bg-blue-500 dark:bg-blue-400',
  'bg-emerald-500 dark:bg-emerald-400',
  'bg-violet-500 dark:bg-violet-400',
  'bg-amber-500 dark:bg-amber-400',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFinitePercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasSignals(value: unknown): value is SourceSignals {
  if (!isRecord(value)) return false;
  return [
    value.generalKnowledge,
    value.code,
    value.multilingual,
    value.rightsConfidence,
    value.duplicateExposure,
  ].every(isFinitePercent);
}

function isMixtureData(value: unknown): value is MixtureData {
  if (!isRecord(value) || value.kind !== 'source-mixture' || value.blockId !== BLOCK_ID) {
    return false;
  }
  if (
    typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || typeof value.totalTokensB !== 'number'
    || value.totalTokensB <= 0
    || typeof value.defaultProfileId !== 'string'
    || !Array.isArray(value.sources)
    || value.sources.length < 3
    || !Array.isArray(value.profiles)
    || value.profiles.length < 2
  ) {
    return false;
  }

  const sourcesValid = value.sources.every((source) => (
    isRecord(source)
    && typeof source.id === 'string'
    && typeof source.label === 'string'
    && typeof source.shortLabel === 'string'
    && typeof source.detail === 'string'
    && isFinitePercent(source.defaultShare)
    && hasSignals(source.signals)
  ));
  if (!sourcesValid) return false;

  const sourceIds = value.sources.map((source) => source.id);
  if (new Set(sourceIds).size !== sourceIds.length) return false;

  const profilesValid = value.profiles.every((profile) => {
    if (
      !isRecord(profile)
      || typeof profile.id !== 'string'
      || typeof profile.label !== 'string'
      || typeof profile.detail !== 'string'
      || !isRecord(profile.shares)
      || !isRecord(profile.minimumSignals)
    ) {
      return false;
    }
    const sharesById = profile.shares;
    const minimumSignalsByKey = profile.minimumSignals;
    const shares = sourceIds.map((id) => sharesById[id]);
    const minimumSignals = signalLabels.map(({ key }) => minimumSignalsByKey[key]);
    return (
      shares.every(isFinitePercent)
      && shares.reduce<number>((sum, share) => sum + Number(share), 0) === 100
      && minimumSignals.every(isFinitePercent)
    );
  });

  return (
    profilesValid
    && value.profiles.some((profile) => profile.id === value.defaultProfileId)
  );
}

function rebalanceShares(
  current: Record<string, number>,
  sourceIds: string[],
  changedId: string,
  requestedShare: number,
) {
  const nextShare = Math.max(0, Math.min(100, Math.round(requestedShare)));
  const otherIds = sourceIds.filter((id) => id !== changedId);
  const remaining = 100 - nextShare;
  const previousOtherTotal = otherIds.reduce((sum, id) => sum + (current[id] ?? 0), 0);
  const exact = otherIds.map((id) => (
    previousOtherTotal > 0
      ? remaining * ((current[id] ?? 0) / previousOtherTotal)
      : remaining / otherIds.length
  ));
  const allocations = exact.map(Math.floor);
  let remainder = remaining - allocations.reduce((sum, value) => sum + value, 0);

  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remainder > 0) {
        allocations[index] += 1;
        remainder -= 1;
      }
    });

  return Object.fromEntries([
    [changedId, nextShare],
    ...otherIds.map((id, index) => [id, allocations[index]]),
  ]);
}

function formatTokens(tokensB: number) {
  if (tokensB >= 1000) return `${(tokensB / 1000).toFixed(2)}T`;
  return `${Math.round(tokensB).toLocaleString()}B`;
}

export default function PretrainingDataSourcesMixtureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<MixtureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the source-mixture model (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMixtureData(payload)) {
          throw new Error('The source-mixture data contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the source-mixture lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Source-mixture lab unavailable</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="h-96 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading source-mixture lab"
        role="status"
      />
    );
  }

  return <SourceMixtureLab data={data} />;
}

function SourceMixtureLab({ data }: { data: MixtureData }) {
  const defaultProfile = data.profiles.find((profile) => profile.id === data.defaultProfileId)
    ?? data.profiles[0];
  const [profileId, setProfileId] = useState(defaultProfile.id);
  const [shares, setShares] = useState<Record<string, number>>(defaultProfile.shares);

  const profile = data.profiles.find((item) => item.id === profileId) ?? defaultProfile;
  const result = useMemo(() => {
    const weighted = (key: keyof SourceSignals) => data.sources.reduce(
      (sum, source) => sum + source.signals[key] * ((shares[source.id] ?? 0) / 100),
      0,
    );
    const signals = Object.fromEntries(
      signalLabels.map(({ key }) => [key, weighted(key)]),
    ) as Record<SignalKey, number>;
    const duplicateExposure = weighted('duplicateExposure');
    const concentration = data.sources.reduce(
      (sum, source) => sum + ((shares[source.id] ?? 0) / 100) ** 2,
      0,
    );
    const sourceRows = data.sources.map((source) => ({
      ...source,
      share: shares[source.id] ?? 0,
      tokensB: data.totalTokensB * ((shares[source.id] ?? 0) / 100),
    }));
    const gaps = signalLabels
      .map(({ key, label }) => ({
        key,
        label,
        score: signals[key],
        target: profile.minimumSignals[key],
        gap: signals[key] - profile.minimumSignals[key],
      }))
      .sort((left, right) => left.gap - right.gap);

    const diagnosis = gaps[0].gap < 0
      ? {
          tone: 'rose' as const,
          icon: TriangleAlert,
          title: `${gaps[0].label} misses the ${profile.label} target`,
          detail: `The illustrative signal is ${gaps[0].score.toFixed(0)} against a target of ${gaps[0].target}. Rebalance toward sources that contribute this evidence, then verify with pilot training.`,
        }
      : concentration >= 0.44
        ? {
            tone: 'amber' as const,
            icon: TriangleAlert,
            title: 'One source family dominates the mixture',
            detail: 'The targets pass, but concentration increases correlated provenance, quality, and outage risk. Check whether the largest source has become a hidden single point of failure.',
          }
        : duplicateExposure >= 13
          ? {
              tone: 'amber' as const,
              icon: TriangleAlert,
              title: 'The mixture carries high duplicate pressure',
              detail: 'Reserve more deduplication capacity and inspect repeated domains, templates, forks, and cross-snapshot copies before freezing token weights.',
            }
          : {
              tone: 'emerald' as const,
              icon: ShieldCheck,
              title: 'The illustrative mixture clears its capability floor',
              detail: 'This is a planning hypothesis, not a release decision. Confirm permissions, slice quality, and downstream capability with sampled evidence and pilot runs.',
            };

    return {
      signals,
      duplicateExposure,
      concentration,
      sourceRows,
      diagnosis,
    };
  }, [data.sources, data.totalTokensB, profile, shares]);

  const reset = () => {
    setProfileId(defaultProfile.id);
    setShares(defaultProfile.shares);
  };

  const chooseProfile = (nextProfile: ProductProfile) => {
    setProfileId(nextProfile.id);
    setShares(nextProfile.shares);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Source mixture studio"
        title={data.title}
        description={data.description}
        icon={Layers3}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Product goal
              </p>
              <div className="mt-3 space-y-2">
                {data.profiles.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === profile.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ChartNoAxesCombined}
                    accent="blue"
                    onClick={() => chooseProfile(item)}
                  />
                ))}
              </div>
            </div>
            <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Token allocation
              </p>
              <div className="mt-4 space-y-5 pr-8 sm:pr-0">
                {data.sources.map((source, index) => (
                  <LabRange
                    key={source.id}
                    label={source.label}
                    value={shares[source.id] ?? 0}
                    output={`${shares[source.id] ?? 0}%`}
                    min={0}
                    max={100}
                    step={1}
                    accent={index === 0 ? 'blue' : index === 1 ? 'emerald' : index === 2 ? 'violet' : 'amber'}
                    lowLabel="None"
                    highLabel="All tokens"
                    onChange={(nextShare) => setShares((current) => rebalanceShares(
                      current,
                      data.sources.map((item) => item.id),
                      source.id,
                      nextShare,
                    ))}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <LabMetric
            label="Corpus budget"
            value={formatTokens(data.totalTokensB)}
            detail="The source shares always sum to 100%."
            icon={Scale}
            tone="blue"
          />
          <LabMetric
            label="Duplicate exposure"
            value={`${result.duplicateExposure.toFixed(1)}%`}
            detail="Weighted planning estimate before curation."
            icon={CircleGauge}
            tone={result.duplicateExposure >= 13 ? 'amber' : 'emerald'}
          />
          <LabMetric
            label="Concentration"
            value={`${Math.round(result.concentration * 100)} / 100`}
            detail="Higher means the corpus depends on fewer source families."
            icon={Layers3}
            tone={result.concentration >= 0.44 ? 'amber' : 'neutral'}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                One-trillion-token allocation
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Moving one source redistributes the remaining share proportionally.
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
              {result.sourceRows.reduce((sum, source) => sum + source.share, 0)}%
            </span>
          </div>
          <div
            className="mt-3 flex h-12 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
            aria-label="Token allocation by source family"
          >
            {result.sourceRows.map((source, index) => (
              <div
                key={source.id}
                className={`flex min-w-0 items-center justify-center transition-[width] motion-reduce:transition-none ${sourceColors[index % sourceColors.length]}`}
                style={{ width: `${source.share}%` }}
                title={`${source.label}: ${source.share}%`}
              >
                {source.share >= 12 ? (
                  <span className="truncate px-2 text-xs font-semibold text-white">
                    {source.shortLabel}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {result.sourceRows.map((source, index) => (
              <div
                key={source.id}
                className="flex min-w-0 items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60"
              >
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${sourceColors[index % sourceColors.length]}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {source.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {formatTokens(source.tokensB)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    {source.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <CircleGauge aria-hidden="true" className="h-4 w-4 text-neutral-500" />
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
              Capability and governance signals
            </p>
          </div>
          <div className="mt-4 space-y-4">
            {signalLabels.map(({ key, label, icon: Icon, color }) => {
              const score = result.signals[key];
              const target = profile.minimumSignals[key];
              return (
                <div key={key}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-semibold text-neutral-700 dark:text-neutral-200">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {label}
                    </span>
                    <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                      {score.toFixed(0)} signal / {target} target
                    </span>
                  </div>
                  <div className="relative mt-2 h-3 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className={`h-3 rounded-full transition-[width] motion-reduce:transition-none ${color}`}
                      style={{ width: `${score}%` }}
                    />
                    <span
                      className="absolute top-[-3px] h-[18px] w-0.5 bg-neutral-950 dark:bg-white"
                      style={{ left: `${target}%` }}
                      title={`${label} target: ${target}`}
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
            <result.diagnosis.icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
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
