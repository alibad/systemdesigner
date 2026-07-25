'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  CircleAlert,
  Grid3X3,
  LoaderCircle,
  Network,
  RefreshCw,
  Thermometer,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

const BLOCK_ID = 'genai/clip-architecture-contrastive-batch-lab';

type Range = {
  min: number;
  max: number;
  step: number;
};

type BatchScenario = {
  id: string;
  label: string;
  detail: string;
  collisionRate: number;
  observation: string;
  recommendation: string;
  imageLabels: string[];
  textLabels: string[];
  ambiguousCells: string[];
  similarities: number[][];
};

type ContrastiveBatchModel = {
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    globalBatchSize: number;
    logitScale: number;
  };
  bounds: {
    globalBatchSize: Range;
    logitScale: Range;
  };
  scenarios: BatchScenario[];
};

type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRange(value: unknown): value is Range {
  if (!value || typeof value !== 'object') return false;
  const range = value as Partial<Range>;
  return Boolean(
    isFiniteNumber(range.min)
      && isFiniteNumber(range.max)
      && isFiniteNumber(range.step)
      && range.min < range.max
      && range.step > 0,
  );
}

function isBatchScenario(value: unknown): value is BatchScenario {
  if (!value || typeof value !== 'object') return false;
  const scenario = value as Partial<BatchScenario>;
  const size = scenario.imageLabels?.length ?? 0;
  return Boolean(
    scenario.id
      && scenario.label
      && scenario.detail
      && scenario.observation
      && scenario.recommendation
      && isFiniteNumber(scenario.collisionRate)
      && scenario.collisionRate >= 0
      && Array.isArray(scenario.imageLabels)
      && size >= 3
      && Array.isArray(scenario.textLabels)
      && scenario.textLabels.length === size
      && Array.isArray(scenario.ambiguousCells)
      && scenario.ambiguousCells.every((cell) => typeof cell === 'string')
      && Array.isArray(scenario.similarities)
      && scenario.similarities.length === size
      && scenario.similarities.every((row) => (
        Array.isArray(row)
          && row.length === size
          && row.every(isFiniteNumber)
      )),
  );
}

function isContrastiveBatchModel(value: unknown): value is ContrastiveBatchModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<ContrastiveBatchModel>;
  return Boolean(
    model.blockId === BLOCK_ID
      && model.title
      && model.description
      && model.defaults?.scenarioId
      && isFiniteNumber(model.defaults.globalBatchSize)
      && isFiniteNumber(model.defaults.logitScale)
      && isRange(model.bounds?.globalBatchSize)
      && isRange(model.bounds?.logitScale)
      && Array.isArray(model.scenarios)
      && model.scenarios.length >= 3
      && model.scenarios.every(isBatchScenario)
      && model.scenarios.some((scenario) => scenario.id === model.defaults?.scenarioId),
  );
}

function softmax(values: number[]) {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function transpose(matrix: number[][]) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function directionalLoss(logits: number[][]) {
  const probabilities = logits.map(softmax);
  const loss = probabilities.reduce(
    (sum, row, index) => sum - Math.log(Math.max(row[index], 1e-12)),
    0,
  ) / probabilities.length;
  const recallAt1 = probabilities.filter((row, index) => (
    row.indexOf(Math.max(...row)) === index
  )).length / probabilities.length;
  return { loss, probabilities, recallAt1 };
}

function formatMiB(bytes: number) {
  const mib = bytes / (1024 * 1024);
  return mib >= 10 ? `${mib.toFixed(0)} MiB` : `${mib.toFixed(1)} MiB`;
}

export default function ClipArchitectureContrastiveBatchLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ContrastiveBatchModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No contrastive batch model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isContrastiveBatchModel(payload)) {
          throw new Error('The contrastive batch model is incomplete or has the wrong blockId.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the batch lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabState
        error={error}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  return <ContrastiveBatchLab data={data} />;
}

function ContrastiveBatchLab({ data }: { data: ContrastiveBatchModel }) {
  const initialScenario = data.scenarios.find(
    (scenario) => scenario.id === data.defaults.scenarioId,
  ) ?? data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [globalBatchSize, setGlobalBatchSize] = useState(data.defaults.globalBatchSize);
  const [logitScale, setLogitScale] = useState(data.defaults.logitScale);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const model = useMemo(() => {
    const logits = scenario.similarities.map((row) => (
      row.map((similarity) => similarity * logitScale)
    ));
    const imageDirection = directionalLoss(logits);
    const textDirection = directionalLoss(transpose(logits));
    const ambiguous = new Set(scenario.ambiguousCells);
    const rankingErrors = imageDirection.probabilities.filter((row, index) => (
      row.indexOf(Math.max(...row)) !== index
    )).length;
    const comparisons = globalBatchSize * globalBatchSize;
    const ambiguousNegatives = (
      globalBatchSize
      * (globalBatchSize - 1)
      * scenario.collisionRate
    );
    const symmetricLoss = (imageDirection.loss + textDirection.loss) / 2;

    let verdict = 'The illustrative batch has clean diagonal separation';
    let detail = scenario.observation;
    let tone: Tone = 'emerald';

    if (rankingErrors > 0) {
      verdict = `${rankingErrors} image row${rankingErrors === 1 ? '' : 's'} rank the wrong caption first`;
      tone = 'rose';
    } else if (ambiguous.size > 0 && logitScale >= 30) {
      verdict = 'The ranking is correct, but scale sharpens disputed labels';
      tone = 'rose';
    } else if (ambiguous.size > 0) {
      verdict = 'The diagonal wins while valid alternatives are penalized';
      tone = 'amber';
    } else if (logitScale < 5) {
      verdict = 'The geometry is correct, but the softmax remains flat';
      tone = 'blue';
    }

    return {
      ambiguous,
      ambiguousNegatives,
      comparisons,
      detail,
      imageProbabilities: imageDirection.probabilities,
      imageRecallAt1: imageDirection.recallAt1,
      logits,
      matrixBytes: comparisons * 2,
      negativesPerAnchor: globalBatchSize - 1,
      symmetricLoss,
      temperature: 1 / logitScale,
      textRecallAt1: textDirection.recallAt1,
      tone,
      verdict,
    };
  }, [globalBatchSize, logitScale, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setGlobalBatchSize(data.defaults.globalBatchSize);
    setLogitScale(data.defaults.logitScale);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Contrastive objective lab"
          title={data.title}
          description={data.description}
          icon={Grid3X3}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Pair quality
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'clean-pairs' ? CheckCircle2 : AlertTriangle}
                      accent={item.id === 'clean-pairs' ? 'emerald' : item.id === 'semantic-collision' ? 'amber' : 'rose'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Global batch pairs"
                value={globalBatchSize}
                output={globalBatchSize.toLocaleString()}
                {...data.bounds.globalBatchSize}
                lowLabel="fewer negatives"
                highLabel="more comparisons"
                accent="blue"
                onChange={setGlobalBatchSize}
              />

              <LabRange
                label="3. Logit scale"
                value={logitScale}
                output={`${logitScale.toFixed(0)}x`}
                {...data.bounds.logitScale}
                lowLabel="flatter softmax"
                highLabel="sharper softmax"
                accent="violet"
                onChange={setLogitScale}
              />
            </div>
          )}
        >
          <div className="min-h-[520px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Negatives per anchor"
                value={model.negativesPerAnchor.toLocaleString()}
                detail={`${compact.format(model.comparisons)} pairwise logits`}
                icon={Users}
                tone="blue"
              />
              <LabMetric
                label="Raw FP16 logits"
                value={formatMiB(model.matrixBytes)}
                detail="One score matrix only; training activations cost more"
                icon={Binary}
                tone="cyan"
              />
              <LabMetric
                label="Estimated collisions"
                value={compact.format(model.ambiguousNegatives)}
                detail="Illustrative ambiguous off-diagonals per global batch"
                icon={Network}
                tone={model.ambiguousNegatives >= 100 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Temperature"
                value={model.temperature.toFixed(3)}
                detail={`Symmetric loss ${model.symmetricLoss.toFixed(3)}`}
                icon={Thermometer}
                tone={model.symmetricLoss >= 1 ? 'rose' : model.symmetricLoss >= 0.5 ? 'amber' : 'emerald'}
              />
            </div>

            <section
              className={`mt-5 rounded-md border p-5 ${
                model.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                  : model.tone === 'rose'
                    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
                    : model.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50'
                      : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {model.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-70">Batch diagnosis</p>
                  <h4 className="mt-1 text-lg font-semibold">{model.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-85">{model.detail}</p>
                  <p className="mt-2 text-sm font-semibold leading-6">{scenario.recommendation}</p>
                </div>
              </div>
            </section>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Illustrative four-pair score matrix
                </p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                  Each row should rank its diagonal caption first
                </h4>
              </div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                I-to-T R@1 {(model.imageRecallAt1 * 100).toFixed(0)}% | T-to-I R@1 {(model.textRecallAt1 * 100).toFixed(0)}%
              </p>
            </div>

            <SimilarityMatrix
              scenario={scenario}
              probabilities={model.imageProbabilities}
              ambiguous={model.ambiguous}
            />
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function SimilarityMatrix({
  scenario,
  probabilities,
  ambiguous,
}: {
  scenario: BatchScenario;
  probabilities: number[][];
  ambiguous: Set<string>;
}) {
  return (
    <>
      <div className="mt-4 hidden overflow-hidden rounded-md border border-neutral-200 md:block dark:border-neutral-800">
        <div
          className="grid bg-neutral-100 text-xs font-semibold text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
          style={{ gridTemplateColumns: `minmax(110px, 1.25fr) repeat(${scenario.textLabels.length}, minmax(76px, 1fr))` }}
        >
          <div className="border-b border-r border-neutral-200 p-3 dark:border-neutral-800">
            Image \ text
          </div>
          {scenario.textLabels.map((label) => (
            <div key={label} className="border-b border-r border-neutral-200 p-3 last:border-r-0 dark:border-neutral-800">
              {label}
            </div>
          ))}
          {scenario.imageLabels.map((imageLabel, rowIndex) => (
            <div className="contents" key={imageLabel}>
              <div className="border-b border-r border-neutral-200 bg-neutral-50 p-3 text-sm font-semibold text-neutral-900 last:border-b-0 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-white">
                {imageLabel}
              </div>
              {scenario.textLabels.map((textLabel, columnIndex) => (
                <ScoreCell
                  key={`${imageLabel}:${textLabel}`}
                  probability={probabilities[rowIndex][columnIndex]}
                  positive={rowIndex === columnIndex}
                  ambiguous={ambiguous.has(`${rowIndex}:${columnIndex}`)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3 md:hidden">
        {scenario.imageLabels.map((imageLabel, rowIndex) => (
          <section
            key={imageLabel}
            className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">{imageLabel}</h5>
            <div className="mt-3 space-y-2">
              {scenario.textLabels.map((textLabel, columnIndex) => {
                const probability = probabilities[rowIndex][columnIndex];
                const positive = rowIndex === columnIndex;
                const isAmbiguous = ambiguous.has(`${rowIndex}:${columnIndex}`);
                return (
                  <div key={textLabel}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 font-medium text-neutral-700 dark:text-neutral-200">
                        {textLabel} {positive ? '(paired)' : isAmbiguous ? '(valid alternative)' : ''}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-neutral-900 dark:text-white">
                        {(probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full ${positive ? 'bg-emerald-500' : isAmbiguous ? 'bg-amber-500' : 'bg-neutral-400 dark:bg-neutral-600'}`}
                        style={{ width: `${Math.max(2, probability * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function ScoreCell({
  probability,
  positive,
  ambiguous,
}: {
  probability: number;
  positive: boolean;
  ambiguous: boolean;
}) {
  return (
    <div
      className={`flex min-h-16 items-center justify-center border-b border-r p-3 text-center last:border-r-0 dark:border-neutral-800 ${
        positive
          ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100'
          : ambiguous
            ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100'
            : 'bg-white text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
      }`}
    >
      <span>
        <span className="block text-sm font-semibold tabular-nums">
          {(probability * 100).toFixed(1)}%
        </span>
        <span className="mt-1 block text-[10px] font-semibold uppercase opacity-65">
          {positive ? 'paired' : ambiguous ? 'disputed' : 'negative'}
        </span>
      </span>
    </div>
  );
}

function LabState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="max-w-md text-center">
        {error
          ? <AlertTriangle aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
          : <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 text-violet-600 dark:text-violet-300" />}
        <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
          {error ? 'Contrastive batch lab unavailable' : 'Loading the batch model...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
