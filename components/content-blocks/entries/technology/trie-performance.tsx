'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  GitBranch,
  Languages,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Network,
  Route,
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
type UpdateProfile = 'static' | 'mixed' | 'write-heavy';
type Workload = {
  id: string;
  label: string;
  detail: string;
  words: number;
  averageLength: number;
  uniqueNodeRatio: number;
  averageBranching: number;
  alphabetSize: number;
  updateProfile: UpdateProfile;
};
type Representation = {
  id: string;
  label: string;
  detail: string;
  lookupLabel: string;
  baseNodeBytes: number;
  bytesPerChild: number;
  compressionRatio: number;
  depthRatio: number;
};
type RepresentationData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    representationId: string;
    scalePercent: number;
  };
  bounds: { scalePercent: Bound };
  workloads: Workload[];
  representations: Representation[];
};

const BLOCK_ID = 'technology/trie-performance';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isRepresentationData(value: unknown): value is RepresentationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RepresentationData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.representationId
      && typeof candidate.defaults.scalePercent === 'number'
      && isBound(candidate.bounds?.scalePercent)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 3
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.words === 'number'
        && typeof item.averageLength === 'number'
        && typeof item.uniqueNodeRatio === 'number'
        && typeof item.averageBranching === 'number'
        && typeof item.alphabetSize === 'number'
        && ['static', 'mixed', 'write-heavy'].includes(item.updateProfile)
      ))
      && Array.isArray(candidate.representations)
      && candidate.representations.length >= 3
      && candidate.representations.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.lookupLabel === 'string'
        && typeof item.baseNodeBytes === 'number'
        && typeof item.bytesPerChild === 'number'
        && typeof item.compressionRatio === 'number'
        && typeof item.depthRatio === 'number'
      )),
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatMiB(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

export default function TriePerformanceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RepresentationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No Trie representation model was supplied.');
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
        if (!isRepresentationData(payload)) throw new Error('The representation model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the representation lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />;
  }

  return <RepresentationWorkbench data={data} />;
}

function RepresentationWorkbench({ data }: { data: RepresentationData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [representationId, setRepresentationId] = useState(data.defaults.representationId);
  const [scalePercent, setScalePercent] = useState(data.defaults.scalePercent);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const estimates = useMemo(() => {
    const words = workload.words * scalePercent / 100;
    const uncompressedNodes = 1 + words * workload.averageLength * workload.uniqueNodeRatio;

    return data.representations.map((representation) => {
      const nodes = uncompressedNodes * representation.compressionRatio;
      const allocatedChildren = representation.id === 'fixed-array'
        ? nodes * workload.alphabetSize
        : nodes * workload.averageBranching;
      const segmentBytes = representation.id === 'compressed-radix'
        ? words * workload.averageLength * 0.35
        : 0;
      const bytes = nodes * representation.baseNodeBytes
        + allocatedChildren * representation.bytesPerChild
        + segmentBytes;

      return {
        ...representation,
        bytes,
        bytesPerKey: bytes / words,
        depth: workload.averageLength * representation.depthRatio,
        nodes,
      };
    });
  }, [data.representations, scalePercent, workload]);

  const selected = estimates.find((item) => item.id === representationId) ?? estimates[0];
  const smallestBytes = Math.min(...estimates.map((item) => item.bytes));
  const largestBytes = Math.max(...estimates.map((item) => item.bytes));
  const occupancy = Math.min(100, workload.averageBranching / workload.alphabetSize * 100);
  const words = workload.words * scalePercent / 100;

  const verdict = useMemo(() => {
    if (selected.id === 'fixed-array' && occupancy < 25) {
      return {
        title: 'Direct lookup is paying for mostly empty slots',
        detail: `Only about ${occupancy.toFixed(1)}% of child slots are occupied at an average node. A sparse representation preserves memory for useful edges.`,
        tone: 'rose' as const,
      };
    }
    if (selected.id === 'compressed-radix' && workload.updateProfile === 'write-heavy') {
      return {
        title: 'Compression saves nodes but raises update work',
        detail: 'Frequent inserts can split stored segments and rewrite structure. Measure mutation cost before accepting the smaller read shape.',
        tone: 'amber' as const,
      };
    }
    if (selected.id === 'compressed-radix' && workload.updateProfile === 'static') {
      return {
        title: 'Path compression fits this static sparse workload',
        detail: 'Long single-child paths collapse into fewer nodes, reducing depth and pointer chasing without sustained split pressure.',
        tone: 'emerald' as const,
      };
    }
    if (selected.bytes <= smallestBytes * 1.12) {
      return {
        title: 'This layout stays near the smallest memory envelope',
        detail: `${selected.lookupLabel}. Confirm the model with allocator-aware heap profiles and representative keys.`,
        tone: 'emerald' as const,
      };
    }
    return {
      title: 'The lookup contract may justify the extra memory',
      detail: `${selected.lookupLabel}, but this model uses ${(selected.bytes / smallestBytes).toFixed(1)}x the memory of the smallest option. Make that trade-off explicit.`,
      tone: 'amber' as const,
    };
  }, [occupancy, selected, smallestBytes, workload.updateProfile]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setRepresentationId(data.defaults.representationId);
    setScalePercent(data.defaults.scalePercent);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Representation sizing lab"
          title={data.title}
          description={data.description}
          icon={MemoryStick}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Key workload
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.alphabetSize > 100 ? Languages : item.alphabetSize === 2 ? Binary : Database}
                      accent={item.id === 'routing-table' ? 'cyan' : 'violet'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Dictionary scale"
                value={scalePercent}
                output={`${scalePercent}% (${compactNumber(words)} keys)`}
                {...data.bounds.scalePercent}
                lowLabel="Pilot"
                highLabel="Growth case"
                accent="violet"
                onChange={setScalePercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Child representation
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.representations.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === selected.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'compressed-radix' ? Route : item.id === 'fixed-array' ? Boxes : GitBranch}
                    accent={item.id === 'compressed-radix' ? 'cyan' : 'violet'}
                    onClick={() => setRepresentationId(item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Estimated memory"
                value={`${formatMiB(selected.bytes / 1024 ** 2)} MiB`}
                detail={`${selected.bytesPerKey.toFixed(0)} bytes per key in this model`}
                icon={MemoryStick}
                tone={selected.bytes <= smallestBytes * 1.12 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Allocated nodes"
                value={compactNumber(selected.nodes)}
                detail={`${compactNumber(words)} normalized keys`}
                icon={Network}
                tone="blue"
              />
              <LabMetric
                label="Expected depth"
                value={`${selected.depth.toFixed(1)} steps`}
                detail={`Average key length is ${workload.averageLength}`}
                icon={Layers3}
                tone={selected.depth < workload.averageLength ? 'cyan' : 'neutral'}
              />
              <LabMetric
                label="Branch occupancy"
                value={`${occupancy.toFixed(1)}%`}
                detail={`${workload.averageBranching} children across ${workload.alphabetSize} possible units`}
                icon={Gauge}
                tone={occupancy < 10 ? 'rose' : occupancy < 35 ? 'amber' : 'emerald'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <MemoryStick aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Memory comparison</h4>
              </div>
              <div className="mt-4 space-y-3">
                {estimates.map((item) => {
                  const width = Math.max(6, item.bytes / largestBytes * 100);
                  return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className={`font-semibold ${item.id === selected.id ? 'text-violet-700 dark:text-violet-300' : 'text-neutral-600 dark:text-neutral-300'}`}>
                          {item.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-300">
                          {formatMiB(item.bytes / 1024 ** 2)} MiB
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={item.id === selected.id ? 'h-full rounded-full bg-violet-500' : 'h-full rounded-full bg-neutral-400 dark:bg-neutral-600'}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-md border p-5 ${verdict.tone === 'rose'
              ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              : verdict.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {verdict.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${verdict.tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`} />}
                <div>
                  <h4 className="text-base font-semibold text-neutral-950 dark:text-white">{verdict.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{verdict.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Representation sizing lab"
          title="Loading the Trie representation model"
          description="The lab validates its workload and memory assumptions before rendering controls."
          icon={LoaderCircle}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            {error ? <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-300" /> : <LoaderCircle aria-hidden="true" className="h-7 w-7 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300" />}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading representation data...'}</p>
            {error ? (
              <button type="button" onClick={onRetry} className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900">
                Retry
              </button>
            ) : null}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
