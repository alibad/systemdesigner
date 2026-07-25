'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  KeyRound,
  LoaderCircle,
  Network,
  RefreshCw,
  Route,
  ScanSearch,
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

type Defaults = {
  workloadId: string;
  modelId: string;
  anchorId: string;
  pathId: string;
  hops: number;
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  question: string;
  recommendedModelId: string;
  fitReason: string;
  edgeExample: string;
};

type GraphModel = {
  id: string;
  label: string;
  detail: string;
  queryLanguage: string;
  representation: string;
  exampleQuery: string;
};

type QueryAnchor = {
  id: string;
  label: string;
  detail: string;
  seedCount: number;
  indexBehavior: string;
};

type PathShape = {
  id: string;
  label: string;
  detail: string;
  branchingFactor: number;
  indexBehavior: string;
};

type QueryDecisionModel = {
  blockId: string;
  title: string;
  description: string;
  defaults: Defaults;
  hopRange: {
    min: number;
    max: number;
  };
  workloads: Workload[];
  models: GraphModel[];
  anchors: QueryAnchor[];
  paths: PathShape[];
};

type QueryRisk = 'bounded' | 'review' | 'unbounded';

const BLOCK_ID = 'technology/neptune-performance';
const DEFAULT_DATA_FILE =
  '/api/content/technology/neptune/data/graph-query-decision-model.json';

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isQueryDecisionModel(value: unknown): value is QueryDecisionModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<QueryDecisionModel>;

  if (
    !isString(candidate.blockId)
    || !isString(candidate.title)
    || !isString(candidate.description)
    || !candidate.defaults
    || !isString(candidate.defaults.workloadId)
    || !isString(candidate.defaults.modelId)
    || !isString(candidate.defaults.anchorId)
    || !isString(candidate.defaults.pathId)
    || !isFiniteNumber(candidate.defaults.hops)
    || !candidate.hopRange
    || !isFiniteNumber(candidate.hopRange.min)
    || !isFiniteNumber(candidate.hopRange.max)
    || !Array.isArray(candidate.workloads)
    || candidate.workloads.length < 3
    || !Array.isArray(candidate.models)
    || candidate.models.length !== 2
    || !Array.isArray(candidate.anchors)
    || candidate.anchors.length < 3
    || !Array.isArray(candidate.paths)
    || candidate.paths.length < 3
  ) {
    return false;
  }

  const workloadsValid = candidate.workloads.every((workload) =>
    isString(workload?.id)
    && isString(workload.label)
    && isString(workload.detail)
    && isString(workload.question)
    && isString(workload.recommendedModelId)
    && isString(workload.fitReason)
    && isString(workload.edgeExample));
  const modelsValid = candidate.models.every((model) =>
    isString(model?.id)
    && isString(model.label)
    && isString(model.detail)
    && isString(model.queryLanguage)
    && isString(model.representation)
    && isString(model.exampleQuery));
  const anchorsValid = candidate.anchors.every((anchor) =>
    isString(anchor?.id)
    && isString(anchor.label)
    && isString(anchor.detail)
    && isFiniteNumber(anchor.seedCount)
    && anchor.seedCount > 0
    && isString(anchor.indexBehavior));
  const pathsValid = candidate.paths.every((path) =>
    isString(path?.id)
    && isString(path.label)
    && isString(path.detail)
    && isFiniteNumber(path.branchingFactor)
    && path.branchingFactor > 0
    && isString(path.indexBehavior));

  const workloadIds = new Set(candidate.workloads.map((item) => item.id));
  const modelIds = new Set(candidate.models.map((item) => item.id));
  const anchorIds = new Set(candidate.anchors.map((item) => item.id));
  const pathIds = new Set(candidate.paths.map((item) => item.id));

  return workloadsValid
    && modelsValid
    && anchorsValid
    && pathsValid
    && workloadIds.has(candidate.defaults.workloadId)
    && modelIds.has(candidate.defaults.modelId)
    && anchorIds.has(candidate.defaults.anchorId)
    && pathIds.has(candidate.defaults.pathId)
    && candidate.workloads.every((item) => modelIds.has(item.recommendedModelId))
    && candidate.defaults.hops >= candidate.hopRange.min
    && candidate.defaults.hops <= candidate.hopRange.max;
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

function queryRisk(
  anchor: QueryAnchor,
  path: PathShape,
  candidatePaths: number,
  hops: number,
): QueryRisk {
  if (anchor.id === 'broad-label' || candidatePaths >= 1_000_000) {
    return 'unbounded';
  }
  if (path.id === 'any-inbound' || candidatePaths >= 10_000 || hops >= 4) {
    return 'review';
  }
  return 'bounded';
}

function riskCopy(risk: QueryRisk) {
  if (risk === 'unbounded') {
    return {
      label: 'Reframe before production',
      detail: 'The starting set or repeated fan-out is too broad for a reliable request boundary.',
      tone: 'rose' as const,
    };
  }
  if (risk === 'review') {
    return {
      label: 'Explain and profile',
      detail: 'The path can be valid, but its reverse lookup, hop count, or fan-out needs measured plan evidence.',
      tone: 'amber' as const,
    };
  }
  return {
    label: 'Bounded teaching shape',
    detail: 'The query begins selectively and follows a named relationship for a short distance.',
    tone: 'emerald' as const,
  };
}

function propertyGraphPreview(pathId: string, edgeLabel: string, hops: number) {
  const relationship = pathId === 'any-inbound'
    ? `[*1..${hops}]`
    : `[:${edgeLabel}*1..${hops}]`;

  if (pathId === 'named-outbound') {
    return `MATCH (seed {id: $id})-${relationship}->(result)\nRETURN result LIMIT 50`;
  }

  return `MATCH (seed {id: $id})<-${relationship}-(result)\nRETURN result LIMIT 50`;
}

function rdfPreview(pathId: string, predicate: string, hops: number) {
  const lines: string[] = ['VALUES ?seed { <https://example.com/resource/id> }'];
  let current = '?seed';

  for (let index = 1; index <= hops; index += 1) {
    const next = index === hops ? '?result' : `?hop${index}`;
    if (pathId === 'named-outbound') {
      lines.push(`${current} <https://example.com/${predicate}> ${next} .`);
    } else if (pathId === 'named-inbound') {
      lines.push(`${next} <https://example.com/${predicate}> ${current} .`);
    } else {
      lines.push(`${next} ?predicate${index} ${current} .`);
    }
    current = next;
  }

  lines.push('LIMIT 50');
  return lines.join('\n');
}

export default function NeptuneQueryDecisionLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<QueryDecisionModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isQueryDecisionModel(payload) || payload.blockId !== BLOCK_ID) {
          throw new Error('The graph-query decision model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the graph-query decision model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Graph query workbench"
          title="Turn a graph question into a bounded query"
          description="Loading model, anchor, traversal, and index decisions."
          icon={GitBranch}
          accent="cyan"
        />
        <LoadState
          error={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      </LearningLab>
    );
  }

  return <QueryWorkbench model={model} />;
}

function QueryWorkbench({ model }: { model: QueryDecisionModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [graphModelId, setGraphModelId] = useState(model.defaults.modelId);
  const [anchorId, setAnchorId] = useState(model.defaults.anchorId);
  const [pathId, setPathId] = useState(model.defaults.pathId);
  const [hops, setHops] = useState(model.defaults.hops);

  const workload = findById(model.workloads, workloadId);
  const graphModel = findById(model.models, graphModelId);
  const anchor = findById(model.anchors, anchorId);
  const path = findById(model.paths, pathId);

  const candidatePaths = useMemo(
    () => anchor.seedCount * path.branchingFactor ** hops,
    [anchor.seedCount, hops, path.branchingFactor],
  );
  const risk = queryRisk(anchor, path, candidatePaths, hops);
  const riskResult = riskCopy(risk);
  const modelMatches = graphModel.id === workload.recommendedModelId;
  const queryPreview = graphModel.id === 'property-graph'
    ? propertyGraphPreview(path.id, workload.edgeExample, hops)
    : rdfPreview(path.id, workload.edgeExample, hops);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setGraphModelId(model.defaults.modelId);
    setAnchorId(model.defaults.anchorId);
    setPathId(model.defaults.pathId);
    setHops(model.defaults.hops);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Graph query workbench"
          title={model.title}
          description={model.description}
          icon={GitBranch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <SelectControl
                label="Business question"
                value={workload.id}
                options={model.workloads}
                onChange={setWorkloadId}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Graph model
                </legend>
                <div className="mt-3 grid gap-2">
                  {model.models.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === graphModel.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'rdf' ? Braces : Network}
                      accent={item.id === 'rdf' ? 'violet' : 'cyan'}
                      onClick={() => setGraphModelId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <SelectControl
                label="Starting anchor"
                value={anchor.id}
                options={model.anchors}
                onChange={setAnchorId}
              />
              <SelectControl
                label="Traversal shape"
                value={path.id}
                options={model.paths}
                onChange={setPathId}
              />
              <LabRange
                label="Maximum traversal depth"
                value={hops}
                output={`${hops} ${hops === 1 ? 'hop' : 'hops'}`}
                min={model.hopRange.min}
                max={model.hopRange.max}
                lowLabel="Local relationship"
                highLabel="Wider fan-out"
                accent="cyan"
                onChange={setHops}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <section className={`rounded-md border p-5 ${
              modelMatches
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                {modelMatches ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {modelMatches ? 'Model matches the question' : 'Model mismatch to justify'}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {workload.question}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {modelMatches
                      ? workload.fitReason
                      : `${findById(model.models, workload.recommendedModelId).label} is the clearer default here. ${workload.fitReason}`}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <LabMetric
                label="Query language"
                value={graphModel.queryLanguage}
                detail={graphModel.representation}
                icon={BookOpenCheck}
                tone={graphModel.id === 'rdf' ? 'violet' : 'cyan'}
              />
              <LabMetric
                label="Illustrative seeds"
                value={integerFormatter.format(anchor.seedCount)}
                detail="Modeled starting entities before the first hop"
                icon={KeyRound}
                tone={anchor.id === 'broad-label' ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Candidate paths"
                value={integerFormatter.format(candidatePaths)}
                detail={`${anchor.seedCount} seeds × ${path.branchingFactor}^${hops}; explanatory, not a latency forecast`}
                icon={Route}
                tone={riskResult.tone}
              />
              <LabMetric
                label="Plan posture"
                value={riskResult.label}
                detail={riskResult.detail}
                icon={risk === 'bounded' ? CheckCircle2 : TriangleAlert}
                tone={riskResult.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <ScanSearch aria-hidden="true" className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
                <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                  See where fan-out enters the request
                </h4>
              </div>
              <div className="mt-5 grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                <FlowStage
                  eyebrow="1 · Seed"
                  value={integerFormatter.format(anchor.seedCount)}
                  detail={anchor.label}
                  tone="blue"
                />
                <FlowArrow />
                <FlowStage
                  eyebrow={`2 · Repeat ${hops}×`}
                  value={`${path.branchingFactor} branches`}
                  detail={path.label}
                  tone="violet"
                />
                <FlowArrow />
                <FlowStage
                  eyebrow="3 · Inspect"
                  value={integerFormatter.format(candidatePaths)}
                  detail="Illustrative candidate paths before filters and deduplication"
                  tone={risk === 'bounded' ? 'green' : risk === 'review' ? 'amber' : 'rose'}
                />
              </div>
            </section>

            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <section className="min-w-0 rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Database aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                    Index access to verify
                  </h4>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {anchor.indexBehavior}
                </p>
                <p className="mt-3 border-l-2 border-violet-400 pl-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {path.indexBehavior}
                </p>
              </section>

              <section className="min-w-0 overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
                <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3 text-xs font-semibold uppercase text-neutral-400">
                  <Braces aria-hidden="true" className="h-4 w-4" />
                  Shape preview · {graphModel.queryLanguage}
                </div>
                <pre className="overflow-x-auto p-4 text-xs leading-6 text-cyan-100">
                  <code>{queryPreview}</code>
                </pre>
              </section>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Candidate-path counts are a deliberately simple fan-out model. Neptune
              latency depends on the actual graph, bound values, statistics, engine
              plan, instance pressure, result size, and cache state. Use explain,
              profile, slow-query logs, and production-like data to make the real
              decision.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function SelectControl<T extends { id: string; label: string; detail: string }>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: T[];
  onChange: (value: string) => void;
}) {
  const selected = findById(options, value);

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <select
        value={selected.id}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {selected.detail}
      </span>
    </label>
  );
}

function FlowStage({
  eyebrow,
  value,
  detail,
  tone,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'green' | 'amber' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{eyebrow}</p>
      <p className="mt-2 break-words text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
      <ArrowDown className="h-5 w-5 sm:hidden" />
      <ArrowRight className="hidden h-5 w-5 sm:block" />
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
  return (
    <LearningLabBody>
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Query model unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-44 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading graph-query decisions…
        </div>
      )}
    </LearningLabBody>
  );
}
