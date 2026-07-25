'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Image, Layers3, MemoryStick, Timer, TriangleAlert, UsersRound } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TokenThroughputModel = {
  title: string;
  description: string;
  baseTilePixels: number;
  baseTokensPerTile: number;
  fixedMemoryGiB: number;
  memoryPerRequestGiB: number;
  memoryPerThousandTokensGiB: number;
  baseLatencyMs: number;
  visionLatencyPerTokenMs: number;
  languageLatencyPerTokenMs: number;
  safeUtilizationPercent: number;
  gpuMemoryGiB: number;
  textPromptTokens: number;
  generationReserveTokens: number;
  resolutionOptions: number[];
  mediaOptions: number[];
  contextOptions: number[];
  compressionOptions: number[];
  concurrencyOptions: number[];
};

const BLOCK_ID = 'genai/internvl3-architecture-token-throughput-lab';

export default function Internvl3ArchitectureTokenThroughputLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<TokenThroughputModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No token-throughput model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<TokenThroughputModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the token-throughput model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;

  return <TokenThroughputLab data={data} />;
}

function TokenThroughputLab({ data }: { data: TokenThroughputModel }) {
  const [resolution, setResolution] = useState(data.resolutionOptions[1] ?? data.baseTilePixels);
  const [mediaCount, setMediaCount] = useState(data.mediaOptions[1] ?? 2);
  const [contextLength, setContextLength] = useState(data.contextOptions[1] ?? 8192);
  const [compression, setCompression] = useState(data.compressionOptions[1] ?? 2);
  const [concurrency, setConcurrency] = useState(data.concurrencyOptions[2] ?? 4);
  const [dynamicTiles, setDynamicTiles] = useState(true);
  const [tileCap, setTileCap] = useState(4);
  const [mediaKind, setMediaKind] = useState<'images' | 'frames'>('images');

  const model = useMemo(() => {
    const requestedTiles = Math.max(1, Math.ceil((resolution / data.baseTilePixels) ** 2));
    const tilesPerMedia = dynamicTiles ? Math.min(requestedTiles, tileCap) : 1;
    const visualTokens = Math.ceil(mediaCount * tilesPerMedia * data.baseTokensPerTile / compression);
    const availableVisualTokens = Math.max(0, contextLength - data.textPromptTokens - data.generationReserveTokens);
    const totalTokens = data.textPromptTokens + visualTokens + data.generationReserveTokens;
    const fitsContext = visualTokens <= availableVisualTokens;
    const latencyMs = data.baseLatencyMs
      + visualTokens * data.visionLatencyPerTokenMs
      + totalTokens * data.languageLatencyPerTokenMs;
    const memoryGiB = data.fixedMemoryGiB + concurrency * (data.memoryPerRequestGiB + totalTokens / 1000 * data.memoryPerThousandTokensGiB);
    const fitsMemory = memoryGiB <= data.gpuMemoryGiB;
    const capacityPerSecond = concurrency * 1000 / latencyMs * (data.safeUtilizationPercent / 100);
    const contextPercent = Math.min(100, totalTokens / contextLength * 100);
    const bottleneck = !fitsContext
      ? 'Context budget exceeded'
      : !fitsMemory
        ? 'Peak memory exceeds the modeled GPU'
        : visualTokens > availableVisualTokens * 0.7
          ? 'Visual tokens dominate the context'
          : concurrency >= 8
            ? 'Concurrent KV-cache pressure'
            : 'Balanced illustrative configuration';
    const consequence = !fitsContext
      ? 'This request needs an explicit policy: select fewer media items, lower resolution, increase compression, or use a larger context. Do not silently remove visual evidence.'
      : !fitsMemory
        ? 'The modeled peak memory is above one GPU. Reduce concurrency or request size, route to a larger worker, or batch only after measuring tail latency.'
        : compression >= 4 && requestedTiles > 1
          ? 'Compression creates headroom, but it can erase small text and region-level grounding. Validate dense documents and GUI targets before relying on this route.'
          : 'The request fits this illustrative budget. Confirm it with production traces, including peak memory and p95 latency for the real media mix.';

    return {
      availableVisualTokens,
      bottleneck,
      capacityPerSecond,
      consequence,
      contextPercent,
      fitsContext,
      fitsMemory,
      latencyMs,
      memoryGiB,
      requestedTiles,
      tilesPerMedia,
      totalTokens,
      visualTokens,
    };
  }, [compression, concurrency, contextLength, data, dynamicTiles, mediaCount, resolution, tileCap]);

  const reset = () => {
    setResolution(data.resolutionOptions[1] ?? data.baseTilePixels);
    setMediaCount(data.mediaOptions[1] ?? 2);
    setContextLength(data.contextOptions[1] ?? 8192);
    setCompression(data.compressionOptions[1] ?? 2);
    setConcurrency(data.concurrencyOptions[2] ?? 4);
    setDynamicTiles(true);
    setTileCap(4);
    setMediaKind('images');
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Multimodal capacity lab"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Pack visual evidence</legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['images', 'frames'] as const).map((kind) => (
                    <LabChoice
                      key={kind}
                      selected={mediaKind === kind}
                      label={kind === 'images' ? 'Images' : 'Video frames'}
                      detail={kind === 'images' ? 'Independent visual inputs.' : 'Sampled evidence over time.'}
                      icon={Image}
                      accent="cyan"
                      onClick={() => setMediaKind(kind)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label={`${mediaKind === 'images' ? 'Images' : 'Frames'} per request`}
                value={mediaCount}
                output={String(mediaCount)}
                min={Math.min(...data.mediaOptions)}
                max={Math.max(...data.mediaOptions)}
                step={1}
                accent="blue"
                lowLabel="one input"
                highLabel="more evidence"
                onChange={setMediaCount}
              />
              <LabRange
                label="Target tile resolution"
                value={resolution}
                output={`${resolution} px`}
                min={Math.min(...data.resolutionOptions)}
                max={Math.max(...data.resolutionOptions)}
                step={data.baseTilePixels}
                accent="violet"
                lowLabel="coarse"
                highLabel="fine detail"
                onChange={setResolution}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose the tiling policy</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice
                    selected={dynamicTiles}
                    label="Dynamic tiles"
                    detail="Add tiles as input resolution rises, up to a cap."
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setDynamicTiles(true)}
                  />
                  <LabChoice
                    selected={!dynamicTiles}
                    label="Single resized view"
                    detail="Use one view; lower cost, less local detail."
                    icon={Image}
                    accent="violet"
                    onClick={() => setDynamicTiles(false)}
                  />
                </div>
              </fieldset>
              {dynamicTiles ? (
                <LabRange
                  label="Dynamic tile cap"
                  value={tileCap}
                  output={`${tileCap} tiles`}
                  min={1}
                  max={9}
                  step={1}
                  accent="violet"
                  lowLabel="strict cap"
                  highLabel="detail first"
                  onChange={setTileCap}
                />
              ) : null}
              <LabRange
                label="Visual token compression"
                value={compression}
                output={`${compression}:1`}
                min={Math.min(...data.compressionOptions)}
                max={Math.max(...data.compressionOptions)}
                step={1}
                accent="amber"
                lowLabel="preserve tokens"
                highLabel="compress hard"
                onChange={setCompression}
              />
              <LabRange
                label="Context length"
                value={contextLength}
                output={contextLength.toLocaleString()}
                min={Math.min(...data.contextOptions)}
                max={Math.max(...data.contextOptions)}
                step={4096}
                accent="emerald"
                lowLabel="short window"
                highLabel="long window"
                onChange={setContextLength}
              />
              <LabRange
                label="Concurrent requests"
                value={concurrency}
                output={String(concurrency)}
                min={Math.min(...data.concurrencyOptions)}
                max={Math.max(...data.concurrencyOptions)}
                step={1}
                accent="rose"
                lowLabel="one active request"
                highLabel="higher pressure"
                onChange={setConcurrency}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Visual tokens" value={model.visualTokens.toLocaleString()} detail={`${mediaCount} ${mediaKind}, ${model.tilesPerMedia} tiles each, ${compression}:1 compression.`} icon={Layers3} tone="cyan" />
              <LabMetric label="Estimated latency" value={`${Math.round(model.latencyMs)} ms`} detail="Illustrative encode plus decode estimate." icon={Timer} tone="violet" />
              <LabMetric label="Modeled peak memory" value={`${model.memoryGiB.toFixed(1)} GiB`} detail={`${concurrency} concurrent requests on an ${data.gpuMemoryGiB} GiB worker.`} icon={MemoryStick} tone={model.fitsMemory ? 'emerald' : 'rose'} />
              <LabMetric label="Safe capacity" value={`${model.capacityPerSecond.toFixed(1)} req/s`} detail={`${data.safeUtilizationPercent}% modeled utilization, not a benchmark.`} icon={UsersRound} tone="amber" />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Context allocation</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{model.totalTokens.toLocaleString()} of {contextLength.toLocaleString()} tokens modeled</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">{model.contextPercent.toFixed(0)}% occupied</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" aria-label={`${model.contextPercent.toFixed(0)} percent of context occupied`}>
                <div className={`h-full rounded-full ${model.fitsContext ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-rose-500 dark:bg-rose-400'}`} style={{ width: `${model.contextPercent}%` }} />
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                Text prompt: {data.textPromptTokens.toLocaleString()} tokens. Visual budget remaining after prompt and answer reserve: {model.availableVisualTokens.toLocaleString()} tokens. Requested tiles: {model.requestedTiles}; applied tiles per {mediaKind === 'images' ? 'image' : 'frame'}: {model.tilesPerMedia}.
              </p>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${model.fitsContext && model.fitsMemory ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <div className="flex items-start gap-3">
                {model.fitsContext && model.fitsMemory ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
                  <h4 className="mt-1 text-base font-semibold">{model.bottleneck}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-90">{model.consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[560px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading visual token and throughput lab" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">Visual token and throughput lab unavailable</p><p className="mt-2 opacity-80">{detail}</p></div>;
}
