'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Gauge,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  ScanText,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Workload = {
  id: string;
  label: string;
  detail: string;
  widthPx: number;
  heightPx: number;
  minimumCoveragePct: number;
  riskWhenCapped: string;
};

type BudgetData = {
  title: string;
  description: string;
  sourceNote: string;
  patchPixels: number;
  maxDetailPatches: number;
  queryTokensPerView: number;
  promptTokens: number;
  answerReserveTokens: number;
  tokenBudgetOptions: number[];
  defaults: {
    workloadId: string;
    imageCount: number;
    detailPatchCap: number;
    tokenBudget: number;
  };
  workloads: Workload[];
};

const BLOCK_ID = 'genai/blip3-xgen-mm-visual-token-budget-lab';

function positiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isBudgetData(value: unknown): value is BudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BudgetData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.sourceNote
      && positiveNumber(candidate.patchPixels)
      && positiveNumber(candidate.maxDetailPatches)
      && positiveNumber(candidate.queryTokensPerView)
      && positiveNumber(candidate.promptTokens)
      && positiveNumber(candidate.answerReserveTokens)
      && candidate.defaults?.workloadId
      && positiveNumber(candidate.defaults.imageCount)
      && positiveNumber(candidate.defaults.detailPatchCap)
      && positiveNumber(candidate.defaults.tokenBudget)
      && Array.isArray(candidate.tokenBudgetOptions)
      && candidate.tokenBudgetOptions.length > 0
      && candidate.tokenBudgetOptions.every(positiveNumber)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((workload) => (
        typeof workload.id === 'string'
        && typeof workload.label === 'string'
        && typeof workload.detail === 'string'
        && positiveNumber(workload.widthPx)
        && positiveNumber(workload.heightPx)
        && positiveNumber(workload.minimumCoveragePct)
        && typeof workload.riskWhenCapped === 'string'
      )),
  );
}

export default function Blip3XgenMmVisualTokenBudgetLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No visual-token workload data was supplied.');
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
        if (!isBudgetData(payload)) throw new Error('Visual-token workload data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the visual-token lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <VisualTokenLab data={data} />;
}

function VisualTokenLab({ data }: { data: BudgetData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [imageCount, setImageCount] = useState(data.defaults.imageCount);
  const [detailPatchCap, setDetailPatchCap] = useState(data.defaults.detailPatchCap);
  const [tokenBudget, setTokenBudget] = useState(data.defaults.tokenBudget);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const model = useMemo(() => {
    const columns = Math.ceil(workload.widthPx / data.patchPixels);
    const rows = Math.ceil(workload.heightPx / data.patchPixels);
    const requestedDetailPatches = Math.min(columns * rows, data.maxDetailPatches);
    const appliedDetailPatches = Math.min(requestedDetailPatches, detailPatchCap);
    const viewsPerImage = 1 + appliedDetailPatches;
    const visualTokens = imageCount * viewsPerImage * data.queryTokensPerView;
    const modeledTokens = data.promptTokens + visualTokens + data.answerReserveTokens;
    const evidenceCoveragePct = appliedDetailPatches / requestedDetailPatches * 100;
    const fitsBudget = modeledTokens <= tokenBudget;
    const coversDetail = evidenceCoveragePct >= workload.minimumCoveragePct;

    const state = !fitsBudget
      ? {
          label: 'Input budget exceeded',
          detail: `The request is ${modeledTokens - tokenBudget} tokens over the selected application budget. Reduce images or detail patches, or route to a larger measured context policy instead of silently dropping evidence.`,
          tone: 'rose' as const,
          icon: TriangleAlert,
        }
      : !coversDetail
        ? {
            label: 'The request fits, but detail evidence is exposed',
            detail: workload.riskWhenCapped,
            tone: 'amber' as const,
            icon: TriangleAlert,
          }
        : {
            label: 'Visual evidence fits the modeled budget',
            detail: 'The global view and selected detail patches fit. The next release gate is measured grounding and OCR quality on this workload slice.',
            tone: 'emerald' as const,
            icon: CheckCircle2,
          };

    return {
      appliedDetailPatches,
      columns,
      coversDetail,
      evidenceCoveragePct,
      fitsBudget,
      modeledTokens,
      requestedDetailPatches,
      rows,
      state,
      viewsPerImage,
      visualTokens,
    };
  }, [data, detailPatchCap, imageCount, tokenBudget, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setImageCount(data.defaults.imageCount);
    setDetailPatchCap(data.defaults.detailPatchCap);
    setTokenBudget(data.defaults.tokenBudget);
  }

  const StateIcon = model.state.icon;
  const railScale = Math.max(model.modeledTokens, tokenBudget);
  const promptPct = data.promptTokens / railScale * 100;
  const visualPct = model.visualTokens / railScale * 100;
  const answerPct = data.answerReserveTokens / railScale * 100;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Patch and token budget lab"
          title={data.title}
          description={data.description}
          icon={Grid2X2}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Visual workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'receipt' ? ScanText : item.id === 'scene' ? ImageIcon : Grid2X2}
                      accent={item.id === 'receipt' ? 'cyan' : item.id === 'scene' ? 'blue' : 'violet'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Images in sequence"
                value={imageCount}
                output={String(imageCount)}
                min={1}
                max={4}
                step={1}
                accent="blue"
                lowLabel="One image"
                highLabel="Interleaved set"
                onChange={setImageCount}
              />

              <LabRange
                label="3. Detail-patch cap per image"
                value={detailPatchCap}
                output={`${detailPatchCap} patches`}
                min={1}
                max={data.maxDetailPatches}
                step={1}
                accent="violet"
                lowLabel="Compress hard"
                highLabel="Preserve detail"
                onChange={setDetailPatchCap}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Application input budget
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {data.tokenBudgetOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={option === tokenBudget}
                      onClick={() => setTokenBudget(option)}
                      className={`h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        option === tokenBudget
                          ? 'border-cyan-500 bg-cyan-100 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                      }`}
                    >
                      {option / 1024}K
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Encoded views"
                value={`${model.viewsPerImage} / image`}
                detail={`One global view plus ${model.appliedDetailPatches} detail patches`}
                icon={ImageIcon}
                tone="blue"
              />
              <LabMetric
                label="Visual tokens"
                value={model.visualTokens.toLocaleString()}
                detail={`${data.queryTokensPerView} sampler queries per encoded view`}
                icon={Layers3}
                tone="violet"
              />
              <LabMetric
                label="Detail coverage"
                value={`${model.evidenceCoveragePct.toFixed(0)}%`}
                detail={`Modeled threshold for this slice: ${workload.minimumCoveragePct}%`}
                icon={ScanText}
                tone={model.coversDetail ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Budget state"
                value={model.fitsBudget ? 'Fits' : 'Overflow'}
                detail={`${model.modeledTokens.toLocaleString()} of ${tokenBudget.toLocaleString()} tokens modeled`}
                icon={Gauge}
                tone={model.fitsBudget ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    One image after any-resolution preprocessing
                  </p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    {workload.widthPx} x {workload.heightPx} pixels
                  </h4>
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {model.rows} x {model.columns} requested grid, capped at {data.maxDetailPatches}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(120px,0.55fr)_minmax(0,1.45fr)]">
                <div className="flex min-h-36 flex-col items-center justify-center rounded-md border-2 border-blue-300 bg-blue-100 p-3 text-center text-blue-950 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-50">
                  <ImageIcon aria-hidden="true" className="h-7 w-7" />
                  <p className="mt-2 text-sm font-semibold">Global view</p>
                  <p className="mt-1 text-xs opacity-75">Whole-image context</p>
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.min(4, model.columns)}, minmax(0, 1fr))` }}
                  aria-label={`${model.appliedDetailPatches} of ${model.requestedDetailPatches} detail patches retained`}
                >
                  {Array.from({ length: model.requestedDetailPatches }, (_, index) => {
                    const retained = index < model.appliedDetailPatches;
                    return (
                      <div
                        key={index}
                        className={`flex min-h-16 items-center justify-center rounded-md border text-xs font-semibold tabular-nums ${
                          retained
                            ? 'border-violet-400 bg-violet-100 text-violet-950 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-50'
                            : 'border-dashed border-neutral-300 bg-white text-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-500'
                        }`}
                      >
                        {retained ? `Detail ${index + 1}` : `Capped ${index + 1}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Modeled sequence allocation</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                    Prompt + visual evidence + answer reserve
                  </h4>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                  {model.modeledTokens.toLocaleString()} / {tokenBudget.toLocaleString()}
                </p>
              </div>
              <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className="bg-blue-500 dark:bg-blue-400" style={{ width: `${promptPct}%` }} title="Prompt tokens" />
                <div className="bg-violet-500 dark:bg-violet-400" style={{ width: `${visualPct}%` }} title="Visual tokens" />
                <div className="bg-amber-500 dark:bg-amber-400" style={{ width: `${answerPct}%` }} title="Answer reserve" />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />Prompt {data.promptTokens}</span>
                <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />Visual {model.visualTokens}</span>
                <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />Reserve {data.answerReserveTokens}</span>
              </div>
            </section>

            <section className={`rounded-md border p-4 ${
              model.state.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                : model.state.tone === 'rose'
                  ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
                  <h4 className="mt-1 font-semibold">{model.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{model.state.detail}</p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.sourceNote}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 min-h-[620px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading BLIP-3 visual-token budget lab"
    />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Visual-token budget lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
