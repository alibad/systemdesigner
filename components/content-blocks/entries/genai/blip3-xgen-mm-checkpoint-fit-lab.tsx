'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  GitCompareArrows,
  Image,
  Layers3,
  Scale,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Benchmark = {
  id: string;
  label: string;
};

type Checkpoint = {
  id: string;
  label: string;
  parameterBillions: 4 | 14;
  curriculum: 'single-image' | 'multi-image';
  scores: Record<string, number>;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  requiresMultiImage: boolean;
  reasoningPriority: boolean;
  costSensitivity: 'high' | 'low';
  recommendedCheckpointId: string;
  failure: string;
};

type CheckpointData = {
  title: string;
  description: string;
  sourceNote: string;
  defaults: {
    scenarioId: string;
    checkpointId: string;
  };
  benchmarks: Benchmark[];
  checkpoints: Checkpoint[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/blip3-xgen-mm-checkpoint-fit-lab';

function isCheckpointData(value: unknown): value is CheckpointData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CheckpointData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.sourceNote
      && candidate.defaults?.scenarioId
      && candidate.defaults.checkpointId
      && Array.isArray(candidate.benchmarks)
      && candidate.benchmarks.length > 0
      && candidate.benchmarks.every((item) => typeof item.id === 'string' && typeof item.label === 'string')
      && Array.isArray(candidate.checkpoints)
      && candidate.checkpoints.length > 0
      && candidate.checkpoints.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && (item.parameterBillions === 4 || item.parameterBillions === 14)
        && (item.curriculum === 'single-image' || item.curriculum === 'multi-image')
        && item.scores
        && typeof item.scores === 'object'
        && Object.values(item.scores).every((score) => typeof score === 'number' && Number.isFinite(score))
        && typeof item.detail === 'string'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.requiresMultiImage === 'boolean'
        && typeof item.reasoningPriority === 'boolean'
        && (item.costSensitivity === 'high' || item.costSensitivity === 'low')
        && typeof item.recommendedCheckpointId === 'string'
        && typeof item.failure === 'string'
      )),
  );
}

export default function Blip3XgenMmCheckpointFitLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CheckpointData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No checkpoint comparison data was supplied.');
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
        if (!isCheckpointData(payload)) throw new Error('Checkpoint comparison data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the checkpoint lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <CheckpointFitLab data={data} />;
}

function CheckpointFitLab({ data }: { data: CheckpointData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [checkpointId, setCheckpointId] = useState(data.defaults.checkpointId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const checkpoint = data.checkpoints.find((item) => item.id === checkpointId) ?? data.checkpoints[0];
  const recommended = data.checkpoints.find((item) => item.id === scenario.recommendedCheckpointId) ?? data.checkpoints[0];

  const result = useMemo(() => {
    const curriculumFits = scenario.requiresMultiImage
      ? checkpoint.curriculum === 'multi-image'
      : checkpoint.curriculum === 'single-image';
    const sizeFits = scenario.reasoningPriority
      ? checkpoint.parameterBillions === 14
      : scenario.costSensitivity === 'high'
        ? checkpoint.parameterBillions === 4
        : true;
    const exactMatch = checkpoint.id === recommended.id;
    const scoreMean = data.benchmarks.reduce(
      (sum, benchmark) => sum + (checkpoint.scores[benchmark.id] ?? 0),
      0,
    ) / data.benchmarks.length;

    const state = exactMatch
      ? {
          label: 'Checkpoint matches the declared workload contract',
          detail: 'This is a defensible candidate, not a release decision. Validate the exact checkpoint on the workload slices and operating envelope.',
          tone: 'emerald' as const,
          icon: CheckCircle2,
        }
      : !curriculumFits
        ? {
            label: 'Training curriculum misses the input relationship',
            detail: scenario.failure,
            tone: 'rose' as const,
            icon: AlertTriangle,
          }
        : !sizeFits
          ? {
              label: scenario.reasoningPriority ? 'Capacity trade-off needs evidence' : 'Parameter-size pressure is avoidable',
              detail: scenario.reasoningPriority
                ? 'The smaller checkpoint may still work, but the declared workload prioritizes difficult reasoning. Compare it with the 14B candidate on the exact task before release.'
                : 'The larger checkpoint may improve some scores, but this workload prioritizes operating efficiency. Require a measured task gain before accepting the larger footprint.',
              tone: 'amber' as const,
              icon: Scale,
            }
          : {
              label: 'Viable curriculum with a different size trade-off',
              detail: 'The input format fits, but the selected size differs from the policy recommendation. Keep both candidates only if representative evaluation justifies the extra release complexity.',
              tone: 'amber' as const,
              icon: Scale,
            };

    return {
      curriculumFits,
      exactMatch,
      scoreMean,
      sizeFits,
      state,
    };
  }, [checkpoint, data.benchmarks, recommended.id, scenario]);

  const comparison = data.checkpoints.find((item) => (
    item.parameterBillions === checkpoint.parameterBillions
    && item.curriculum !== checkpoint.curriculum
  ));

  function chooseCheckpoint(
    parameterBillions: Checkpoint['parameterBillions'],
    curriculum: Checkpoint['curriculum'],
  ) {
    const next = data.checkpoints.find((item) => (
      item.parameterBillions === parameterBillions && item.curriculum === curriculum
    ));
    if (next) setCheckpointId(next.id);
  }

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setCheckpointId(data.defaults.checkpointId);
  }

  const StateIcon = result.state.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Checkpoint curriculum lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Product workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.requiresMultiImage ? GitCompareArrows : Image}
                      accent={item.reasoningPriority ? 'violet' : item.requiresMultiImage ? 'cyan' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Declared contract</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500 dark:text-neutral-400">Input relationship</dt>
                    <dd className="font-semibold text-neutral-950 dark:text-white">{scenario.requiresMultiImage ? 'Multi-image' : 'Single-image'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500 dark:text-neutral-400">Reasoning priority</dt>
                    <dd className="font-semibold text-neutral-950 dark:text-white">{scenario.reasoningPriority ? 'High' : 'Moderate'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-neutral-500 dark:text-neutral-400">Cost sensitivity</dt>
                    <dd className="font-semibold capitalize text-neutral-950 dark:text-white">{scenario.costSensitivity}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Build the candidate checkpoint</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <fieldset>
                  <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Language-model size</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([4, 14] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={checkpoint.parameterBillions === size}
                        onClick={() => chooseCheckpoint(size, checkpoint.curriculum)}
                        className={`min-h-16 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          checkpoint.parameterBillions === size
                            ? 'border-violet-500 bg-violet-100 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950 dark:text-violet-50'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                        }`}
                      >
                        <span className="block text-base font-semibold">{size}B</span>
                        <span className="mt-1 block text-xs opacity-75">{size === 4 ? 'Lower size pressure' : 'More model capacity'}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Final instruction curriculum</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['single-image', 'multi-image'] as const).map((curriculum) => (
                      <button
                        key={curriculum}
                        type="button"
                        aria-pressed={checkpoint.curriculum === curriculum}
                        onClick={() => chooseCheckpoint(checkpoint.parameterBillions, curriculum)}
                        className={`min-h-16 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          checkpoint.curriculum === curriculum
                            ? 'border-cyan-500 bg-cyan-100 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{curriculum === 'single-image' ? 'Single-image SFT' : 'Multi-image SFT'}</span>
                        <span className="mt-1 block text-xs opacity-75">{curriculum === 'single-image' ? 'One image per instruction' : 'Interleaved image sets'}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Candidate" value={checkpoint.label} detail={checkpoint.detail} icon={Layers3} tone="cyan" />
              <LabMetric label="Curriculum fit" value={result.curriculumFits ? 'Aligned' : 'Mismatch'} detail={scenario.requiresMultiImage ? 'Workload requires cross-image behavior' : 'Workload uses one image per request'} icon={Workflow} tone={result.curriculumFits ? 'emerald' : 'rose'} />
              <LabMetric label="Size proxy" value={`${(checkpoint.parameterBillions / 4).toFixed(checkpoint.parameterBillions === 4 ? 0 : 1)}x`} detail="Parameter-count ratio versus 4B; not measured latency" icon={Scale} tone={result.sizeFits ? 'blue' : 'amber'} />
              <LabMetric label="Table 2 mean" value={result.scoreMean.toFixed(1)} detail="Mean shown for orientation; inspect each benchmark separately" icon={BrainCircuit} tone="violet" />
            </div>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Training path</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">Capabilities accumulate through the curriculum</h4>
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Selected: {checkpoint.label}</p>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['1', 'Base alignment', '384-pixel pretraining', true],
                  ['2', 'High resolution', 'Any-resolution pretraining', true],
                  ['3', 'Single-image SFT', 'Instruction following', true],
                  ['4', 'Multi-image SFT', 'Interleaved behavior', checkpoint.curriculum === 'multi-image'],
                ].map(([number, label, detail, active]) => (
                  <li
                    key={String(number)}
                    className={`rounded-md border p-3 ${
                      active
                        ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50'
                        : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'}`}>{number}</span>
                      <span className="text-sm font-semibold">{label}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Paper Table 2</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">Multi-image benchmark profile</h4>
                </div>
                {comparison ? <p className="text-xs text-neutral-500 dark:text-neutral-400">Compared with {comparison.label}</p> : null}
              </div>
              <div className="mt-5 space-y-4">
                {data.benchmarks.map((benchmark) => {
                  const selectedScore = checkpoint.scores[benchmark.id] ?? 0;
                  const comparisonScore = comparison?.scores[benchmark.id] ?? 0;
                  return (
                    <div key={benchmark.id}>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-100">{benchmark.label}</span>
                        <span className="font-semibold tabular-nums text-cyan-800 dark:text-cyan-200">{selectedScore.toFixed(1)}</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                          <div className="h-full rounded-full bg-cyan-500 dark:bg-cyan-400" style={{ width: `${selectedScore}%` }} />
                        </div>
                        {comparison ? (
                          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" aria-label={`${comparison.label} scored ${comparisonScore.toFixed(1)}`}>
                            <div className="h-full rounded-full bg-neutral-500 dark:bg-neutral-400" style={{ width: `${comparisonScore}%` }} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-md border p-4 ${
              result.state.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                : result.state.tone === 'rose'
                  ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
                  <h4 className="mt-1 font-semibold">{result.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{result.state.detail}</p>
                  {!result.exactMatch ? (
                    <p className="mt-3 text-sm font-semibold">Policy candidate: {recommended.label}</p>
                  ) : null}
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
      aria-label="Loading BLIP-3 checkpoint fit lab"
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
      <p className="font-semibold">Checkpoint fit lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
