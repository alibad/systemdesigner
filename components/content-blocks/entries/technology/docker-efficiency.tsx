'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Boxes,
  CheckCircle2,
  Clock3,
  FileCode2,
  Layers3,
  LoaderCircle,
  PackageCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Change = {
  id: string;
  label: string;
  detail: string;
};

type Layer = {
  id: string;
  label: string;
  detail: string;
  durationSeconds: number;
  destination: 'build-only' | 'final-image';
};

type Design = {
  id: string;
  label: string;
  detail: string;
  finalImageMb: number;
  finalContents: string[];
  buildOnlyContents: string[];
  recommendation: string;
  layers: Layer[];
  invalidations: Record<string, string[]>;
};

type BuildModel = {
  title: string;
  description: string;
  defaultDesignId: string;
  defaultChangeId: string;
  changes: Change[];
  designs: Design[];
};

const BLOCK_ID = 'technology/docker-efficiency';
const DEFAULT_DATA_FILE = '/api/content/technology/docker/data/image-build-model.json';

function validBuildModel(value: unknown): value is BuildModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BuildModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultDesignId
      && candidate.defaultChangeId
      && Array.isArray(candidate.changes)
      && candidate.changes.length >= 2
      && Array.isArray(candidate.designs)
      && candidate.designs.length >= 2
      && candidate.designs.every((design) => (
        design.id
          && Array.isArray(design.layers)
          && design.layers.length > 0
          && design.layers.every((layer) => (
            layer.id
              && Number.isFinite(layer.durationSeconds)
              && (layer.destination === 'build-only' || layer.destination === 'final-image')
          ))
          && design.invalidations
      )),
  );
}

function formatSeconds(value: number) {
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export default function DockerEfficiency({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BuildModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [designId, setDesignId] = useState('');
  const [changeId, setChangeId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validBuildModel(payload)) throw new Error('The Docker build model is incomplete.');
        setData(payload);
        setDesignId(payload.defaultDesignId);
        setChangeId(payload.defaultChangeId);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the build model.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const design = data.designs.find((item) => item.id === designId) ?? data.designs[0];
    const change = data.changes.find((item) => item.id === changeId) ?? data.changes[0];
    const invalidatedIds = new Set(design.invalidations[change.id] ?? []);
    const coldBuildSeconds = design.layers.reduce((sum, layer) => sum + layer.durationSeconds, 0);
    const rebuildSeconds = design.layers.reduce(
      (sum, layer) => sum + (invalidatedIds.has(layer.id) ? layer.durationSeconds : 0),
      0,
    );
    const reusedLayers = design.layers.filter((layer) => !invalidatedIds.has(layer.id)).length;
    const reusePct = coldBuildSeconds === 0
      ? 100
      : Math.round(((coldBuildSeconds - rebuildSeconds) / coldBuildSeconds) * 100);

    return {
      design,
      change,
      invalidatedIds,
      coldBuildSeconds,
      rebuildSeconds,
      reusedLayers,
      reusePct,
    };
  }, [changeId, data, designId]);

  function reset() {
    if (!data) return;
    setDesignId(data.defaultDesignId);
    setChangeId(data.defaultChangeId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Image build lab"
          title={data?.title ?? 'Trace cache invalidation through an image build'}
          description={data?.description ?? 'Loading an illustrative Docker build model.'}
          icon={Layers3}
          accent="blue"
          onReset={data ? reset : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Dockerfile design
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.designs.map((design) => (
                      <LabChoice
                        key={design.id}
                        selected={design.id === result.design.id}
                        label={design.label}
                        detail={design.detail}
                        icon={design.id === 'multi-stage' ? Boxes : Box}
                        accent={design.id === 'multi-stage' ? 'emerald' : 'amber'}
                        onClick={() => setDesignId(design.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Change to rebuild
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.changes.map((change) => (
                      <LabChoice
                        key={change.id}
                        selected={change.id === result.change.id}
                        label={change.label}
                        detail={change.detail}
                        icon={FileCode2}
                        accent="blue"
                        onClick={() => setChangeId(change.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Warm rebuild"
                  value={formatSeconds(result.rebuildSeconds)}
                  detail={`${formatSeconds(result.coldBuildSeconds)} in the illustrative cold build`}
                  icon={Clock3}
                  tone={result.reusePct >= 60 ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Cached work"
                  value={`${result.reusePct}%`}
                  detail={`${result.reusedLayers} of ${result.design.layers.length} modeled steps reused`}
                  icon={PackageCheck}
                  tone={result.reusePct >= 60 ? 'cyan' : 'rose'}
                />
                <LabMetric
                  label="Final image"
                  value={`${result.design.finalImageMb} MB`}
                  detail="Illustrative compressed application image, not a universal benchmark"
                  icon={Box}
                  tone={result.design.id === 'multi-stage' ? 'violet' : 'amber'}
                />
                <LabMetric
                  label="Invalidated steps"
                  value={`${result.invalidatedIds.size}`}
                  detail="The changed step and every dependent step must run again"
                  icon={Layers3}
                  tone={result.invalidatedIds.size <= 3 ? 'blue' : 'rose'}
                />
              </div>

              <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Build trace
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.change.label} through {result.design.label.toLowerCase()}
                  </h4>
                </header>
                <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {result.design.layers.map((layer, index) => {
                    const invalidated = result.invalidatedIds.has(layer.id);
                    return (
                      <li
                        key={layer.id}
                        className={`grid min-w-0 gap-3 px-4 py-3 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center ${
                          invalidated
                            ? 'bg-amber-50 dark:bg-amber-950/25'
                            : 'bg-white dark:bg-neutral-950'
                        }`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                            {layer.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                            {layer.detail}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:justify-end">
                          <span className={invalidated ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-300'}>
                            {invalidated ? `Rebuild ${formatSeconds(layer.durationSeconds)}` : 'Cache hit'}
                          </span>
                          <span className="rounded-full border border-neutral-300 px-2 py-1 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                            {layer.destination === 'final-image' ? 'Ships' : 'Build only'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <div className={`rounded-md border p-5 ${result.design.id === 'multi-stage' ? healthyClass : warningClass}`}>
                <div className="flex items-start gap-3">
                  {result.design.id === 'multi-stage' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase opacity-75">Build verdict</p>
                    <h4 className="mt-1 text-lg font-semibold">{result.design.recommendation}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">
                      The final image contains {result.design.finalContents.join(', ')}.
                      {' '}Build-only contents: {result.design.buildOnlyContents.join(', ')}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className={`min-h-48 rounded-md border p-5 ${error ? warningClass : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}>
        <div className="flex items-start gap-3">
          {error ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" />
          )}
          <div>
            <p className="font-semibold">{error ? 'Build model unavailable' : 'Loading build model'}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{error ?? 'Preparing the layer trace.'}</p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </LearningLabBody>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100';
