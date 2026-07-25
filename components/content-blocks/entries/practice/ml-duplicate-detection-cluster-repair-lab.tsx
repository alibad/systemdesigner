'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  GitMerge,
  History,
  Link2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Split,
  Unlink,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

type ScenarioId = 'healthy' | 'false-merge' | 'version-skew' | 'poisoned-feedback';
type ActionId = 'monitor' | 'detach' | 'rollback' | 'quarantine';

type Scenario = {
  id: ScenarioId;
  label: string;
  eyebrow: string;
  description: string;
  bridgeLabel: string;
  manifest: { model: string; index: string; threshold: string };
  impactedItems: number;
  pendingPairs: number;
  expectedAction: ActionId;
  result: string;
};

type Action = {
  id: ActionId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const scenarios: Scenario[] = [
  {
    id: 'healthy',
    label: 'Healthy release',
    eyebrow: 'Control',
    description: 'Model, index, and threshold versions agree; the bridge has reviewer evidence.',
    bridgeLabel: 'reviewed duplicate',
    manifest: { model: 'v18', index: 'v18', threshold: 'cal-18' },
    impactedItems: 0,
    pendingPairs: 24,
    expectedAction: 'monitor',
    result: 'Keep the edge and watch normal reversal and cluster-growth rates.',
  },
  {
    id: 'false-merge',
    label: 'False bridge edge',
    eyebrow: 'Cluster failure',
    description: 'One reviewed correction proves the edge joining two otherwise valid groups is wrong.',
    bridgeLabel: 'incorrect bridge',
    manifest: { model: 'v18', index: 'v18', threshold: 'cal-18' },
    impactedItems: 7,
    pendingPairs: 31,
    expectedAction: 'detach',
    result: 'Remove the bad edge and recompute only this connected component.',
  },
  {
    id: 'version-skew',
    label: 'Index version skew',
    eyebrow: 'Release failure',
    description: 'The pair verifier uses v19 embeddings while the serving index still contains v18 vectors.',
    bridgeLabel: 'untrusted score',
    manifest: { model: 'v19', index: 'v18', threshold: 'cal-19' },
    impactedItems: 4200,
    pendingPairs: 860,
    expectedAction: 'rollback',
    result: 'Freeze cluster writes and restore one version-aligned release manifest.',
  },
  {
    id: 'poisoned-feedback',
    label: 'Feedback anomaly',
    eyebrow: 'Data failure',
    description: 'One reviewer source suddenly labels broad template matches as duplicates at abnormal volume.',
    bridgeLabel: 'suspect label',
    manifest: { model: 'v18', index: 'v18', threshold: 'cal-18b' },
    impactedItems: 1280,
    pendingPairs: 640,
    expectedAction: 'quarantine',
    result: 'Quarantine the source and derived edges before recalibration or retraining.',
  },
];

const actions: Action[] = [
  { id: 'monitor', label: 'Monitor', description: 'Preserve healthy evidence.', icon: Activity },
  { id: 'detach', label: 'Detach edge', description: 'Repair one component.', icon: Unlink },
  { id: 'rollback', label: 'Rollback release', description: 'Realign all versions.', icon: RotateCcw },
  { id: 'quarantine', label: 'Quarantine labels', description: 'Stop suspect feedback.', icon: ShieldAlert },
];

export default function MlDuplicateDetectionClusterRepairLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('false-merge');
  const [actionId, setActionId] = useState<ActionId>('detach');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[1];
    const action = actions.find((item) => item.id === actionId) ?? actions[1];
    const aligned = scenario.manifest.model.replace('v', '') === scenario.manifest.index.replace('v', '');
    const correct = action.id === scenario.expectedAction;
    const selectedResult = correct
      ? scenario.result
      : action.id === 'monitor'
        ? 'The system leaves a known failure active, so the blast radius can continue growing.'
        : action.id === 'detach'
          ? 'Local edge repair cannot make mismatched release versions or poisoned labels trustworthy.'
          : action.id === 'rollback'
            ? 'A fleet rollback is broader than needed when one attributable edge is wrong.'
            : 'Quarantine protects new labels, but it does not repair an existing edge or release mismatch.';

    return { scenario, action, aligned, correct, selectedResult };
  }, [actionId, scenarioId]);

  const reset = () => {
    setScenarioId('false-merge');
    setActionId('detach');
  };

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950 px-5 py-5 text-white md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              <GitMerge aria-hidden="true" className="h-4 w-4" />
              Cluster incident lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Contain a bad duplicate decision</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Inject a production failure, inspect its lineage and blast radius, then choose the narrowest safe recovery.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-neutral-700 px-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">1. Inject a scenario</legend>
            <div className="mt-3 grid gap-2">
              {scenarios.map((scenario) => {
                const selected = scenario.id === scenarioId;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScenarioId(scenario.id)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{scenario.label}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{scenario.eyebrow}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{scenario.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <ManifestCard label="Embedding model" value={model.scenario.manifest.model} aligned={model.aligned} />
            <ManifestCard label="ANN index" value={model.scenario.manifest.index} aligned={model.aligned} />
            <ManifestCard label="Calibrator" value={model.scenario.manifest.threshold} aligned={model.aligned} />
          </div>

          <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 md:p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Connected-component view</p>
                <p className="mt-1 text-xs text-neutral-500">The center edge determines whether both groups share one cluster.</p>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-bold ${model.scenario.id === 'healthy' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}>
                {model.scenario.id === 'healthy' ? 'Verified edge' : 'Failure active'}
              </span>
            </div>

            <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)]">
              <ClusterCard title="Cluster A" items={['A-102', 'A-117', 'A-144', 'A-201']} tone="cyan" />
              <div className={`flex min-h-24 flex-col items-center justify-center rounded-md border-2 border-dashed px-3 py-4 text-center ${model.scenario.id === 'healthy' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}>
                {model.scenario.id === 'healthy' ? <Link2 aria-hidden="true" className="h-6 w-6 text-emerald-600 dark:text-emerald-300" /> : <XCircle aria-hidden="true" className="h-6 w-6 text-rose-600 dark:text-rose-300" />}
                <span className="mt-2 text-xs font-bold text-neutral-950 dark:text-white">{model.scenario.bridgeLabel}</span>
                <span className="mt-1 text-[10px] text-neutral-500">edge A-201 : B-031</span>
              </div>
              <ClusterCard title="Cluster B" items={['B-031', 'B-088', 'B-104']} tone="violet" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Items exposed" value={model.scenario.impactedItems.toLocaleString()} />
              <Stat label="Pending pairs" value={model.scenario.pendingPairs.toLocaleString()} />
              <div className="col-span-2 rounded-md border border-neutral-200 bg-white p-3 md:col-span-1 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Version state</p>
                <p className={`mt-2 text-sm font-bold ${model.aligned ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{model.aligned ? 'Aligned' : 'Mismatched'}</p>
              </div>
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-500">2. Choose the containment action</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {actions.map((action) => {
                const Icon = action.icon;
                const selected = action.id === actionId;
                return (
                  <button
                    key={action.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActionId(action.id)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-950/60 dark:text-cyan-50'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    <span className="mt-2 block text-xs font-semibold">{action.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 opacity-70">{action.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className={`mt-5 rounded-lg border p-4 md:p-5 ${model.correct ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {model.correct ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">{model.correct ? 'Containment fits the failure' : 'Containment leaves a gap'}</p>
                <p className="mt-2 text-base font-bold text-neutral-950 dark:text-white">{model.action.label}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.selectedResult}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManifestCard({ label, value, aligned }: { label: string; value: string; aligned: boolean }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center justify-between gap-2">
        <History aria-hidden="true" className="h-4 w-4 text-neutral-500" />
        {aligned ? <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-500" /> : <ShieldAlert aria-hidden="true" className="h-4 w-4 text-rose-500" />}
      </div>
      <p className="mt-3 text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}

function ClusterCard({ title, items, tone }: { title: string; items: string[]; tone: 'cyan' | 'violet' }) {
  const toneClass = tone === 'cyan'
    ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/35'
    : 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/35';

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        {tone === 'cyan' ? <Split aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> : <GitMerge aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />}
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">{title}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => <span key={item} className="rounded border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-200">{item}</span>)}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-2 text-lg font-bold tabular-nums text-neutral-950 dark:text-white">{value}</p>
    </div>
  );
}
