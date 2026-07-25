'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  Database,
  GitBranch,
  Layers3,
  LoaderCircle,
  Network,
  Route,
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

type Bound = {
  min: number;
  max: number;
  step: number;
};

type Engine = {
  id: 'mapreduce' | 'tez';
  label: string;
  detail: string;
  boundaryUnit: string;
  planLabel: string;
  boundaryDetail: string;
};

type OperatorKind = 'source' | 'map' | 'shuffle' | 'sink';

type Operator = {
  id: string;
  label: string;
  alias: string;
  kind: OperatorKind;
  volumeFactor: number;
  additionalInputGiB: number;
  shuffle: boolean;
  schema: string;
  explanation: string;
};

type Pipeline = {
  id: string;
  label: string;
  detail: string;
  baseInputGiB: number;
  operators: Operator[];
};

type ExecutionPlanData = {
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    pipelineId: string;
    engineId: Engine['id'];
    scale: number;
  };
  scaleBounds: Bound;
  engines: Engine[];
  pipelines: Pipeline[];
};

const BLOCK_ID = 'technology/pig-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/pig/data/execution-plan-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOperator(value: unknown): value is Operator {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Operator>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.alias
      && ['source', 'map', 'shuffle', 'sink'].includes(candidate.kind ?? '')
      && isFiniteNumber(candidate.volumeFactor)
      && candidate.volumeFactor > 0
      && isFiniteNumber(candidate.additionalInputGiB)
      && typeof candidate.shuffle === 'boolean'
      && candidate.schema
      && candidate.explanation,
  );
}

function isExecutionPlanData(value: unknown): value is ExecutionPlanData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutionPlanData>;
  const bounds = candidate.scaleBounds;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.modelNote
      && candidate.defaults?.pipelineId
      && ['mapreduce', 'tez'].includes(candidate.defaults.engineId)
      && isFiniteNumber(candidate.defaults.scale)
      && bounds
      && isFiniteNumber(bounds.min)
      && isFiniteNumber(bounds.max)
      && isFiniteNumber(bounds.step)
      && bounds.min < bounds.max
      && bounds.step > 0
      && Array.isArray(candidate.engines)
      && candidate.engines.length === 2
      && candidate.engines.every((engine) => (
        ['mapreduce', 'tez'].includes(engine.id)
        && typeof engine.label === 'string'
        && typeof engine.detail === 'string'
        && typeof engine.boundaryUnit === 'string'
        && typeof engine.planLabel === 'string'
        && typeof engine.boundaryDetail === 'string'
      ))
      && Array.isArray(candidate.pipelines)
      && candidate.pipelines.length >= 3
      && candidate.pipelines.every((pipeline) => (
        typeof pipeline.id === 'string'
        && typeof pipeline.label === 'string'
        && typeof pipeline.detail === 'string'
        && isFiniteNumber(pipeline.baseInputGiB)
        && pipeline.baseInputGiB > 0
        && Array.isArray(pipeline.operators)
        && pipeline.operators.length >= 4
        && pipeline.operators.every(isOperator)
      )),
  );
}

function formatGiB(value: number) {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(value >= 10240 ? 0 : 1)} TiB`;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} GiB`;
}

export default function PigPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ExecutionPlanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isExecutionPlanData(payload)) {
          throw new Error('The Pig execution-plan model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the execution-plan model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LoadingState
          error={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : (
        <ExecutionPlanWorkbench data={data} />
      )}
    </div>
  );
}

function ExecutionPlanWorkbench({ data }: { data: ExecutionPlanData }) {
  const [pipelineId, setPipelineId] = useState(data.defaults.pipelineId);
  const [engineId, setEngineId] = useState<Engine['id']>(data.defaults.engineId);
  const [scale, setScale] = useState(data.defaults.scale);

  const pipeline = (
    data.pipelines.find((candidate) => candidate.id === pipelineId)
    ?? data.pipelines[0]
  );
  const engine = (
    data.engines.find((candidate) => candidate.id === engineId)
    ?? data.engines[0]
  );

  const model = useMemo(() => {
    let currentGiB = pipeline.baseInputGiB * scale;
    let shuffleGiB = 0;
    let shuffleCount = 0;

    const stages = pipeline.operators.map((operator, index) => {
      const inputGiB = currentGiB + operator.additionalInputGiB * scale;

      if (operator.shuffle) {
        shuffleCount += 1;
        shuffleGiB += inputGiB;
      }

      currentGiB = inputGiB * operator.volumeFactor;

      return {
        ...operator,
        index: index + 1,
        inputGiB,
        outputGiB: currentGiB,
      };
    });

    const physicalUnits = engine.id === 'mapreduce'
      ? Math.max(1, shuffleCount)
      : shuffleCount + 1;
    const physicalValue = engine.id === 'mapreduce'
      ? `${physicalUnits} ${physicalUnits === 1 ? 'job' : 'jobs'}`
      : `${physicalUnits} ${physicalUnits === 1 ? 'vertex' : 'vertices'}`;

    let verdict = 'The pipeline stays narrow and map-side';
    let detail = 'No selected operator requires all equal keys to change task ownership.';
    let tone: 'blue' | 'amber' | 'rose' = 'blue';

    if (shuffleCount === 1) {
      verdict = 'One key boundary dominates the physical plan';
      detail = 'Filtering and projection before the boundary directly reduce serialized shuffle bytes.';
      tone = 'amber';
    } else if (shuffleCount > 1) {
      verdict = 'Two key changes create separate pressure points';
      detail = 'The join and later group use different ownership keys, so the engine cannot treat them as one partitioning decision.';
      tone = 'rose';
    }

    return {
      detail,
      finalGiB: currentGiB,
      physicalUnits,
      physicalValue,
      shuffleCount,
      shuffleGiB,
      stages,
      tone,
      verdict,
    };
  }, [engine.id, pipeline, scale]);

  function reset() {
    setPipelineId(data.defaults.pipelineId);
    setEngineId(data.defaults.engineId);
    setScale(data.defaults.scale);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Logical to physical plan lab"
        title={data.title}
        description={data.description}
        icon={Workflow}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Logical dataflow
              </legend>
              <div className="mt-3 grid gap-2">
                {data.pipelines.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === pipeline.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={candidate.operators.some((operator) => operator.label === 'JOIN')
                      ? GitBranch
                      : Route}
                    accent={candidate.operators.filter((operator) => operator.shuffle).length > 1
                      ? 'rose'
                      : 'cyan'}
                    onClick={() => setPipelineId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Execution backend
              </legend>
              <div className="mt-3 grid gap-2">
                {data.engines.map((candidate) => (
                  <LabChoice
                    key={candidate.id}
                    selected={candidate.id === engine.id}
                    label={candidate.label}
                    detail={candidate.detail}
                    icon={candidate.id === 'tez' ? Network : Layers3}
                    accent={candidate.id === 'tez' ? 'violet' : 'blue'}
                    onClick={() => setEngineId(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Input scale"
              value={scale}
              output={`${scale}x`}
              {...data.scaleBounds}
              lowLabel="Base dataset"
              highLabel="Larger run"
              accent="amber"
              onChange={setScale}
            />
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className={`rounded-md border p-5 ${verdictClasses[model.tone]}`}>
            <div className="flex items-start gap-3">
              <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase opacity-75">
                  Compiled consequence
                </p>
                <h4 className="mt-1 text-xl font-semibold">{model.verdict}</h4>
                <p className="mt-2 text-sm leading-6 opacity-85">{model.detail}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Logical operators"
              value={`${pipeline.operators.length}`}
              detail="Aliases in the selected dataflow"
              icon={Workflow}
              tone="blue"
            />
            <LabMetric
              label="Shuffle boundaries"
              value={`${model.shuffleCount}`}
              detail="Key ownership changes in the model"
              icon={Network}
              tone={model.shuffleCount > 1 ? 'rose' : 'amber'}
            />
            <LabMetric
              label="Modeled shuffle"
              value={formatGiB(model.shuffleGiB)}
              detail="Serialized input reaching key boundaries"
              icon={Database}
              tone={model.shuffleGiB > 100 ? 'amber' : 'cyan'}
            />
            <LabMetric
              label={engine.planLabel}
              value={model.physicalValue}
              detail={engine.id === 'tez' ? 'inside one modeled DAG' : 'minimum teaching estimate'}
              icon={Layers3}
              tone="violet"
            />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Alias and volume trace
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {pipeline.label} on {engine.label}
                </p>
              </div>
              <p className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                Final modeled output: {formatGiB(model.finalGiB)}
              </p>
            </div>

            <ol className="mt-4 space-y-3">
              {model.stages.map((stage) => (
                <li
                  key={stage.id}
                  className={`relative border-l-4 bg-white p-4 dark:bg-neutral-950 ${stageClasses[stage.kind]}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {stage.index}
                        </span>
                        <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {stage.alias} = {stage.label}
                        </span>
                        {stage.shuffle ? (
                          <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                            shuffle
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        {stage.explanation}
                      </p>
                      <p className="mt-2 break-words font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        {stage.schema}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-xs font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {formatGiB(stage.inputGiB)} in
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatGiB(stage.outputGiB)} out
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="border-l-4 border-violet-500 bg-violet-50 p-4 text-violet-950 dark:bg-violet-950/30 dark:text-violet-50">
            <p className="text-sm font-semibold">{engine.boundaryDetail}</p>
            <p className="mt-2 text-xs leading-5 opacity-80">{data.modelNote}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadingState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Logical to physical plan lab"
        title="Compile a Pig Latin pipeline"
        description="Loading the execution-plan model."
        icon={Workflow}
        accent="violet"
      />
      <LearningLabBody>
        <div
          role={error ? 'alert' : 'status'}
          className="flex min-h-40 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <div>
            {error ? (
              <CircleAlert
                aria-hidden="true"
                className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400"
              />
            ) : (
              <LoaderCircle
                aria-hidden="true"
                className="mx-auto h-6 w-6 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-400"
              />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ?? 'Loading operator and engine data...'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

const verdictClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
};

const stageClasses: Record<OperatorKind, string> = {
  source: 'border-blue-500',
  map: 'border-cyan-500',
  shuffle: 'border-amber-500',
  sink: 'border-emerald-500',
};
