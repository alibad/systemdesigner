'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSearch,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Benchmark = {
  id: string;
  label: string;
  capability: string;
  traits: string[];
};

type Product = {
  id: string;
  label: string;
  detail: string;
  criticalTraits: string[];
  weights: Record<string, number>;
};

type EvidenceMode = {
  id: string;
  label: string;
  detail: string;
  compatibleProductIds: string[];
  claimLimit: string;
};

type PortfolioData = {
  defaultProductId: string;
  defaultEvidenceModeId: string;
  defaultSampleSize: number;
  minimumSliceItems: number;
  benchmarks: Benchmark[];
  products: Product[];
  evidenceModes: EvidenceMode[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/world-knowledge-benchmarks/data/benchmark-portfolio.json';

function isPortfolioData(value: unknown): value is PortfolioData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PortfolioData>;
  return typeof candidate.defaultProductId === 'string'
    && typeof candidate.defaultEvidenceModeId === 'string'
    && typeof candidate.defaultSampleSize === 'number'
    && typeof candidate.minimumSliceItems === 'number'
    && Array.isArray(candidate.benchmarks)
    && candidate.benchmarks.length > 0
    && Array.isArray(candidate.products)
    && candidate.products.length > 0
    && Array.isArray(candidate.evidenceModes)
    && candidate.evidenceModes.length > 0;
}

function allocateItems(
  benchmarks: Benchmark[],
  weights: Record<string, number>,
  sampleSize: number,
) {
  const allocation = benchmarks.map((benchmark) => {
    const exact = sampleSize * ((weights[benchmark.id] ?? 0) / 100);
    return {
      benchmark,
      count: Math.floor(exact),
      fraction: exact - Math.floor(exact),
      weight: weights[benchmark.id] ?? 0,
    };
  });

  let remaining = sampleSize - allocation.reduce((sum, item) => sum + item.count, 0);
  const byFraction = [...allocation].sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; remaining > 0; index += 1, remaining -= 1) {
    byFraction[index % byFraction.length].count += 1;
  }
  return allocation;
}

function readableTrait(trait: string) {
  return trait.replaceAll('-', ' ');
}

export default function WorldKnowledgeBenchmarksPortfolioLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [productId, setProductId] = useState('');
  const [evidenceModeId, setEvidenceModeId] = useState('');
  const [sampleSize, setSampleSize] = useState(900);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isPortfolioData(payload)) throw new Error('Benchmark portfolio data is incomplete.');
        if (!active) return;
        setData(payload);
        setProductId(payload.defaultProductId);
        setEvidenceModeId(payload.defaultEvidenceModeId);
        setSampleSize(payload.defaultSampleSize);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the portfolio.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const product = data?.products.find((item) => item.id === productId) ?? data?.products[0];
  const evidenceMode = data?.evidenceModes.find((item) => item.id === evidenceModeId)
    ?? data?.evidenceModes[0];

  const model = useMemo(() => {
    if (!data || !product || !evidenceMode) return null;
    const allocation = allocateItems(data.benchmarks, product.weights, sampleSize);
    const diagnosticSlices = allocation.filter((item) => item.count >= data.minimumSliceItems);
    const coveredTraits = new Set(
      diagnosticSlices.flatMap((item) => item.benchmark.traits),
    );
    const missingTraits = product.criticalTraits.filter((trait) => !coveredTraits.has(trait));
    const modeCompatible = evidenceMode.compatibleProductIds.includes(product.id);
    const coveredWeight = diagnosticSlices.reduce((sum, item) => sum + item.weight, 0);
    const coveragePct = Math.round(
      100 * (product.criticalTraits.length - missingTraits.length) / product.criticalTraits.length,
    );

    let status: 'ready' | 'expand' | 'mismatch';
    let decision: string;
    let explanation: string;
    if (!modeCompatible) {
      status = 'mismatch';
      decision = 'Change the evidence contract';
      explanation = `${evidenceMode.label} does not match the declared ${product.label.toLowerCase()} behavior.`;
    } else if (missingTraits.length > 0 || coveredWeight < 80) {
      status = 'expand';
      decision = 'Expand the diagnostic sample';
      explanation = missingTraits.length > 0
        ? `The sample does not yet cover ${missingTraits.map(readableTrait).join(', ')} at the diagnostic floor.`
        : `Only ${coveredWeight}% of the declared portfolio has at least ${data.minimumSliceItems} items.`;
    } else {
      status = 'ready';
      decision = 'Freeze this evaluation contract';
      explanation = 'Evidence mode, critical traits, and slice depth align. Version the sample before scoring candidates.';
    }

    return {
      allocation,
      coveragePct,
      coveredWeight,
      decision,
      explanation,
      missingTraits,
      modeCompatible,
      status,
    };
  }, [data, evidenceMode, product, sampleSize]);

  function reset() {
    if (!data) return;
    setProductId(data.defaultProductId);
    setEvidenceModeId(data.defaultEvidenceModeId);
    setSampleSize(data.defaultSampleSize);
  }

  return (
    <div data-content-block="genai/world-knowledge-benchmarks-portfolio-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence contract lab"
          title="Make the benchmark portfolio earn the claim"
          description="Choose the product behavior, sample depth, and evidence mode. Coverage and the release consequence update from the same contract."
          icon={Target}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !product || !evidenceMode || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Product claim
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.products.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === product.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'document-reader' ? BookOpenCheck : item.id === 'trivia-feature' ? Brain : Search}
                        accent={item.id === 'document-reader' ? 'emerald' : item.id === 'trivia-feature' ? 'violet' : 'blue'}
                        onClick={() => setProductId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Total evaluated questions"
                  value={sampleSize}
                  output={sampleSize.toLocaleString()}
                  min={300}
                  max={1800}
                  step={100}
                  lowLabel="Fast diagnostic"
                  highLabel="Deeper slices"
                  accent="violet"
                  onChange={setSampleSize}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Evidence mode
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.evidenceModes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === evidenceMode.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'closed-book' ? Brain : item.id === 'retrieved-corpus' ? Database : FileSearch}
                        accent={item.id === 'closed-book' ? 'violet' : item.id === 'retrieved-corpus' ? 'blue' : 'emerald'}
                        onClick={() => setEvidenceModeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <LabMetric
                  label="Critical trait coverage"
                  value={`${model.coveragePct}%`}
                  detail="Required behaviors represented above the slice floor"
                  icon={Target}
                  tone={model.coveragePct === 100 ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Diagnostic portfolio weight"
                  value={`${model.coveredWeight}%`}
                  detail={`Each counted slice has at least ${data.minimumSliceItems} questions`}
                  icon={BarChart3}
                  tone={model.coveredWeight >= 80 ? 'blue' : 'amber'}
                />
                <LabMetric
                  label="Evidence fit"
                  value={model.modeCompatible ? 'Aligned' : 'Mismatched'}
                  detail={evidenceMode.claimLimit}
                  icon={model.modeCompatible ? CheckCircle2 : ShieldAlert}
                  tone={model.modeCompatible ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Blind spots"
                  value={String(model.missingTraits.length)}
                  detail={model.missingTraits.length > 0 ? model.missingTraits.map(readableTrait).join(', ') : 'All critical traits sampled'}
                  icon={CircleAlert}
                  tone={model.missingTraits.length > 0 ? 'amber' : 'cyan'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">{product.label} portfolio</h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{product.detail}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Floor: {data.minimumSliceItems} each
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {model.allocation.map((item) => {
                    const covered = item.count >= data.minimumSliceItems;
                    return (
                      <div key={item.benchmark.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{item.benchmark.label}</p>
                          <p className="tabular-nums text-neutral-600 dark:text-neutral-300">
                            {item.count} questions / {item.weight}%
                          </p>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div
                            className={`h-full rounded-full ${covered ? 'bg-violet-500 dark:bg-violet-400' : 'bg-amber-500 dark:bg-amber-400'}`}
                            style={{ width: `${Math.max(3, item.weight)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          {item.benchmark.capability}{covered ? '' : ' / below the diagnostic floor'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section
                aria-live="polite"
                className={`rounded-md border p-4 ${model.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : model.status === 'mismatch' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}
              >
                <div className="flex items-start gap-3">
                  {model.status === 'ready' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : model.status === 'mismatch' ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{model.decision}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{model.explanation}</p>
                    <p className="mt-2 text-xs leading-5 opacity-75">{evidenceMode.claimLimit}</p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <ShieldAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Portfolio data did not load</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading evaluation contract...
        </div>
      )}
    </div>
  );
}
