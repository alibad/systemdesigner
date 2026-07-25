'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Gauge,
  GitBranch,
  Network,
  Play,
  Route,
  Server,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type NodeStatus = 'healthy' | 'degraded' | 'failed';

interface FailureNode { id: string; label: string; responsibility: string; }
interface Mitigation { id: string; label: string; detail: string; }
interface Outcome { path: string[]; startupDelay: string; rebufferRisk: string; blastRadius: string; result: string; recovery: string[]; }
interface Scenario { id: string; label: string; detail: string; recommendedMitigation: string; statuses: Record<string, NodeStatus>; outcomes: Record<string, Outcome>; }
interface FailureData { title: string; description: string; nodes: FailureNode[]; mitigations: Mitigation[]; scenarios: Scenario[]; }

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isNodeStatus(value: unknown): value is NodeStatus { return value === 'healthy' || value === 'degraded' || value === 'failed'; }

function isFailureData(value: unknown): value is FailureData {
  if (!isRecord(value) || typeof value.title !== 'string' || typeof value.description !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.mitigations) || !Array.isArray(value.scenarios) || value.nodes.length < 2 || value.mitigations.length < 2 || value.scenarios.length < 2) return false;
  const nodesValid = value.nodes.every((node) => isRecord(node) && typeof node.id === 'string' && typeof node.label === 'string' && typeof node.responsibility === 'string');
  const mitigationsValid = value.mitigations.every((mitigation) => isRecord(mitigation) && typeof mitigation.id === 'string' && typeof mitigation.label === 'string' && typeof mitigation.detail === 'string');
  if (!nodesValid || !mitigationsValid) return false;
  const nodeIds = new Set(value.nodes.map((node) => String(node.id)));
  const mitigationIds = new Set(value.mitigations.map((mitigation) => String(mitigation.id)));
  return value.scenarios.every((scenario) => {
    if (!isRecord(scenario)) return false;
    const statuses = scenario.statuses;
    const outcomes = scenario.outcomes;
    if (
      typeof scenario.id !== 'string' ||
      typeof scenario.label !== 'string' ||
      typeof scenario.detail !== 'string' ||
      typeof scenario.recommendedMitigation !== 'string' ||
      !mitigationIds.has(scenario.recommendedMitigation) ||
      !isRecord(statuses) ||
      !isRecord(outcomes)
    ) return false;
    const statusesValid = [...nodeIds].every((id) => isNodeStatus(statuses[id]));
    const outcomesValid = [...mitigationIds].every((id) => {
      const outcome = outcomes[id];
      return isRecord(outcome) && Array.isArray(outcome.path) && outcome.path.every((nodeId) => typeof nodeId === 'string' && nodeIds.has(nodeId)) && typeof outcome.startupDelay === 'string' && typeof outcome.rebufferRisk === 'string' && typeof outcome.blastRadius === 'string' && typeof outcome.result === 'string' && Array.isArray(outcome.recovery) && outcome.recovery.every((step) => typeof step === 'string');
    });
    return statusesValid && outcomesValid;
  });
}

function nodeIcon(id: string): LucideIcon {
  if (id === 'player') return Play;
  if (id === 'control') return ShieldCheck;
  if (id.includes('edge')) return Server;
  if (id === 'origin') return Cloud;
  return Network;
}

function scenarioIcon(id: string): LucideIcon {
  if (id === 'cache-miss-storm') return Activity;
  if (id === 'edge-outage') return Server;
  if (id === 'origin-degradation') return Cloud;
  if (id === 'manifest-failure') return ShieldAlert;
  return WifiOff;
}

function mitigationIcon(id: string): LucideIcon { return id === 'steer-and-fallback' ? GitBranch : id === 'coalesce-and-degrade' ? Gauge : Route; }

const statusStyles: Record<NodeStatus, string> = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  degraded: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  failed: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
};

export default function NetflixStreamingPlaybackEdgeFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [mitigationId, setMitigationId] = useState('');

  useEffect(() => {
    if (!dataFile) { setLoadError(true); return; }
    const controller = new AbortController();
    setData(null); setLoadError(false);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(`Failure model request failed: ${response.status}`); return response.json() as Promise<unknown>; })
      .then((payload) => { if (!isFailureData(payload)) throw new Error('Failure model data is invalid'); setData(payload); setScenarioId(payload.scenarios[0].id); setMitigationId(payload.mitigations[1]?.id ?? payload.mitigations[0].id); })
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(true); });
    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const mitigation = data.mitigations.find((item) => item.id === mitigationId) ?? data.mitigations[0];
    return { scenario, mitigation, outcome: scenario.outcomes[mitigation.id], recommended: scenario.recommendedMitigation === mitigation.id };
  }, [data, mitigationId, scenarioId]);

  if (loadError) return <div role="alert" className="min-h-40 rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">The playback failure model could not be loaded.</div>;
  if (!data || !model || !model.outcome) return <div aria-busy="true" className="min-h-[760px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />;

  const reset = () => { setScenarioId(data.scenarios[0].id); setMitigationId(data.mitigations[1]?.id ?? data.mitigations[0].id); };
  const safeOutcome = model.recommended;

  return (
    <div data-content-block="case-studies/netflix-streaming-playback-edge-failure-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Playback and edge failure lab" title={data.title} description={data.description} icon={ShieldAlert} accent="amber" onReset={reset} />
        <LearningLabBody controls={<fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a failure</legend><div className="mt-3 space-y-2">{data.scenarios.map((scenario) => <LabChoice key={scenario.id} selected={scenario.id === model.scenario.id} label={scenario.label} detail={scenario.detail} icon={scenarioIcon(scenario.id)} accent="amber" onClick={() => setScenarioId(scenario.id)} />)}</div></fieldset>}>
          <fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose a mitigation</legend><div className="mt-3 grid gap-3 md:grid-cols-3">{data.mitigations.map((mitigation) => <LabChoice key={mitigation.id} selected={mitigation.id === model.mitigation.id} label={mitigation.label} detail={mitigation.detail} icon={mitigationIcon(mitigation.id)} accent="blue" onClick={() => setMitigationId(mitigation.id)} />)}</div></fieldset>
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <LabMetric label="Startup delay" value={model.outcome.startupDelay} detail="Time-to-first-frame risk" icon={Play} tone={model.outcome.startupDelay === 'High' ? 'rose' : model.outcome.startupDelay === 'Moderate' ? 'amber' : 'emerald'} />
            <LabMetric label="Rebuffer risk" value={model.outcome.rebufferRisk} detail="Continuity risk after start" icon={Gauge} tone={model.outcome.rebufferRisk.includes('High') ? 'rose' : model.outcome.rebufferRisk.includes('Moderate') ? 'amber' : 'emerald'} />
            <LabMetric label="Blast radius" value={model.outcome.blastRadius} detail="Smallest affected boundary" icon={Network} tone={safeOutcome ? 'violet' : 'rose'} />
            <LabMetric label="Mitigation fit" value={safeOutcome ? 'Fits incident' : 'Leaves a gap'} detail={safeOutcome ? 'Recommended by this scenario' : 'Compare the route and recovery sequence'} icon={safeOutcome ? CheckCircle2 : CircleAlert} tone={safeOutcome ? 'emerald' : 'amber'} />
          </div>
          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Resulting request path</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">The selected mitigation determines which dependencies the player still needs.</p></div><output className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${safeOutcome ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'}`}>{safeOutcome ? 'Recommended response' : 'Alternative response'}</output></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">{model.outcome.path.map((nodeId, index) => { const node = data.nodes.find((item) => item.id === nodeId); if (!node) return null; const Icon = nodeIcon(node.id); return <div key={`${node.id}-${index}`} className="flex items-center gap-2">{index > 0 ? <Route aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" /> : null}<div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50"><span className="flex items-center gap-2"><Icon aria-hidden="true" className="h-4 w-4" />{node.label}</span></div></div>; })}</div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.nodes.map((node) => { const Icon = nodeIcon(node.id); const status = model.scenario.statuses[node.id]; const active = model.outcome.path.includes(node.id); return <div key={node.id} className={`min-w-0 rounded-md border p-3 ${statusStyles[status]} ${active ? 'ring-2 ring-cyan-500/60' : 'opacity-75'}`}><div className="flex items-start justify-between gap-2"><Icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="text-[10px] font-semibold uppercase">{status}</span></div><p className="mt-2 text-sm font-semibold">{node.label}</p><p className="mt-1 text-xs leading-5 opacity-80">{node.responsibility}</p></div>; })}</div>
          <div className={`mt-5 rounded-md border p-5 ${safeOutcome ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`} aria-live="polite"><div className="flex items-start gap-3">{safeOutcome ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />}<div className="min-w-0"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Viewer consequence</p><p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.outcome.result}</p></div></div><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700 marker:font-semibold dark:text-neutral-300">{model.outcome.recovery.map((step) => <li key={step}>{step}</li>)}</ol></div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
