'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Gauge, Inbox, Server } from 'lucide-react';
import { LabChoice, LabMetric, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/sagemaker-cost';
const DEFAULT_DATA_FILE = '/api/content/technology/sagemaker/data/inference-mode-model.json';
type Outcome = { eligible: boolean; reason: string; requestPath: string; idleBehavior: string; ownership: string };
type Scenario = { id: string; label: string; detail: string; payload: string; processing: string; arrival: string; outcomes: Record<string, Outcome> };
type Mode = { id: string; label: string; detail: string };
type Model = { title: string; description: string; defaults: { scenarioId: string; modeId: string }; modes: Mode[]; scenarios: Scenario[] };
function isModel(value: unknown): value is Model { const data = value as Partial<Model>; return Boolean(data?.title && data.description && data.defaults?.scenarioId && data.defaults.modeId && Array.isArray(data.modes) && data.modes.length === 4 && Array.isArray(data.scenarios) && data.scenarios.length >= 3); }

export default function SageMakerCostCalculator({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); fetch(dataFile, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(`Request failed with status ${response.status}`); return response.json() as Promise<unknown>; }).then((payload) => { if (!isModel(payload)) throw new Error('The inference mode model is incomplete.'); setModel(payload); }).catch((loadError: unknown) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load inference modes.'); }); return () => controller.abort(); }, [dataFile]);
  if (!model) return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Inference mode lab" title="Match the request contract to the serving path" description="Loading inference constraints." icon={Server} accent="blue" /><LearningLabBody><p className="min-h-32 text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading modes'}</p></LearningLabBody></LearningLab></div>;
  return <Workbench model={model} />;
}

function Workbench({ model }: { model: Model }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [modeId, setModeId] = useState(model.defaults.modeId);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];
  const mode = model.modes.find((item) => item.id === modeId) ?? model.modes[0];
  const outcome = scenario.outcomes[mode.id];
  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Inference mode lab" title={model.title} description={model.description} icon={Server} accent="blue" onReset={() => { setScenarioId(model.defaults.scenarioId); setModeId(model.defaults.modeId); }} /><LearningLabBody controls={<div className="space-y-6"><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Workload contract</legend>{model.scenarios.map((item) => <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} accent="blue" onClick={() => setScenarioId(item.id)} />)}</fieldset><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Inference mode</legend>{model.modes.map((item) => <LabChoice key={item.id} selected={item.id === mode.id} label={item.label} detail={item.detail} accent="violet" onClick={() => setModeId(item.id)} />)}</fieldset></div>}><div className="grid gap-3 sm:grid-cols-3"><LabMetric label="Payload" value={scenario.payload} icon={Inbox} tone="blue" /><LabMetric label="Processing" value={scenario.processing} icon={Clock3} tone="violet" /><LabMetric label="Arrival" value={scenario.arrival} icon={Gauge} tone="amber" /></div><div className={`mt-6 rounded-md border p-5 ${outcome.eligible ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}><div className="flex items-start gap-3">{outcome.eligible ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<div><p className="font-semibold">{outcome.eligible ? `${mode.label} fits the stated hard constraints.` : `${mode.label} violates this request contract.`}</p><p className="mt-2 text-sm leading-6 opacity-80">{outcome.reason}</p></div></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><Fact label="Request path" value={outcome.requestPath} /><Fact label="Idle behavior" value={outcome.idleBehavior} /><Fact label="You still own" value={outcome.ownership} /></div><p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Eligibility is not a performance claim. Measure model latency, cold start, concurrency, memory, failures, and current regional pricing on the chosen runtime.</p></LearningLabBody></LearningLab></div>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 text-sm leading-6 text-neutral-900 dark:text-neutral-100">{value}</p></div>; }
