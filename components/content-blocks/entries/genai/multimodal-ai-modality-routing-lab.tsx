'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Eye,
  FileText,
  Film,
  Gauge,
  Layers3,
  Route,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ModalityId = 'text' | 'vision' | 'audio' | 'temporal';

type Modality = {
  id: ModalityId;
  label: string;
  detail: string;
  latencyMs: number;
  costUnits: number;
};

type FusionOption = {
  id: string;
  label: string;
  detail: string;
  overheadMs: number;
  costMultiplier: number;
  conflictVisibility: string;
};

type TaskScenario = {
  id: string;
  label: string;
  brief: string;
  requiredModalityIds: ModalityId[];
  defaultModalityIds: ModalityId[];
  recommendedFusionId: string;
  baseLatencyMs: number;
  consequence: string;
};

type RoutingModel = {
  title: string;
  description: string;
  modalities: Modality[];
  fusionOptions: FusionOption[];
  tasks: TaskScenario[];
};

const BLOCK_ID = 'genai/multimodal-ai-modality-routing-lab';

const modalityIcons: Record<ModalityId, LucideIcon> = {
  text: FileText,
  vision: Eye,
  audio: AudioLines,
  temporal: Film,
};

export default function MultimodalAiModalityRoutingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RoutingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No modality-routing model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RoutingModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the modality-routing model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ModalityRoutingLab data={data} />;
}

function ModalityRoutingLab({ data }: { data: RoutingModel }) {
  const initialTask = data.tasks[0];
  const [taskId, setTaskId] = useState(initialTask?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<ModalityId[]>(initialTask?.defaultModalityIds ?? []);
  const [fusionId, setFusionId] = useState(initialTask?.recommendedFusionId ?? data.fusionOptions[0]?.id ?? '');
  const [latencyBudgetMs, setLatencyBudgetMs] = useState(900);

  const task = data.tasks.find((candidate) => candidate.id === taskId) ?? initialTask;
  const fusion = data.fusionOptions.find((candidate) => candidate.id === fusionId) ?? data.fusionOptions[0];
  const selectedModalities = data.modalities.filter((modality) => selectedIds.includes(modality.id));

  const result = useMemo(() => {
    if (!task || !fusion) return null;
    const covered = task.requiredModalityIds.filter((id) => selectedIds.includes(id));
    const missing = task.requiredModalityIds.filter((id) => !selectedIds.includes(id));
    const coverage = Math.round((covered.length / task.requiredModalityIds.length) * 100);
    const encoderLatency = Math.max(0, ...selectedModalities.map((modality) => modality.latencyMs));
    const latencyMs = task.baseLatencyMs + encoderLatency + fusion.overheadMs;
    const costUnits = selectedModalities.reduce((total, modality) => total + modality.costUnits, 0) * fusion.costMultiplier;
    const withinBudget = latencyMs <= latencyBudgetMs;
    const recommendedFusion = fusion.id === task.recommendedFusionId;

    const status = coverage < 100
      ? 'Missing evidence'
      : !withinBudget
        ? 'Over latency budget'
        : recommendedFusion
          ? 'Route fits the task'
          : 'Fits with a trade-off';

    return {
      coverage,
      missing,
      latencyMs,
      costUnits,
      withinBudget,
      recommendedFusion,
      status,
    };
  }, [fusion, latencyBudgetMs, selectedIds, selectedModalities, task]);

  if (!task || !fusion || !result) return <LabError detail="The routing model has no usable task or fusion option." />;

  const chooseTask = (nextTask: TaskScenario) => {
    setTaskId(nextTask.id);
    setSelectedIds(nextTask.defaultModalityIds);
    setFusionId(nextTask.recommendedFusionId);
  };

  const toggleModality = (id: ModalityId) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  };

  const reset = () => {
    if (!initialTask) return;
    setTaskId(initialTask.id);
    setSelectedIds(initialTask.defaultModalityIds);
    setFusionId(initialTask.recommendedFusionId);
    setLatencyBudgetMs(900);
  };

  const StatusIcon = result.coverage === 100 && result.withinBudget ? CheckCircle2 : CircleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Modality routing lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose the product task</legend>
                <div className="mt-3 space-y-2">
                  {data.tasks.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === task.id}
                      label={candidate.label}
                      detail={candidate.brief}
                      icon={Layers3}
                      accent="cyan"
                      onClick={() => chooseTask(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Admit evidence</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.modalities.map((modality) => {
                    const Icon = modalityIcons[modality.id];
                    const selected = selectedIds.includes(modality.id);
                    const required = task.requiredModalityIds.includes(modality.id);
                    return (
                      <button
                        key={modality.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleModality(modality.id)}
                        className={`rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${selected ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'}`}
                      >
                        <span className="flex items-start gap-3">
                          <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                              {modality.label}
                              {required ? <span className="rounded-sm bg-neutral-950 px-1.5 py-0.5 text-[10px] uppercase text-white dark:bg-white dark:text-neutral-950">Required</span> : null}
                            </span>
                            <span className="mt-1 block text-xs leading-5 opacity-75">{modality.detail}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Choose a fusion boundary</legend>
                <div className="mt-3 space-y-2">
                  {data.fusionOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={option.id === fusion.id}
                      label={option.label}
                      detail={option.detail}
                      icon={Route}
                      accent="violet"
                      onClick={() => setFusionId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="p95 latency budget"
                value={latencyBudgetMs}
                output={`${latencyBudgetMs} ms`}
                min={250}
                max={2500}
                step={50}
                accent="amber"
                lowLabel="Interactive"
                highLabel="Async allowed"
                onChange={setLatencyBudgetMs}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Required evidence" value={`${result.coverage}%`} detail={result.missing.length ? `Missing: ${result.missing.map((id) => data.modalities.find((modality) => modality.id === id)?.label ?? id).join(', ')}` : 'Every task-required modality is represented.'} icon={Eye} tone={result.coverage === 100 ? 'emerald' : 'rose'} />
              <LabMetric label="Estimated p95" value={`${result.latencyMs} ms`} detail={`${result.withinBudget ? 'Inside' : 'Outside'} the ${latencyBudgetMs} ms product budget.`} icon={Clock3} tone={result.withinBudget ? 'blue' : 'rose'} />
              <LabMetric label="Relative cost" value={`${result.costUnits.toFixed(1)} units`} detail="Illustrative compute index for comparing routes, not a vendor price." icon={Coins} tone="amber" />
              <LabMetric label="Route decision" value={result.status} detail={result.recommendedFusion ? 'Fusion matches the task default.' : 'Review conflict visibility and latency before release.'} icon={StatusIcon} tone={result.coverage === 100 && result.withinBudget ? 'emerald' : 'rose'} />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                Visible request path
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                <RouteStep number="1" label="Admit" value={selectedModalities.length ? selectedModalities.map((modality) => modality.label).join(' + ') : 'No media selected'} />
                <RouteStep number="2" label="Encode" value={selectedModalities.length ? `${selectedModalities.length} specialized path${selectedModalities.length === 1 ? '' : 's'} in parallel` : 'No encoder work'} />
                <RouteStep number="3" label="Fuse" value={fusion.label} />
                <RouteStep number="4" label="Release" value={result.status} />
              </ol>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${result.coverage === 100 && result.withinBudget ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Product consequence
              </div>
              <p className="mt-2 text-sm leading-6">
                {result.coverage < 100
                  ? `${task.consequence} The route is incomplete because it cannot observe all evidence required by the task contract.`
                  : !result.withinBudget
                    ? `${task.consequence} Move this path to asynchronous processing, reduce admitted evidence explicitly, or choose a cheaper measured route.`
                    : result.recommendedFusion
                      ? `${task.consequence} This route preserves the intended evidence and fits the selected latency budget.`
                      : `${task.consequence} The route fits, but ${fusion.conflictVisibility.toLowerCase()} Test that trade-off on contradictory and missing-evidence slices.`}
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RouteStep({ number, label, value }: { number: string; label: string; value: string }) {
  return (
    <li className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">{number}</span>
        {label}
      </div>
      <p className="mt-3 break-words text-sm font-semibold leading-5">{value}</p>
    </li>
  );
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[680px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading modality routing lab" />;
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <p className="font-semibold">Modality routing lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
