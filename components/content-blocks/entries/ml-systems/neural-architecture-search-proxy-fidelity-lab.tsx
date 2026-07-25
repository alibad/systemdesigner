'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  Medal,
  ShieldCheck,
  Target,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface ProxyScenario {
  id: string;
  label: string;
  detail: string;
  rankCorrelation: number;
  biasPoints: number;
  proxyHours: number;
  hardwareMatched: boolean;
}

interface ProxyData {
  title: string;
  description: string;
  defaults: { scenarioId: string; finalists: number; repeatedSeeds: number };
  scenarios: ProxyScenario[];
}

const BLOCK_ID = 'ml-systems/neural-architecture-search-proxy-fidelity-lab';

function isProxyData(value: unknown): value is ProxyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProxyData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults && Array.isArray(candidate.scenarios) && candidate.scenarios.length > 0);
}

export default function NeuralArchitectureSearchProxyFidelityLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ProxyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) { setLoadError('No proxy scenarios were supplied.'); return; }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(`Request failed with status ${response.status}`); return response.json() as Promise<unknown>; })
      .then((payload) => { if (!isProxyData(payload)) throw new Error('Proxy scenario data is incomplete.'); setData(payload); })
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadError(error instanceof Error ? error.message : 'Unable to load proxy scenarios.'); });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Proxy lab unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading proxy lab" detail="Preparing ranking evidence..." />;
  return <ProxyLab data={data} />;
}

function ProxyLab({ data }: { data: ProxyData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [finalists, setFinalists] = useState(data.defaults.finalists);
  const [repeatedSeeds, setRepeatedSeeds] = useState(data.defaults.repeatedSeeds);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const correlationStrength = Math.max(0, Math.min(1, (scenario.rankCorrelation + 1) / 2));
    const coverage = 1 - Math.exp(-finalists * repeatedSeeds / 12);
    const hardwarePenalty = scenario.hardwareMatched ? 1 : 0.78;
    const winnerConfidence = Math.min(0.99, correlationStrength * 0.7 + coverage * 0.3) * hardwarePenalty;
    const confirmationHours = finalists * repeatedSeeds * 18;
    const healthy = scenario.rankCorrelation >= 0.7 && scenario.biasPoints <= 1.5 && scenario.hardwareMatched && winnerConfidence >= 0.8;
    return { confirmationHours, healthy, winnerConfidence };
  }, [finalists, repeatedSeeds, scenario]);

  const reset = () => { setScenarioId(data.defaults.scenarioId); setFinalists(data.defaults.finalists); setRepeatedSeeds(data.defaults.repeatedSeeds); };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Proxy fidelity lab" title={data.title} description={data.description} icon={FlaskConical} accent="cyan" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-7"><fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate proxy</legend><div className="mt-3 grid gap-2">{data.scenarios.map((item) => <LabChoice key={item.id} selected={scenario.id === item.id} label={item.label} detail={item.detail} icon={GitCompareArrows} accent={item.id === 'matched-partial-training' ? 'emerald' : 'amber'} onClick={() => setScenarioId(item.id)} />)}</div></fieldset><LabRange label="Finalists retrained fully" value={finalists} output={finalists.toLocaleString()} min={2} max={20} step={1} accent="violet" lowLabel="Cheap confirmation" highLabel="Broader verification" onChange={setFinalists} /><LabRange label="Seeds per finalist" value={repeatedSeeds} output={repeatedSeeds.toLocaleString()} min={1} max={10} step={1} accent="blue" lowLabel="High variance" highLabel="Stronger estimate" onChange={setRepeatedSeeds} /></div>}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}><div className="flex items-start gap-3">{result.healthy ? <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-xs font-semibold uppercase opacity-75">Evidence verdict</p><h4 className="mt-1 text-xl font-semibold">{result.healthy ? 'The proxy can shortlist candidates, not certify the winner' : 'The proxy ranking is unsafe for architecture selection'}</h4><p className="mt-2 text-sm leading-6 opacity-80">{result.healthy ? 'Use the proxy to allocate search budget, then retrain finalists from scratch on matched hardware and report repeated-seed variance.' : 'Repair rank correlation, hardware mismatch, or systematic bias before spending more search compute on this signal.'}</p></div></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><LabMetric label="Rank correlation" value={scenario.rankCorrelation.toFixed(2)} detail="Proxy versus full-training order" icon={GitCompareArrows} tone={scenario.rankCorrelation >= 0.7 ? 'emerald' : 'rose'} /><LabMetric label="Systematic bias" value={`${scenario.biasPoints.toFixed(1)} pp`} detail="Proxy-to-full quality gap" icon={Gauge} tone={scenario.biasPoints <= 1.5 ? 'cyan' : 'amber'} /><LabMetric label="Winner confidence" value={`${(result.winnerConfidence * 100).toFixed(0)}%`} detail="Illustrative confirmation confidence" icon={Medal} tone={result.winnerConfidence >= 0.8 ? 'emerald' : 'rose'} /><LabMetric label="Confirmation work" value={`${result.confirmationHours.toLocaleString()} h`} detail={`${finalists} finalists x ${repeatedSeeds} seeds x 18h`} icon={Target} tone="violet" /></div>
            <div className="grid gap-3 md:grid-cols-3"><EvidenceCard icon={FlaskConical} title="Proxy audit" detail="Measure pairwise agreement, rank correlation, bias by architecture family, and stability across seeds." /><EvidenceCard icon={ShieldCheck} title="Matched confirmation" detail="Use full data, training budget, compiler, precision, batch shape, and target hardware for finalists." /><EvidenceCard icon={Medal} title="Pareto decision" detail="Select from quality, p95 latency, memory, energy, robustness, and variance instead of one blended score." /></div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EvidenceCard({ icon: Icon, title, detail }: { icon: typeof FlaskConical; title: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><Icon aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /><p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
function LabState({ title, detail }: { title: string; detail: string }) { return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"><CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p></div></div></LearningLabBody></LearningLab></div>; }

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
