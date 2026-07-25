'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Combine,
  Gauge,
  Image,
  Layers3,
  MessageSquareText,
  Presentation,
  Search,
  ShieldCheck,
  Type,
  Warehouse,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/multi-modal-ai-systems-fusion-architecture-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/multi-modal-ai-systems/data/fusion-architecture-model.json';

type ArchitectureId = 'dual-encoder' | 'cross-attention' | 'late-gated';
type CrossModalRule = 'one-score' | 'token-pairs' | 'decision-votes';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  primaryModality: string;
  secondaryModality: string;
  interactionNeed: number;
  precomputeValue: number;
  missingRobustnessNeed: number;
  groundingNeed: number;
  recommendedArchitectureId: ArchitectureId;
};

type Architecture = {
  id: ArchitectureId;
  label: string;
  detail: string;
  interactionCapacity: number;
  precomputeSupport: number;
  missingRobustness: number;
  groundingCapacity: number;
  crossModalRule: CrossModalRule;
  mergeLabel: string;
  degradedBehavior: string;
};

type FusionArchitectureData = {
  kind: 'fusion-architecture';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  note: string;
  defaults: {
    workloadId: string;
    architectureId: ArchitectureId;
    visualTokens: number;
    languageTokens: number;
  };
  ranges: {
    visualTokens: RangeDefinition;
    languageTokens: RangeDefinition;
  };
  workloads: Workload[];
  architectures: Architecture[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isArchitectureId(value: unknown): value is ArchitectureId {
  return value === 'dual-encoder' || value === 'cross-attention' || value === 'late-gated';
}

function isRange(value: unknown): value is RangeDefinition {
  return (
    isRecord(value)
    && isNumber(value.min)
    && isNumber(value.max)
    && isNumber(value.step)
    && value.min < value.max
    && value.step > 0
  );
}

function isFusionArchitectureData(value: unknown): value is FusionArchitectureData {
  if (
    !isRecord(value)
    || value.kind !== 'fusion-architecture'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.note !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.workloadId !== 'string'
    || !isArchitectureId(value.defaults.architectureId)
    || !isNumber(value.defaults.visualTokens)
    || !isNumber(value.defaults.languageTokens)
    || !isRecord(value.ranges)
    || !isRange(value.ranges.visualTokens)
    || !isRange(value.ranges.languageTokens)
    || !Array.isArray(value.workloads)
    || value.workloads.length < 2
    || !Array.isArray(value.architectures)
    || value.architectures.length < 2
  ) {
    return false;
  }

  const workloadsValid = value.workloads.every((workload) => (
    isRecord(workload)
    && typeof workload.id === 'string'
    && typeof workload.label === 'string'
    && typeof workload.detail === 'string'
    && typeof workload.primaryModality === 'string'
    && typeof workload.secondaryModality === 'string'
    && isNumber(workload.interactionNeed)
    && isNumber(workload.precomputeValue)
    && isNumber(workload.missingRobustnessNeed)
    && isNumber(workload.groundingNeed)
    && isArchitectureId(workload.recommendedArchitectureId)
  ));
  const architecturesValid = value.architectures.every((architecture) => (
    isRecord(architecture)
    && isArchitectureId(architecture.id)
    && typeof architecture.label === 'string'
    && typeof architecture.detail === 'string'
    && isNumber(architecture.interactionCapacity)
    && isNumber(architecture.precomputeSupport)
    && isNumber(architecture.missingRobustness)
    && isNumber(architecture.groundingCapacity)
    && (
      architecture.crossModalRule === 'one-score'
      || architecture.crossModalRule === 'token-pairs'
      || architecture.crossModalRule === 'decision-votes'
    )
    && typeof architecture.mergeLabel === 'string'
    && typeof architecture.degradedBehavior === 'string'
  ));
  const defaults = value.defaults;

  return (
    workloadsValid
    && architecturesValid
    && value.workloads.some((item) => item.id === defaults.workloadId)
    && value.architectures.some((item) => item.id === defaults.architectureId)
  );
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

const workloadIcons = {
  'catalog-retrieval': Search,
  'visual-support': MessageSquareText,
  'meeting-search': Presentation,
  'warehouse-inspection': Warehouse,
};

const architectureIcons: Record<ArchitectureId, typeof Boxes> = {
  'dual-encoder': Boxes,
  'cross-attention': Combine,
  'late-gated': ShieldCheck,
};

export default function MultiModalAISystemsFusionArchitectureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<FusionArchitectureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the fusion model (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFusionArchitectureData(payload)) {
          throw new Error('The fusion architecture data contract is invalid.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the fusion lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : (
        <FusionArchitectureLab data={data} />
      )}
    </div>
  );
}

function FusionArchitectureLab({ data }: { data: FusionArchitectureData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [architectureId, setArchitectureId] = useState<ArchitectureId>(
    data.defaults.architectureId,
  );
  const [visualTokens, setVisualTokens] = useState(data.defaults.visualTokens);
  const [languageTokens, setLanguageTokens] = useState(data.defaults.languageTokens);

  const workload =
    data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const architecture =
    data.architectures.find((item) => item.id === architectureId) ?? data.architectures[0];

  const result = useMemo(() => {
    const gaps = {
      interaction: Math.abs(workload.interactionNeed - architecture.interactionCapacity),
      precompute: Math.abs(workload.precomputeValue - architecture.precomputeSupport),
      resilience: Math.abs(
        workload.missingRobustnessNeed - architecture.missingRobustness,
      ),
      grounding: Math.abs(workload.groundingNeed - architecture.groundingCapacity),
    };
    const fitScore = clamp(Math.round(
      100
      - gaps.interaction * 0.35
      - gaps.precompute * 0.25
      - gaps.resilience * 0.2
      - gaps.grounding * 0.2,
    ));
    const crossModalComparisons = architecture.crossModalRule === 'token-pairs'
      ? visualTokens * languageTokens
      : architecture.crossModalRule === 'decision-votes'
        ? 2
        : 1;
    const interactionLabel = architecture.crossModalRule === 'token-pairs'
      ? 'token pairs per layer'
      : architecture.crossModalRule === 'decision-votes'
        ? 'decision streams'
        : 'embedding score';

    return {
      crossModalComparisons,
      fitScore,
      gaps,
      interactionLabel,
      recommended: workload.recommendedArchitectureId === architecture.id,
    };
  }, [architecture, languageTokens, visualTokens, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setArchitectureId(data.defaults.architectureId);
    setVisualTokens(data.defaults.visualTokens);
    setLanguageTokens(data.defaults.languageTokens);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Fusion architecture lab"
        title={data.title}
        description={data.description}
        icon={Combine}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload
              </legend>
              <div className="mt-3 space-y-2">
                {data.workloads.map((item) => {
                  const Icon = workloadIcons[item.id as keyof typeof workloadIcons] ?? Layers3;
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Fusion boundary
              </legend>
              <div className="mt-3 space-y-2">
                {data.architectures.map((item) => {
                  const Icon = architectureIcons[item.id];
                  return (
                    <LabChoice
                      key={item.id}
                      selected={item.id === architecture.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Icon}
                      accent={item.id === 'cross-attention' ? 'violet' : item.id === 'late-gated' ? 'emerald' : 'cyan'}
                      onClick={() => setArchitectureId(item.id)}
                    />
                  );
                })}
              </div>
            </fieldset>

            <LabRange
              label="3. Visual evidence tokens"
              value={visualTokens}
              output={visualTokens.toLocaleString()}
              min={data.ranges.visualTokens.min}
              max={data.ranges.visualTokens.max}
              step={data.ranges.visualTokens.step}
              lowLabel="Coarse regions"
              highLabel="Fine regions"
              accent="violet"
              onChange={setVisualTokens}
            />

            <LabRange
              label="4. Language tokens"
              value={languageTokens}
              output={languageTokens.toLocaleString()}
              min={data.ranges.languageTokens.min}
              max={data.ranges.languageTokens.max}
              step={data.ranges.languageTokens.step}
              lowLabel="Short query"
              highLabel="Long context"
              accent="blue"
              onChange={setLanguageTokens}
            />
          </div>
        )}
      >
        <div className="min-h-[760px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Task fit"
              value={`${result.fitScore} / 100`}
              detail={result.recommended ? 'Matches the fixture recommendation' : 'A different boundary fits this fixture better'}
              icon={result.recommended ? CheckCircle2 : AlertTriangle}
              tone={result.recommended ? 'emerald' : result.fitScore >= 70 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Cross-modal work"
              value={formatCount(result.crossModalComparisons)}
              detail={result.interactionLabel}
              icon={Gauge}
              tone="violet"
            />
            <LabMetric
              label="Precompute fit"
              value={`${architecture.precomputeSupport}%`}
              detail="Relative support for computing one side before requests arrive"
              icon={Boxes}
              tone="blue"
            />
            <LabMetric
              label="Missing-input design"
              value={`${architecture.missingRobustness}%`}
              detail="Relative ability to expose or route around an unavailable path"
              icon={ShieldCheck}
              tone="cyan"
            />
          </div>

          <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Selected evidence path
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  {workload.label}
                </h4>
              </div>
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Sequence lengths are explicit inputs, not latency estimates
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.15fr)] md:items-center">
              <EvidenceNode
                icon={Image}
                label={workload.primaryModality}
                detail={`${visualTokens.toLocaleString()} visual tokens`}
                tone="violet"
              />
              <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 md:block" />
              <EvidenceNode
                icon={Type}
                label={workload.secondaryModality}
                detail={`${languageTokens.toLocaleString()} language tokens`}
                tone="blue"
              />
              <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 md:block" />
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                  <Combine aria-hidden="true" className="h-4 w-4" />
                  {architecture.mergeLabel}
                </div>
                <p className="mt-2 text-sm font-semibold">{architecture.label}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">
                  {formatCount(result.crossModalComparisons)} {result.interactionLabel}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
              Fit follows the task contract
            </h4>
            <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              A shorter gap means the architecture capability is closer to what this workload needs.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FitRow
                label="Cross-modal interaction"
                need={workload.interactionNeed}
                capability={architecture.interactionCapacity}
                gap={result.gaps.interaction}
              />
              <FitRow
                label="Precomputation"
                need={workload.precomputeValue}
                capability={architecture.precomputeSupport}
                gap={result.gaps.precompute}
              />
              <FitRow
                label="Missing-input robustness"
                need={workload.missingRobustnessNeed}
                capability={architecture.missingRobustness}
                gap={result.gaps.resilience}
              />
              <FitRow
                label="Fine grounding"
                need={workload.groundingNeed}
                capability={architecture.groundingCapacity}
                gap={result.gaps.grounding}
              />
            </div>
          </section>

          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">When one path degrades</p>
            <p className="mt-1 leading-6">{architecture.degradedBehavior}</p>
          </div>

          <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {data.note}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidenceNode({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: typeof Image;
  label: string;
  detail: string;
  tone: 'blue' | 'violet';
}) {
  const styles = tone === 'violet'
    ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50'
    : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50';

  return (
    <div className={`rounded-md border p-4 ${styles}`}>
      <Icon aria-hidden="true" className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}

function FitRow({
  label,
  need,
  capability,
  gap,
}: {
  label: string;
  need: number;
  capability: number;
  gap: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{label}</p>
        <span className={`text-xs font-semibold ${gap <= 15 ? 'text-emerald-700 dark:text-emerald-300' : gap <= 35 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
          {gap <= 15 ? 'Close fit' : gap <= 35 ? 'Trade-off' : 'Large gap'}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <ScoreBar label="Task need" value={need} color="bg-neutral-500" />
        <ScoreBar label="Capability" value={capability} color="bg-violet-500" />
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_28px] items-center gap-2">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${clamp(value)}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
        {value}
      </span>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
        <p className="font-semibold">Fusion architecture lab unavailable</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="not-prose my-7 h-[520px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading fusion architecture lab"
      role="status"
    />
  );
}
