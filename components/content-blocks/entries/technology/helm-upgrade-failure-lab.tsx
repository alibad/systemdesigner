'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Database, GitCommitHorizontal, History, ShieldAlert } from 'lucide-react';
import { LabChoice, LabMetric, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/helm-upgrade-failure-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/helm/data/upgrade-failure-model.json';
type Item = { id: string; label: string; detail: string };
type Outcome = { release: string; cluster: string; externalState: string; nextStep: string; safe: boolean };
type Failure = Item & { outcomes: Record<string, Outcome> };
type Model = { title: string; description: string; defaults: { strategyId: string; failureId: string }; strategies: Item[]; failures: Failure[] };

function isModel(value: unknown): value is Model { const data = value as Partial<Model>; return Boolean(data && data.title && data.description && data.defaults?.strategyId && data.defaults?.failureId && Array.isArray(data.strategies) && data.strategies.length >= 3 && Array.isArray(data.failures) && data.failures.length >= 3); }

export default function HelmUpgradeFailureLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); fetch(dataFile, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(`Request failed with status ${response.status}`); return response.json() as Promise<unknown>; }).then((payload) => { if (!isModel(payload)) throw new Error('The upgrade model is incomplete.'); setModel(payload); }).catch((loadError: unknown) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load upgrade outcomes.'); }); return () => controller.abort(); }, [dataFile]);
  if (!model) return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Upgrade failure lab" title="Trace release and external state separately" description="Loading upgrade scenarios." icon={History} accent="amber" /><LearningLabBody><p className="min-h-32 text-sm text-neutral-600 dark:text-neutral-300">{error ?? 'Loading outcomes'}</p></LearningLabBody></LearningLab></div>;
  return <Workbench model={model} />;
}

function Workbench({ model }: { model: Model }) {
  const [strategyId, setStrategyId] = useState(model.defaults.strategyId);
  const [failureId, setFailureId] = useState(model.defaults.failureId);
  const failure = model.failures.find((item) => item.id === failureId) ?? model.failures[0];
  const strategy = model.strategies.find((item) => item.id === strategyId) ?? model.strategies[0];
  const outcome = failure.outcomes[strategy.id];
  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Upgrade failure lab" title={model.title} description={model.description} icon={History} accent="amber" onReset={() => { setStrategyId(model.defaults.strategyId); setFailureId(model.defaults.failureId); }} /><LearningLabBody controls={<div className="space-y-6"><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Upgrade strategy</legend>{model.strategies.map((item) => <LabChoice key={item.id} selected={item.id === strategy.id} label={item.label} detail={item.detail} accent="amber" onClick={() => setStrategyId(item.id)} />)}</fieldset><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Inject failure</legend>{model.failures.map((item) => <LabChoice key={item.id} selected={item.id === failure.id} label={item.label} detail={item.detail} accent="rose" onClick={() => setFailureId(item.id)} />)}</fieldset></div>}><div className="grid gap-3 md:grid-cols-3"><LabMetric label="Helm release" value={outcome.release} icon={History} tone={outcome.safe ? 'emerald' : 'amber'} /><LabMetric label="Cluster resources" value={outcome.cluster} icon={GitCommitHorizontal} tone="blue" /><LabMetric label="External data" value={outcome.externalState} icon={Database} tone={outcome.externalState === 'unchanged' ? 'emerald' : 'rose'} /></div><div className={`mt-6 rounded-md border p-5 ${outcome.safe ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'}`}><div className="flex items-start gap-3">{outcome.safe ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<div><p className="font-semibold">{outcome.nextStep}</p><p className="mt-2 text-sm leading-6 opacity-80">`--atomic` can roll back release-managed Kubernetes resources after a failed waited upgrade. It cannot reverse an external database migration unless that migration has its own compatible recovery design.</p></div></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{['Render and validate', 'Apply and wait', 'Observe or recover'].map((label, index) => <div key={label} className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{index + 1}</span><p className="mt-3 text-sm font-semibold">{label}</p></div>)}</div></LearningLabBody></LearningLab></div>;
}
