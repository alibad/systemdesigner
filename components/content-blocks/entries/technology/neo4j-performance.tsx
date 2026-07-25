'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Filter,
  Gauge,
  GitBranch,
  Search,
  Server,
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

type Bound = { min: number; max: number; step: number };

type Workload = {
  id: string;
  label: string;
  detail: string;
  startLabel: string;
  relationshipType: string;
  terminalLabel: string;
  defaultAverageDegree: number;
  defaultPassRatePercent: number;
  resultKeepPercent: number;
  warningVisits: number;
  criticalVisits: number;
  supernodeDegree: number;
  guidance: string;
};

type TraversalData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    anchorRows: number;
    maxHops: number;
  };
  bounds: {
    anchorRows: Bound;
    averageDegree: Bound;
    maxHops: Bound;
    passRatePercent: Bound;
  };
  workloads: Workload[];
};

const BLOCK_ID = 'technology/neo4j-performance';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isWorkload(value: unknown): value is Workload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Workload>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && candidate.startLabel
      && candidate.relationshipType
      && candidate.terminalLabel
      && candidate.guidance
      && [
        candidate.defaultAverageDegree,
        candidate.defaultPassRatePercent,
        candidate.resultKeepPercent,
        candidate.warningVisits,
        candidate.criticalVisits,
        candidate.supernodeDegree,
      ].every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
}

function isTraversalData(value: unknown): value is TraversalData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TraversalData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && typeof candidate.defaults.anchorRows === 'number'
      && typeof candidate.defaults.maxHops === 'number'
      && isBound(candidate.bounds?.anchorRows)
      && isBound(candidate.bounds?.averageDegree)
      && isBound(candidate.bounds?.maxHops)
      && isBound(candidate.bounds?.passRatePercent)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every(isWorkload),
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(Math.round(value));
}

export default function Neo4jPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<TraversalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No traversal model was supplied.');
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
        if (!isTraversalData(payload)) throw new Error('The traversal model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the traversal lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <TraversalWorkbench data={data} />;
}

function TraversalWorkbench({ data }: { data: TraversalData }) {
  const initialWorkload = data.workloads.find((item) => item.id === data.defaults.workloadId)
    ?? data.workloads[0];
  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [anchorRows, setAnchorRows] = useState(data.defaults.anchorRows);
  const [averageDegree, setAverageDegree] = useState(initialWorkload.defaultAverageDegree);
  const [maxHops, setMaxHops] = useState(data.defaults.maxHops);
  const [passRatePercent, setPassRatePercent] = useState(
    initialWorkload.defaultPassRatePercent,
  );

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const passRate = passRatePercent / 100;
    const effectiveBranching = averageDegree * passRate;
    let frontierPaths = anchorRows;
    let relationshipVisits = 0;

    for (let hop = 1; hop <= maxHops; hop += 1) {
      relationshipVisits += frontierPaths * averageDegree;
      frontierPaths *= effectiveBranching;
    }

    const returnedPaths = frontierPaths * workload.resultKeepPercent / 100;
    const expansionPerAnchor = relationshipVisits / Math.max(1, anchorRows);
    const pressurePercent = Math.min(
      100,
      Math.log10(Math.max(1, relationshipVisits))
        / Math.log10(Math.max(10, workload.criticalVisits))
        * 100,
    );

    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    let verdict = 'This traversal has a bounded planning envelope';
    let detail = 'The anchor is selective and the modeled expansion remains below the workload warning threshold.';

    if (relationshipVisits >= workload.criticalVisits || returnedPaths >= 100_000) {
      tone = 'rose';
      verdict = 'The pattern can expand into runaway work';
      detail = 'Reduce anchor rows or depth, narrow the relationship type, move predicates into the expansion, or redesign around an explicit intermediate node.';
    } else if (
      relationshipVisits >= workload.warningVisits
      || averageDegree >= workload.supernodeDegree
      || anchorRows > 20
    ) {
      tone = 'amber';
      verdict = 'The query needs plan evidence against skewed data';
      detail = 'The envelope may be acceptable, but broad anchors or high-degree nodes can dominate tail latency. Inspect actual rows and DB hits with representative parameters.';
    }

    return {
      detail,
      effectiveBranching,
      expansionPerAnchor,
      frontierPaths,
      pressurePercent,
      relationshipVisits,
      returnedPaths,
      tone,
      verdict,
    };
  }, [anchorRows, averageDegree, maxHops, passRatePercent, workload]);

  function selectWorkload(next: Workload) {
    setWorkloadId(next.id);
    setAverageDegree(next.defaultAverageDegree);
    setPassRatePercent(next.defaultPassRatePercent);
  }

  function reset() {
    setWorkloadId(initialWorkload.id);
    setAnchorRows(data.defaults.anchorRows);
    setAverageDegree(initialWorkload.defaultAverageDegree);
    setMaxHops(data.defaults.maxHops);
    setPassRatePercent(initialWorkload.defaultPassRatePercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Traversal budget lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Workload shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Workflow}
                      accent="violet"
                      onClick={() => selectWorkload(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Rows after anchor lookup"
                value={anchorRows}
                output={anchorRows.toLocaleString()}
                min={data.bounds.anchorRows.min}
                max={data.bounds.anchorRows.max}
                step={data.bounds.anchorRows.step}
                lowLabel="Unique seek"
                highLabel="Broad match"
                accent="blue"
                onChange={setAnchorRows}
              />
              <LabRange
                label="Typed degree per node"
                value={averageDegree}
                output={String(averageDegree)}
                min={data.bounds.averageDegree.min}
                max={data.bounds.averageDegree.max}
                step={data.bounds.averageDegree.step}
                lowLabel="Sparse"
                highLabel="Supernode pressure"
                accent="violet"
                onChange={setAverageDegree}
              />
              <LabRange
                label="Maximum traversal depth"
                value={maxHops}
                output={`${maxHops} ${maxHops === 1 ? 'hop' : 'hops'}`}
                min={data.bounds.maxHops.min}
                max={data.bounds.maxHops.max}
                step={data.bounds.maxHops.step}
                lowLabel="Local fact"
                highLabel="Wide frontier"
                accent="amber"
                onChange={setMaxHops}
              />
              <LabRange
                label="Relationships passing predicate"
                value={passRatePercent}
                output={`${passRatePercent}%`}
                min={data.bounds.passRatePercent.min}
                max={data.bounds.passRatePercent.max}
                step={data.bounds.passRatePercent.step}
                lowLabel="Strong pruning"
                highLabel="No pruning"
                accent="emerald"
                onChange={setPassRatePercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Anchor rows"
                value={formatCompact(anchorRows)}
                detail={`:${workload.startLabel} entry points`}
                icon={Search}
                tone={anchorRows <= 5 ? 'emerald' : anchorRows <= 20 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Effective branching"
                value={`${result.effectiveBranching.toFixed(1)}x`}
                detail={`${averageDegree} typed edges x ${passRatePercent}% pass`}
                icon={Filter}
                tone={result.effectiveBranching <= 5 ? 'emerald' : result.effectiveBranching <= 20 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Relationship visits"
                value={formatCompact(result.relationshipVisits)}
                detail={`${formatCompact(result.expansionPerAnchor)} per anchor`}
                icon={Activity}
                tone={result.tone}
              />
              <LabMetric
                label="Returned paths"
                value={formatCompact(result.returnedPaths)}
                detail={`${workload.resultKeepPercent}% survive terminal filters`}
                icon={Gauge}
                tone={result.returnedPaths < 1_000 ? 'emerald' : result.returnedPaths < 100_000 ? 'amber' : 'rose'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="grid gap-px bg-neutral-200 sm:grid-cols-4 dark:bg-neutral-800">
                <TraceStep label="Anchor" value={`:${workload.startLabel}`} detail={`${anchorRows.toLocaleString()} rows`} />
                <TraceStep label="Expand" value={`:${workload.relationshipType}`} detail={`${averageDegree} per frontier node`} />
                <TraceStep label="Bound" value={`1..${maxHops} hops`} detail={`${passRatePercent}% pass each hop`} />
                <TraceStep label="Return" value={`:${workload.terminalLabel}`} detail={`${formatCompact(result.frontierPaths)} final candidates`} />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-neutral-900 dark:text-white">Modeled expansion pressure</span>
                <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-300">
                  {formatCompact(result.relationshipVisits)} visits
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    result.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : result.tone === 'amber'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${result.pressurePercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                Sum each frontier multiplied by typed degree. The predicate reduces the next frontier, not the edges already inspected.
              </p>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.tone === 'emerald'
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : result.tone === 'amber'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert
                    aria-hidden="true"
                    className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}
                  />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.detail}</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100">{workload.guidance}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TraceStep({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 bg-white p-4 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold leading-5 text-neutral-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <Database aria-hidden="true" className="h-5 w-5 animate-pulse motion-reduce:animate-none" />
        Loading the traversal model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <Server aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Traversal lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
