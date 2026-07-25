'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  Blocks,
  BrainCircuit,
  CircleAlert,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Network,
  Repeat2,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Pressure = 'low' | 'moderate' | 'high';

interface Phase {
  id: string;
  label: string;
  detail: string;
  scoreShape: string;
  cacheAction: string;
  dominantPressure: string;
  result: string;
}

interface AttentionVariant {
  id: string;
  label: string;
  shortLabel: string;
  kvHeads: number;
  detail: string;
  effect: string;
}

interface BlockStage {
  id: string;
  label: string;
  owner: string;
  prefillState: string;
  decodeState: string;
  prefillPressure: Pressure;
  decodePressure: Pressure;
}

interface BlockExecutionData {
  title: string;
  description: string;
  model: {
    label: string;
    layers: number;
    queryHeads: number;
    headDimension: number;
    bytesPerElement: number;
    exampleContextTokens: number;
  };
  defaults: {
    phaseId: string;
    attentionId: string;
  };
  phases: Phase[];
  attentionVariants: AttentionVariant[];
  stages: BlockStage[];
}

const BLOCK_ID = 'genai/production-transformer-architecture-block-execution-lab';
const GIB = 1024 ** 3;

const stageIcons: Record<string, LucideIcon> = {
  'input-norm': Activity,
  'qkv-projection': Network,
  'causal-attention': BrainCircuit,
  'attention-residual': Repeat2,
  'feed-forward': Cpu,
  'block-output': Blocks,
};

const pressureStyles: Record<Pressure, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  moderate: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  high: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBlockExecutionData(value: unknown): value is BlockExecutionData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BlockExecutionData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.model
      && isFiniteNumber(candidate.model.layers)
      && isFiniteNumber(candidate.model.queryHeads)
      && isFiniteNumber(candidate.model.headDimension)
      && isFiniteNumber(candidate.model.bytesPerElement)
      && isFiniteNumber(candidate.model.exampleContextTokens)
      && candidate.defaults?.phaseId
      && candidate.defaults.attentionId
      && Array.isArray(candidate.phases)
      && candidate.phases.length >= 2
      && candidate.phases.every((item) => item.id && item.label && item.scoreShape)
      && Array.isArray(candidate.attentionVariants)
      && candidate.attentionVariants.length >= 2
      && candidate.attentionVariants.every((item) => item.id && item.label && isFiniteNumber(item.kvHeads))
      && Array.isArray(candidate.stages)
      && candidate.stages.length >= 4
      && candidate.stages.every((item) => item.id && item.label && item.prefillState && item.decodeState),
  );
}

function formatBytes(bytes: number) {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes >= 10 * GIB ? 0 : 2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(0)} KiB`;
}

export default function ProductionTransformerArchitectureBlockExecutionLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<BlockExecutionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No block execution model was supplied.');
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
        if (!isBlockExecutionData(payload)) throw new Error('The block execution model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load block data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <BlockExecutionLab data={data} />;
}

function BlockExecutionLab({ data }: { data: BlockExecutionData }) {
  const [phaseId, setPhaseId] = useState(data.defaults.phaseId);
  const [attentionId, setAttentionId] = useState(data.defaults.attentionId);

  const phase = data.phases.find((item) => item.id === phaseId) ?? data.phases[0];
  const attention = data.attentionVariants.find((item) => item.id === attentionId)
    ?? data.attentionVariants[0];

  const result = useMemo(() => {
    const bytesPerToken = 2
      * data.model.layers
      * attention.kvHeads
      * data.model.headDimension
      * data.model.bytesPerElement;
    const contextBytes = bytesPerToken * data.model.exampleContextTokens;
    const sharingRatio = data.model.queryHeads / attention.kvHeads;

    return {
      bytesPerToken,
      contextBytes,
      sharingRatio,
      stages: data.stages.map((stage) => ({
        ...stage,
        state: phase.id === 'prefill' ? stage.prefillState : stage.decodeState,
        pressure: phase.id === 'prefill' ? stage.prefillPressure : stage.decodePressure,
      })),
    };
  }, [attention.kvHeads, data.model, data.stages, phase.id]);

  const reset = () => {
    setPhaseId(data.defaults.phaseId);
    setAttentionId(data.defaults.attentionId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Block execution lab"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the execution phase
                </legend>
                <div className="mt-3 space-y-2">
                  {data.phases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === phase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'prefill' ? Layers3 : Repeat2}
                      accent={item.id === 'prefill' ? 'blue' : 'violet'}
                      onClick={() => setPhaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the checkpoint attention shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.attentionVariants.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === attention.id}
                      label={`${item.shortLabel}: ${item.kvHeads} KV ${item.kvHeads === 1 ? 'head' : 'heads'}`}
                      detail={item.detail}
                      icon={item.id === 'mha' ? Network : item.id === 'gqa' ? Blocks : MemoryStick}
                      accent={item.id === 'mha' ? 'blue' : item.id === 'gqa' ? 'violet' : 'emerald'}
                      onClick={() => setAttentionId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Attention score shape"
              value={phase.scoreShape}
              detail={phase.id === 'prefill' ? 'Across prompt positions.' : 'One new query against retained positions.'}
              icon={Gauge}
              tone={phase.id === 'prefill' ? 'blue' : 'violet'}
            />
            <LabMetric
              label="KV per cached token"
              value={formatBytes(result.bytesPerToken)}
              detail={`Across ${data.model.layers} layers at ${data.model.bytesPerElement} bytes per element.`}
              icon={MemoryStick}
              tone="amber"
            />
            <LabMetric
              label={`${data.model.exampleContextTokens.toLocaleString()}-token KV`}
              value={formatBytes(result.contextBytes)}
              detail="One sequence before allocator and page overhead."
              icon={Layers3}
              tone="rose"
            />
            <LabMetric
              label="Query-to-KV sharing"
              value={`${result.sharingRatio}:1`}
              detail={`${data.model.queryHeads} query heads mapped to ${attention.kvHeads} KV heads.`}
              icon={Network}
              tone="emerald"
            />
          </div>

          <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/55">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                  Active execution trace
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {phase.label} with {attention.shortLabel}
                </h4>
              </div>
              <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
                {phase.cacheAction}
              </p>
            </div>

            <ol className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {result.stages.map((stage, index) => {
                const Icon = stageIcons[stage.id] ?? Cpu;
                return (
                  <li key={stage.id} className="relative min-w-0">
                    <div className={`h-full rounded-md border p-3 ${pressureStyles[stage.pressure]}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-xs font-bold tabular-nums text-neutral-900 shadow-sm dark:bg-neutral-950/70 dark:text-white">
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </div>
                      <h5 className="mt-3 text-sm font-semibold">{stage.label}</h5>
                      <p className="mt-1 text-[11px] font-semibold uppercase opacity-70">{stage.owner}</p>
                      <p className="mt-2 text-xs leading-5 opacity-85">{stage.state}</p>
                      <p className="mt-3 text-[11px] font-semibold uppercase">{stage.pressure} pressure</p>
                    </div>
                    {index < result.stages.length - 1 ? (
                      <ArrowDown aria-hidden="true" className="mx-auto my-1 h-4 w-4 text-neutral-400 md:hidden" />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100">
              <p className="text-xs font-semibold uppercase opacity-70">Visible consequence</p>
              <p className="mt-2 text-base font-semibold">{phase.dominantPressure}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{phase.result}</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Attention consequence</p>
              <p className="mt-2 text-sm leading-6">{attention.effect}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading the block execution model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Block execution data could not be loaded</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
