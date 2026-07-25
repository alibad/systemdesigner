'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CameraOff, CloudRain, Cpu, EyeOff, GitBranch, Route, ShieldAlert, ShieldCheck, TimerReset, type LucideIcon } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PolicyId = 'continue' | 'reacquire' | 'minimal-risk';

interface Policy { id: PolicyId; label: string; detail: string; }
interface Scenario { id: string; label: string; detail: string; confidence: number; path: string; maneuver: string; evidence: string; recommendedPolicy: PolicyId; }
interface ScenarioData { title: string; description: string; policies: Policy[]; scenarios: Scenario[]; }

function isScenarioData(value: unknown): value is ScenarioData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ScenarioData>;
  const validPolicy = (policy: unknown): policy is Policy => Boolean(policy) && typeof policy === 'object' && ['continue', 'reacquire', 'minimal-risk'].includes(String((policy as Partial<Policy>).id)) && typeof (policy as Partial<Policy>).label === 'string' && typeof (policy as Partial<Policy>).detail === 'string';
  const validScenario = (scenario: unknown): scenario is Scenario => Boolean(scenario) && typeof scenario === 'object' && typeof (scenario as Partial<Scenario>).id === 'string' && typeof (scenario as Partial<Scenario>).label === 'string' && typeof (scenario as Partial<Scenario>).detail === 'string' && typeof (scenario as Partial<Scenario>).confidence === 'number' && typeof (scenario as Partial<Scenario>).path === 'string' && typeof (scenario as Partial<Scenario>).maneuver === 'string' && typeof (scenario as Partial<Scenario>).evidence === 'string' && ['continue', 'reacquire', 'minimal-risk'].includes(String((scenario as Partial<Scenario>).recommendedPolicy));
  return typeof data.title === 'string' && typeof data.description === 'string' && Array.isArray(data.policies) && data.policies.length > 0 && data.policies.every(validPolicy) && Array.isArray(data.scenarios) && data.scenarios.length > 0 && data.scenarios.every(validScenario);
}

function scenarioIcon(id: string): LucideIcon {
  if (id === 'occlusion') return EyeOff;
  if (id === 'glare-weather') return CloudRain;
  if (id === 'cut-in') return GitBranch;
  if (id === 'stale-temporal-state') return TimerReset;
  if (id === 'compute-degradation') return Cpu;
  return CameraOff;
}

export default function TeslaAutopilotScenarioFallbackLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ScenarioData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState<PolicyId>('reacquire');

  useEffect(() => {
    if (!dataFile) {
      setLoadError(true);
      return;
    }
    const controller = new AbortController();
    setLoadError(false);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Scenario fallback request failed');
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScenarioData(payload)) throw new Error('Scenario fallback data is invalid');
        setData(payload);
        setScenarioId(payload.scenarios[0].id);
        setPolicyId(payload.scenarios[0].recommendedPolicy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((candidate) => candidate.id === scenarioId) ?? data.scenarios[0];
    const policy = data.policies.find((candidate) => candidate.id === policyId) ?? data.policies[0];
    const recommended = policy.id === scenario.recommendedPolicy;
    const confidence = policy.id === 'continue' ? scenario.confidence : policy.id === 'reacquire' ? Math.min(100, scenario.confidence + 12) : Math.min(100, scenario.confidence + 4);
    const path = policy.id === 'continue' ? scenario.path : policy.id === 'reacquire' ? `Constrained path: preserve buffer while checking ${scenario.path.toLowerCase()}` : 'Minimal-risk path: constrain motion and transition under the operating design';
    const plannedManeuver = policy.id === 'continue' ? scenario.maneuver : policy.id === 'reacquire' ? 'Reduce speed, hold the safer corridor, and defer the uncertain maneuver' : 'Limit automation and request the product-defined minimal-risk response';
    const response = policy.id === 'continue' ? 'No protective change: degraded evidence remains on the normal maneuver path.' : policy.id === 'reacquire' ? 'Slow, retain margin, and continue only after the relevant evidence is fresh enough.' : 'Do not depend on new high-confidence planning; constrain the action and transition to the defined fallback.';
    const blastRadius = policy.id === 'continue' ? scenario.id === 'compute-degradation' ? 'All decisions sharing the degraded compute path' : 'Current maneuver and nearby actors' : policy.id === 'reacquire' ? 'Current maneuver, bounded by lower speed and path scope' : 'Current automation session; the response prevents broader plan propagation';
    const tone = recommended ? 'healthy' : policy.id === 'continue' ? 'danger' : 'warning';
    return { scenario, policy, recommended, confidence, path, plannedManeuver, response, blastRadius, tone };
  }, [data, policyId, scenarioId]);

  if (loadError) {
    return <div data-content-block="case-studies/tesla-autopilot-scenario-fallback-lab" role="alert" className="min-h-40 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">The scenario and fallback model could not be loaded.</div>;
  }
  if (!data || !model) {
    return <div data-content-block="case-studies/tesla-autopilot-scenario-fallback-lab" aria-busy="true" aria-label="Loading scenario and fallback model" className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />;
  }

  const reset = () => {
    setScenarioId(data.scenarios[0].id);
    setPolicyId(data.scenarios[0].recommendedPolicy);
  };
  const outcomeClass = model.tone === 'healthy' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : model.tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';

  return (
    <div data-content-block="case-studies/tesla-autopilot-scenario-fallback-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Evidence-to-fallback decision model" title={data.title} description={data.description} icon={ShieldAlert} accent="amber" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject a scenario</legend>
            <div className="mt-3 grid gap-2">{data.scenarios.map((scenario) => <LabChoice key={scenario.id} selected={scenario.id === model.scenario.id} label={scenario.label} detail={scenario.detail} icon={scenarioIcon(scenario.id)} accent="amber" onClick={() => { setScenarioId(scenario.id); setPolicyId(scenario.recommendedPolicy); }} />)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose a fallback policy</legend>
            <div className="mt-3 grid gap-2">{data.policies.map((policy) => <LabChoice key={policy.id} selected={policy.id === model.policy.id} label={policy.label} detail={policy.detail} icon={policy.id === 'continue' ? AlertTriangle : policy.id === 'reacquire' ? Route : ShieldCheck} accent={policy.id === 'continue' ? 'rose' : policy.id === 'reacquire' ? 'amber' : 'emerald'} onClick={() => setPolicyId(policy.id)} />)}</div>
          </fieldset>
        </div>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LabMetric label="Scenario confidence" value={`${model.confidence}%`} detail={model.policy.id === 'continue' ? 'No new evidence requested' : 'Illustrative response confidence, not a recovered scene score'} icon={model.confidence >= 80 ? ShieldCheck : ShieldAlert} tone={model.confidence >= 80 ? 'emerald' : 'amber'} />
            <LabMetric label="Planned maneuver" value={model.policy.id === 'continue' ? 'Unchanged' : model.policy.id === 'reacquire' ? 'Constrained' : 'Minimal risk'} detail={model.plannedManeuver} icon={Route} tone={model.tone === 'healthy' ? 'emerald' : model.tone === 'warning' ? 'amber' : 'rose'} />
            <LabMetric label="Policy fit" value={model.recommended ? 'Recommended' : 'Not recommended'} detail={model.recommended ? 'Matches the scenario’s stated fallback.' : `Preferred: ${data.policies.find((policy) => policy.id === model.scenario.recommendedPolicy)?.label ?? 'conservative fallback'}`} icon={model.recommended ? ShieldCheck : AlertTriangle} tone={model.recommended ? 'emerald' : 'rose'} />
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Path state</p><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{model.path}</p><p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><span className="font-semibold">Evidence:</span> {model.scenario.evidence}</p></div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Blast radius</p><p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{model.blastRadius}</p><p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><span className="font-semibold">Minimal-risk response:</span> {model.response}</p></div>
          </div>
          <div className={`mt-4 rounded-md border p-4 ${outcomeClass}`}><p className="text-sm font-semibold">{model.recommended ? 'The selected fallback narrows the unsafe action set.' : 'The selected policy leaves a mismatch between degraded evidence and maneuver authority.'}</p><p className="mt-1 text-sm leading-6 opacity-80">A real implementation would bind these decisions to its validated operating domain, vehicle controls, human-supervision model, and jurisdictional requirements.</p></div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
