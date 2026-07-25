'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  Grid3X3,
  Layers3,
  ListChecks,
  RefreshCw,
  ScanSearch,
  Split,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PlanId = 'point' | 'depth-sweep' | 'full-grid';

interface Workload {
  id: string;
  label: string;
  detail: string;
  factsPerCase: number;
  casesPerCell: number;
  scorer: string;
  claim: string;
}

interface Plan {
  id: PlanId;
  label: string;
  detail: string;
}

interface DistractorLevel {
  id: string;
  label: string;
  detail: string;
  caseMultiplier: number;
}

interface CoverageGridData {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    planId: PlanId;
    distractorId: string;
    maximumContextK: number;
  };
  contextLengthsK: number[];
  evidenceDepthsPct: number[];
  focusDepthPct: number;
  workloads: Workload[];
  plans: Plan[];
  distractorLevels: DistractorLevel[];
}

const DEFAULT_DATA_FILE =
  '/api/content/genai/long-context-evaluation/data/evaluation-coverage-model.json';
const BLOCK_ID = 'genai/long-context-evaluation-coverage-grid-lab';

function isCoverageGridData(value: unknown): value is CoverageGridData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CoverageGridData>;
  return Boolean(
    data.title
      && data.description
      && data.defaults
      && Array.isArray(data.contextLengthsK)
      && data.contextLengthsK.length > 0
      && data.contextLengthsK.every((item) => typeof item === 'number')
      && Array.isArray(data.evidenceDepthsPct)
      && data.evidenceDepthsPct.length > 0
      && data.evidenceDepthsPct.every((item) => typeof item === 'number')
      && Array.isArray(data.workloads)
      && data.workloads.length > 0
      && Array.isArray(data.plans)
      && data.plans.length > 0
      && Array.isArray(data.distractorLevels)
      && data.distractorLevels.length > 0,
  );
}

function planIcon(planId: PlanId) {
  if (planId === 'point') return Target;
  if (planId === 'depth-sweep') return Split;
  return Grid3X3;
}

export default function LongContextEvaluationCoverageGridLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CoverageGridData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [workloadId, setWorkloadId] = useState('');
  const [planId, setPlanId] = useState<PlanId>('point');
  const [distractorId, setDistractorId] = useState('');
  const [maximumContextIndex, setMaximumContextIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isCoverageGridData(payload)) {
          throw new Error('Coverage-grid data is incomplete.');
        }

        const defaultContextIndex = Math.max(
          0,
          payload.contextLengthsK.indexOf(payload.defaults.maximumContextK),
        );
        setData(payload);
        setWorkloadId(payload.defaults.workloadId);
        setPlanId(payload.defaults.planId);
        setDistractorId(payload.defaults.distractorId);
        setMaximumContextIndex(defaultContextIndex);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the coverage model.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const workload = data?.workloads.find((item) => item.id === workloadId) ?? data?.workloads[0];
  const plan = data?.plans.find((item) => item.id === planId) ?? data?.plans[0];
  const distractor =
    data?.distractorLevels.find((item) => item.id === distractorId)
    ?? data?.distractorLevels[0];

  const model = useMemo(() => {
    if (!data || !workload || !plan || !distractor) return null;

    const maximumContextK =
      data.contextLengthsK[maximumContextIndex] ?? data.contextLengthsK[0];
    const activeLengths = plan.id === 'full-grid'
      ? data.contextLengthsK.filter((length) => length <= maximumContextK)
      : [maximumContextK];
    const activeDepths = plan.id === 'point'
      ? [data.focusDepthPct]
      : data.evidenceDepthsPct;
    const cells = activeLengths.length * activeDepths.length;
    const cases = cells * workload.casesPerCell * distractor.caseMultiplier;
    const embeddedFacts = cases * workload.factsPerCase;
    const coveragePct = Math.round(
      cells / (data.contextLengthsK.length * data.evidenceDepthsPct.length) * 100,
    );

    const claimBoundary = plan.id === 'point'
      ? 'One cell is a smoke test. It cannot establish a usable context window.'
      : plan.id === 'depth-sweep'
        ? `This can expose position sensitivity at ${maximumContextK}K, but not length degradation.`
        : `This maps tested behavior through ${maximumContextK}K across every listed depth.`;

    return {
      activeDepths,
      activeLengths,
      cases,
      cells,
      claimBoundary,
      coveragePct,
      embeddedFacts,
      maximumContextK,
    };
  }, [data, distractor, maximumContextIndex, plan, workload]);

  function reset() {
    if (!data) return;
    setWorkloadId(data.defaults.workloadId);
    setPlanId(data.defaults.planId);
    setDistractorId(data.defaults.distractorId);
    setMaximumContextIndex(
      Math.max(0, data.contextLengthsK.indexOf(data.defaults.maximumContextK)),
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evaluation coverage lab"
          title={data?.title ?? 'Design evidence across length and position'}
          description={
            data?.description
            ?? 'Loading the illustrative evaluation-planning model...'
          }
          icon={Grid3X3}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !workload || !plan || !distractor || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Behavior under test
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.workloads.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === workload.id}
                        label={item.label}
                        detail={item.detail}
                        icon={
                          item.id === 'single-retrieval'
                            ? ScanSearch
                            : item.id === 'multi-hop'
                              ? Layers3
                              : ListChecks
                        }
                        accent={
                          item.id === 'single-retrieval'
                            ? 'cyan'
                            : item.id === 'multi-hop'
                              ? 'violet'
                              : 'amber'
                        }
                        onClick={() => setWorkloadId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Sweep design
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.plans.map((item) => {
                      const Icon = planIcon(item.id);
                      return (
                        <LabChoice
                          key={item.id}
                          selected={item.id === plan.id}
                          label={item.label}
                          detail={item.detail}
                          icon={Icon}
                          accent={item.id === 'full-grid' ? 'emerald' : 'blue'}
                          onClick={() => setPlanId(item.id)}
                        />
                      );
                    })}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Maximum tested length"
                  value={maximumContextIndex}
                  output={`${model.maximumContextK}K tokens`}
                  min={0}
                  max={data.contextLengthsK.length - 1}
                  step={1}
                  lowLabel={`${data.contextLengthsK[0]}K`}
                  highLabel={`${data.contextLengthsK[data.contextLengthsK.length - 1]}K`}
                  accent="blue"
                  onChange={setMaximumContextIndex}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    4. Distractor pressure
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.distractorLevels.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === distractor.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'adversarial' ? AlertTriangle : FileSearch}
                        accent={item.id === 'adversarial' ? 'rose' : 'amber'}
                        onClick={() => setDistractorId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Covered cells"
                  value={`${model.cells} / ${data.contextLengthsK.length * data.evidenceDepthsPct.length}`}
                  detail={`${model.coveragePct}% of the shown length-by-depth grid`}
                  icon={Grid3X3}
                  tone={model.coveragePct >= 80 ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Evaluation cases"
                  value={model.cases.toLocaleString()}
                  detail={`${workload.casesPerCell} base cases per active cell`}
                  icon={ListChecks}
                  tone="blue"
                />
                <LabMetric
                  label="Embedded facts"
                  value={model.embeddedFacts.toLocaleString()}
                  detail={`${workload.factsPerCase} required facts per case`}
                  icon={Layers3}
                  tone="violet"
                />
                <LabMetric
                  label="Scoring contract"
                  value={workload.scorer}
                  detail="Score evidence use, not answer overlap alone"
                  icon={Target}
                  tone="cyan"
                />
              </div>

              <section aria-labelledby="coverage-matrix-title">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-300">
                      Length × evidence position
                    </p>
                    <h4
                      id="coverage-matrix-title"
                      className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white"
                    >
                      Make every claimed region visible
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Filled cells run; outlined cells remain untested.
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto pb-2">
                  <div className="min-w-[560px]">
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: `88px repeat(${data.evidenceDepthsPct.length}, minmax(72px, 1fr))`,
                      }}
                    >
                      <div />
                      {data.evidenceDepthsPct.map((depth) => (
                        <div
                          key={depth}
                          className="px-2 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                        >
                          {depth}% depth
                        </div>
                      ))}
                      {[...data.contextLengthsK].reverse().map((length) => (
                        <MatrixRow
                          key={length}
                          length={length}
                          depths={data.evidenceDepthsPct}
                          activeLengths={model.activeLengths}
                          activeDepths={model.activeDepths}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div
                className={`rounded-md border p-4 ${
                  model.coveragePct >= 80
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                    : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {model.coveragePct >= 80 ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">Claim boundary</p>
                    <p className="mt-1 text-sm leading-6">{model.claimBoundary}</p>
                    <p className="mt-2 text-sm leading-6 opacity-80">{workload.claim}</p>
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The counts are an illustrative planning model, not measured model
                performance. Repeat each active cell with deterministic seeds and
                product-shaped documents before drawing a release conclusion.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function MatrixRow({
  length,
  depths,
  activeLengths,
  activeDepths,
}: {
  length: number;
  depths: number[];
  activeLengths: number[];
  activeDepths: number[];
}) {
  return (
    <>
      <div className="flex items-center text-sm font-semibold text-neutral-700 dark:text-neutral-200">
        {length}K
      </div>
      {depths.map((depth) => {
        const active = activeLengths.includes(length) && activeDepths.includes(depth);
        return (
          <div
            key={`${length}-${depth}`}
            aria-label={`${length}K tokens at ${depth}% depth: ${active ? 'included' : 'not included'}`}
            className={`flex h-12 items-center justify-center rounded-md border text-xs font-semibold ${
              active
                ? 'border-cyan-500 bg-cyan-100 text-cyan-950 shadow-sm dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50'
                : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500'
            }`}
          >
            {active ? 'RUN' : '—'}
          </div>
        );
      })}
    </>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300"
          />
          <div>
            <p className="font-semibold text-neutral-950 dark:text-white">
              {error ? 'The coverage model could not load' : 'Loading coverage model'}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {error ?? 'Preparing the length-by-position planning grid.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
