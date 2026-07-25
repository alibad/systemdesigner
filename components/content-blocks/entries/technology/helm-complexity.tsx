'use client';

import { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, CircleAlert, FileCode2, Layers3, ShieldCheck } from 'lucide-react';
import { LabChoice, LabMetric, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/helm-complexity';
const DEFAULT_DATA_FILE = '/api/content/technology/helm/data/values-precedence-model.json';

type Values = { replicas: number; imageTag: string; serviceType: string };
type Scenario = { id: string; label: string; detail: string; base: Values; parent: Partial<Values>; file: Partial<Values>; cli: Partial<Values> };
type Model = { title: string; description: string; defaultScenarioId: string; scenarios: Scenario[] };

function isModel(value: unknown): value is Model {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<Model>;
  return Boolean(data.title && data.description && data.defaultScenarioId && Array.isArray(data.scenarios) && data.scenarios.length >= 3);
}

export default function HelmComplexity({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isModel(payload)) throw new Error('The values precedence model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load values.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Values precedence lab" title="Render one explainable release" description="Loading lesson-owned values layers." icon={Layers3} accent="blue" /><LearningLabBody><LoadState error={error} retry={() => setReloadKey((value) => value + 1)} /></LearningLabBody></LearningLab></div>;
  }
  return <ValuesWorkbench model={model} />;
}

function ValuesWorkbench({ model }: { model: Model }) {
  const initial = model.scenarios.find((item) => item.id === model.defaultScenarioId) ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initial.id);
  const [includeFile, setIncludeFile] = useState(true);
  const [includeCli, setIncludeCli] = useState(false);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? model.scenarios[0];

  const result = useMemo(() => {
    const layers: Array<{ name: string; values: Partial<Values> }> = [
      { name: 'chart values.yaml', values: scenario.base },
      { name: 'parent chart', values: scenario.parent },
      ...(includeFile ? [{ name: 'environment file', values: scenario.file }] : []),
      ...(includeCli ? [{ name: 'CLI override', values: scenario.cli }] : []),
    ];
    const merged = layers.reduce((current, layer) => ({ ...current, ...layer.values }), scenario.base);
    const owners = Object.fromEntries((Object.keys(merged) as Array<keyof Values>).map((key) => [key, [...layers].reverse().find((layer) => layer.values[key] !== undefined)?.name ?? 'chart values.yaml']));
    const violations = [
      ...(scenario.id === 'production' && merged.replicas < 2 ? ['Production contract requires at least two replicas.'] : []),
      ...(merged.imageTag === 'latest' ? ['The release contract forbids a mutable latest image tag.'] : []),
    ];
    return { merged, owners, layers, violations };
  }, [includeCli, includeFile, scenario]);

  function chooseScenario(id: string) {
    setScenarioId(id);
    setIncludeFile(true);
    setIncludeCli(false);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Values precedence lab" title={model.title} description={model.description} icon={Layers3} accent="blue" onReset={() => chooseScenario(initial.id)} />
        <LearningLabBody controls={<div className="space-y-6"><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Release context</legend>{model.scenarios.map((item) => <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} accent="blue" onClick={() => chooseScenario(item.id)} />)}</fieldset><fieldset className="space-y-3"><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Applied overrides</legend><Toggle selected={includeFile} label="Environment values file" detail="Applied after chart and parent defaults." onClick={() => setIncludeFile((value) => !value)} /><Toggle selected={includeCli} label="CLI override" detail="Highest precedence in this lab; keep exceptional overrides visible." onClick={() => setIncludeCli((value) => !value)} /></fieldset></div>}>
          <div className="grid gap-3 sm:grid-cols-3"><LabMetric label="Applied layers" value={`${result.layers.length}`} detail="Later layers win per key" icon={Layers3} tone="blue" /><LabMetric label="Rendered replicas" value={`${result.merged.replicas}`} detail={result.owners.replicas} icon={Boxes} tone="violet" /><LabMetric label="Contract status" value={result.violations.length ? 'Blocked' : 'Ready'} detail={`${result.violations.length} release-contract violation${result.violations.length === 1 ? '' : 's'}`} icon={result.violations.length ? CircleAlert : ShieldCheck} tone={result.violations.length ? 'rose' : 'emerald'} /></div>
          <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] bg-neutral-100 px-4 py-2 text-xs font-semibold uppercase text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"><span>Key</span><span>Rendered value</span><span>Winning layer</span></div>{([['replicas', result.merged.replicas], ['imageTag', result.merged.imageTag], ['serviceType', result.merged.serviceType]] as const).map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-2 border-t border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"><code className="break-words">{key}</code><strong className="break-words">{value}</strong><span className="break-words text-neutral-600 dark:text-neutral-300">{result.owners[key]}</span></div>)}</div>
          <div className={`mt-6 rounded-md border p-4 ${result.violations.length ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'}`}><div className="flex items-start gap-3">{result.violations.length ? <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<div><p className="font-semibold">{result.violations.length ? result.violations.join(' ') : 'The merged values satisfy this lesson’s release contract.'}</p><p className="mt-1 text-sm leading-6 opacity-80">Helm merges values before rendering. Inspect the final manifests because a valid merge does not guarantee a valid Kubernetes rollout.</p></div></div></div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Toggle({ selected, label, detail, onClick }: { selected: boolean; label: string; detail: string; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`w-full rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50' : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span></button>;
}

function LoadState({ error, retry }: { error: string | null; retry: () => void }) {
  return <div className="flex min-h-40 items-center justify-center text-center">{error ? <div><CircleAlert className="mx-auto h-6 w-6 text-rose-500" aria-hidden="true" /><p className="mt-3 text-sm">{error}</p><button type="button" onClick={retry} className="mt-4 rounded-md border px-3 py-2 text-sm font-semibold">Retry</button></div> : <span className="text-sm text-neutral-600 dark:text-neutral-300"><FileCode2 className="mr-2 inline h-4 w-4" aria-hidden="true" />Loading values</span>}</div>;
}
