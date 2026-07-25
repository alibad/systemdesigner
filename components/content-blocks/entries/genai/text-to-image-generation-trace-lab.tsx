'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  CircleAlert,
  Cpu,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  Timer,
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

type Backbone = {
  id: string;
  label: string;
  detail: string;
  workUnit: string;
  passes: number;
  computePerPass: number;
  lesson: string;
};

type TracePhase = {
  id: string;
  label: string;
  start: number;
  end: number;
  operator: string;
  state: string;
  description: string;
};

type GenerationTraceData = {
  title: string;
  description: string;
  defaults: {
    backboneId: string;
    checkpoint: number;
  };
  backbones: Backbone[];
  phases: TracePhase[];
};

const BLOCK_ID = 'genai/text-to-image-generation-trace-lab';

function isGenerationTraceData(value: unknown): value is GenerationTraceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GenerationTraceData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.backbones)
      && candidate.backbones.length > 0
      && candidate.backbones.every((backbone) => (
        typeof backbone.id === 'string'
        && typeof backbone.passes === 'number'
        && typeof backbone.computePerPass === 'number'
      ))
      && Array.isArray(candidate.phases)
      && candidate.phases.length > 0
      && candidate.phases.every((phase) => (
        typeof phase.id === 'string'
        && typeof phase.start === 'number'
        && typeof phase.end === 'number'
      )),
  );
}

export default function TextToImageGenerationTraceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<GenerationTraceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No generation trace was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isGenerationTraceData(payload)) {
          throw new Error('Generation trace data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the generation trace.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? <LoadError detail={loadError} /> : data ? <GenerationTraceLab data={data} /> : <LoadState />}
    </div>
  );
}

function GenerationTraceLab({ data }: { data: GenerationTraceData }) {
  const initialBackbone = data.backbones.find((item) => item.id === data.defaults.backboneId)
    ?? data.backbones[0];
  const [backboneId, setBackboneId] = useState(initialBackbone.id);
  const [checkpoint, setCheckpoint] = useState(data.defaults.checkpoint);

  const backbone = data.backbones.find((item) => item.id === backboneId) ?? data.backbones[0];
  const activePhase = data.phases.find((phase) => checkpoint >= phase.start && checkpoint <= phase.end)
    ?? data.phases[data.phases.length - 1];

  const result = useMemo(() => {
    const denoisingProgress = checkpoint < 25
      ? 0
      : checkpoint >= 90
        ? 1
        : (checkpoint - 25) / 64;
    const passesComplete = Math.min(
      backbone.passes,
      Math.round(backbone.passes * denoisingProgress),
    );
    const noiseRemaining = checkpoint < 15
      ? 100
      : Math.round(100 * (1 - denoisingProgress));
    const coarseStructure = Math.round(100 * Math.min(1, denoisingProgress / 0.55));
    const fineDetail = Math.round(100 * Math.max(0, (denoisingProgress - 0.38) / 0.62));
    const computeUnits = passesComplete * backbone.computePerPass;
    const candidateReady = checkpoint >= 90;

    return {
      candidateReady,
      coarseStructure,
      computeUnits,
      denoisingProgress,
      fineDetail,
      noiseRemaining,
      passesComplete,
    };
  }, [backbone, checkpoint]);

  const reset = () => {
    setBackboneId(initialBackbone.id);
    setCheckpoint(data.defaults.checkpoint);
  };

  const moveCheckpoint = (delta: number) => {
    setCheckpoint((current) => Math.max(0, Math.min(100, current + delta)));
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Generation trace"
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
                1. Denoiser backbone
              </legend>
              <div className="mt-3 grid gap-2">
                {data.backbones.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === backbone.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'dit' ? Braces : Layers3}
                    accent={item.id === 'dit' ? 'violet' : 'cyan'}
                    onClick={() => setBackboneId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Trace checkpoint"
              value={checkpoint}
              output={`${checkpoint}%`}
              min={0}
              max={100}
              step={1}
              accent="violet"
              lowLabel="Prompt"
              highLabel="Pixels"
              onChange={setCheckpoint}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                title="Move trace backward"
                aria-label="Move trace backward by ten percent"
                onClick={() => moveCheckpoint(-10)}
                disabled={checkpoint === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                title="Move trace forward"
                aria-label="Move trace forward by ten percent"
                onClick={() => moveCheckpoint(10)}
                disabled={checkpoint === 100}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-500"
              >
                Next
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Cpu aria-hidden="true" className="h-4 w-4" />
                Backbone role
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{backbone.lesson}</p>
            </div>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <section aria-labelledby="trace-phase-title">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                {phaseIcon(activePhase.id)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
                  Active phase: {activePhase.operator}
                </p>
                <h4 id="trace-phase-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {activePhase.label}
                </h4>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {activePhase.description}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(250px,0.9fr)]">
            <section className="min-w-0" aria-labelledby="latent-preview-title">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Latent state</p>
                  <h4 id="latent-preview-title" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Signal emerges before fine detail
                  </h4>
                </div>
                <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                  {result.passesComplete} / {backbone.passes} passes
                </span>
              </div>

              <div className="mt-4 rounded-md border border-neutral-300 bg-neutral-100 p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div
                  className="mx-auto grid aspect-square w-full max-w-[420px] grid-cols-8 grid-rows-8 gap-1 overflow-hidden rounded border border-neutral-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-950"
                  role="img"
                  aria-label={`Abstract latent preview with ${result.noiseRemaining} percent modeled noise, ${result.coarseStructure} percent coarse structure, and ${result.fineDetail} percent fine detail`}
                >
                  {Array.from({ length: 64 }, (_, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`min-h-3 rounded-sm transition-colors duration-200 motion-reduce:transition-none ${cellClass(index, result.denoisingProgress, checkpoint)}`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                  <span>{backbone.workUnit} at the current noise level</span>
                  <span className="font-semibold">{activePhase.state}</span>
                </div>
              </div>
            </section>

            <section className="min-w-0" aria-labelledby="signal-recovery-title">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Recovered signal</p>
              <h4 id="signal-recovery-title" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                Composition arrives before texture
              </h4>
              <div className="mt-4 space-y-4 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <RecoveryBar label="Coarse structure" value={result.coarseStructure} tone="cyan" />
                <RecoveryBar label="Fine detail" value={result.fineDetail} tone="violet" />
                <RecoveryBar label="Noise removed" value={100 - result.noiseRemaining} tone="emerald" />
              </div>
              <div className={`mt-4 rounded-md border p-4 ${result.candidateReady ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {result.candidateReady ? <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Timer aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-sm font-semibold">{result.candidateReady ? 'Candidate pixels exist' : 'The sample is still internal state'}</p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {result.candidateReady
                        ? 'Decoding completes generation, but quality and policy checks still decide release.'
                        : 'Do not expose an intermediate latent as if it were a finished, evaluated image.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Noise remaining" value={`${result.noiseRemaining}%`} detail="A teaching model of the current sample state." icon={Sparkles} tone={result.noiseRemaining > 50 ? 'amber' : 'cyan'} />
            <LabMetric label="Denoiser passes" value={`${result.passesComplete}`} detail="Sequential updates completed for this trace." icon={Workflow} tone="violet" />
            <LabMetric label="Relative compute" value={result.computeUnits.toFixed(1)} detail="Profile units, not a hardware benchmark." icon={Cpu} tone="blue" />
            <LabMetric label="Visible state" value={result.candidateReady ? 'Pixels' : 'Latent'} detail={result.candidateReady ? 'Ready for evaluation.' : 'Not yet a releasable image.'} icon={result.candidateReady ? ImageIcon : ScanSearch} tone={result.candidateReady ? 'emerald' : 'neutral'} />
          </div>

          <TraceTimeline phases={data.phases} activePhase={activePhase} checkpoint={checkpoint} />
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function TraceTimeline({
  activePhase,
  checkpoint,
  phases,
}: {
  activePhase: TracePhase;
  checkpoint: number;
  phases: TracePhase[];
}) {
  return (
    <section aria-labelledby="trace-timeline-title">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Pipeline position</p>
      <h4 id="trace-timeline-title" className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
        The scheduler advances one state at a time
      </h4>
      <ol className="relative mt-4 grid gap-3 md:grid-cols-5 md:gap-2">
        {phases.map((phase, index) => {
          const complete = checkpoint > phase.end;
          const active = phase.id === activePhase.id;
          return (
            <li key={phase.id} className="relative min-w-0 pl-10 md:pl-0 md:pt-9">
              {index < phases.length - 1 ? (
                <span aria-hidden="true" className="absolute bottom-[-0.75rem] left-[0.95rem] top-8 w-px bg-neutral-300 md:bottom-auto md:left-1/2 md:right-[-50%] md:top-4 md:h-px md:w-auto dark:bg-neutral-700" />
              ) : null}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold md:left-1/2 md:-translate-x-1/2 ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-violet-500 bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-950' : 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400'}`}
              >
                {complete ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <div className={active ? 'text-neutral-950 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'}>
                <p className="text-xs font-semibold">{phase.label}</p>
                <p className="mt-1 text-[11px] leading-4 opacity-75">{phase.operator}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RecoveryBar({ label, tone, value }: { label: string; tone: 'cyan' | 'violet' | 'emerald'; value: number }) {
  const color = tone === 'cyan' ? 'bg-cyan-500' : tone === 'violet' ? 'bg-violet-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function cellClass(index: number, denoisingProgress: number, checkpoint: number) {
  if (checkpoint < 15) return noiseClass(index, checkpoint);

  const revealThreshold = ((index * 37 + 17) % 100) / 100;
  const structureReveal = Math.min(1, denoisingProgress * 1.3);
  if (revealThreshold <= structureReveal) return targetClass(index, checkpoint >= 90);
  return noiseClass(index, checkpoint);
}

function noiseClass(index: number, checkpoint: number) {
  const classes = [
    'bg-neutral-300 dark:bg-neutral-700',
    'bg-violet-300 dark:bg-violet-800',
    'bg-cyan-300 dark:bg-cyan-800',
    'bg-amber-200 dark:bg-amber-900',
    'bg-blue-300 dark:bg-blue-800',
  ];
  return classes[(index * 13 + checkpoint) % classes.length];
}

function targetClass(index: number, decoded: boolean) {
  const row = Math.floor(index / 8);
  const column = index % 8;
  if (row <= 2 && row === 1 && column >= 5 && column <= 6) {
    return decoded ? 'bg-amber-400 dark:bg-amber-400' : 'bg-amber-300 dark:bg-amber-500';
  }
  if (row <= 2) return decoded ? 'bg-cyan-300 dark:bg-cyan-700' : 'bg-cyan-200 dark:bg-cyan-800';
  if (row === 3) {
    return column >= 2 && column <= 5
      ? 'bg-violet-500 dark:bg-violet-600'
      : 'bg-blue-300 dark:bg-blue-700';
  }
  if (row === 4) return column % 3 === 0 ? 'bg-neutral-600 dark:bg-neutral-500' : 'bg-violet-700 dark:bg-violet-700';
  if (row <= 6) return decoded ? 'bg-blue-500 dark:bg-blue-600' : 'bg-blue-400 dark:bg-blue-700';
  return column % 2 === 0 ? 'bg-cyan-600 dark:bg-cyan-700' : 'bg-blue-700 dark:bg-blue-800';
}

function phaseIcon(id: string) {
  if (id === 'encode') return <Braces aria-hidden="true" className="h-5 w-5" />;
  if (id === 'initialize') return <Sparkles aria-hidden="true" className="h-5 w-5" />;
  if (id === 'decode') return <ImageIcon aria-hidden="true" className="h-5 w-5" />;
  return <Workflow aria-hidden="true" className="h-5 w-5" />;
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Generation trace"
        title="Loading the latent trace"
        description="Preparing model stages and denoising checkpoints."
        icon={Workflow}
        accent="violet"
      />
      <LearningLabBody>
        <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading trace
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Generation trace"
        title="The latent trace could not load"
        description="The lesson remains available, but this interactive trace needs valid model data."
        icon={CircleAlert}
        accent="rose"
      />
      <LearningLabBody>
        <p className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50">
          {detail}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
