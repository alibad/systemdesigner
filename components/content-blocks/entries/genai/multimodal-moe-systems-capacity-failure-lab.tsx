'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Gauge,
  GitBranch,
  Route,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Unplug,
  Workflow,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Expert = {
  id: string;
  label: string;
  fallbackExpertId: string;
  tone: 'blue' | 'cyan' | 'amber' | 'violet';
};

type OverflowPolicy = {
  id: 'drop' | 'second-choice' | 'shared-fallback';
  label: string;
  detail: string;
  costMultiplier: number;
  qualityRetention: number;
  latencyPenaltyMs: number;
};

type Demand = {
  expertId: string;
  tokens: number;
  evidenceWeight: number;
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  baseLatencyMs: number;
  failedExpertId?: string;
  demands: Demand[];
};

type CapacityModel = {
  title: string;
  description: string;
  baseCapacity: number;
  sharedFallbackCapacity: number;
  capacityFactors: number[];
  experts: Expert[];
  policies: OverflowPolicy[];
  scenarios: Scenario[];
};

type ExpertResult = Expert & {
  demand: number;
  capacity: number;
  direct: number;
  overflow: number;
  fallbackIn: number;
  dropped: number;
  failed: boolean;
};

const BLOCK_ID = 'genai/multimodal-moe-systems-capacity-failure-lab';

const expertBars: Record<Expert['tone'], string> = {
  blue: 'bg-blue-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
};

const expertBorders: Record<Expert['tone'], string> = {
  blue: 'border-blue-300 dark:border-blue-800',
  cyan: 'border-cyan-300 dark:border-cyan-800',
  amber: 'border-amber-300 dark:border-amber-800',
  violet: 'border-violet-300 dark:border-violet-800',
};

export default function MultimodalMoeSystemsCapacityFailureLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState<OverflowPolicy['id']>('drop');
  const [capacityFactor, setCapacityFactor] = useState(1);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No expert-capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<CapacityModel>;
      })
      .then((model) => {
        if (!model.scenarios?.length || !model.policies?.length || !model.experts?.length) {
          throw new Error('The expert-capacity model is incomplete.');
        }
        setData(model);
        setScenarioId(model.scenarios[0].id);
        setPolicyId(model.policies[0].id);
        setCapacityFactor(model.capacityFactors[0] ?? 1);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load expert-capacity data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const normalCapacity = Math.round(data.baseCapacity * capacityFactor);
    const directByExpert = new Map<string, number>();
    const spareByExpert = new Map<string, number>();

    data.experts.forEach((expert) => {
      const demand = scenario.demands.find((item) => item.expertId === expert.id)?.tokens ?? 0;
      const capacity = scenario.failedExpertId === expert.id ? 0 : normalCapacity;
      const direct = Math.min(demand, capacity);
      directByExpert.set(expert.id, direct);
      spareByExpert.set(expert.id, capacity - direct);
    });

    let sharedRemaining = data.sharedFallbackCapacity;
    let sharedFallback = 0;
    let rerouted = 0;
    let dropped = 0;
    let weightedRisk = 0;
    const fallbackInByExpert = new Map<string, number>();
    const droppedByExpert = new Map<string, number>();
    const traces: string[] = [];

    scenario.demands.forEach((demand) => {
      const expert = data.experts.find((item) => item.id === demand.expertId);
      if (!expert) return;
      const direct = directByExpert.get(expert.id) ?? 0;
      const overflow = demand.tokens - direct;
      if (!overflow) {
        traces.push(`${expert.label}: ${demand.tokens} direct, no overflow`);
        return;
      }

      if (policy.id === 'second-choice') {
        const fallbackExpert = data.experts.find((item) => item.id === expert.fallbackExpertId);
        const spare = spareByExpert.get(expert.fallbackExpertId) ?? 0;
        const accepted = Math.min(overflow, spare);
        const rejected = overflow - accepted;
        spareByExpert.set(expert.fallbackExpertId, spare - accepted);
        fallbackInByExpert.set(
          expert.fallbackExpertId,
          (fallbackInByExpert.get(expert.fallbackExpertId) ?? 0) + accepted,
        );
        rerouted += accepted;
        dropped += rejected;
        droppedByExpert.set(expert.id, rejected);
        weightedRisk += accepted * demand.evidenceWeight * (1 - policy.qualityRetention);
        weightedRisk += rejected * demand.evidenceWeight;
        traces.push(
          `${expert.label}: ${direct} direct → ${accepted} to ${fallbackExpert?.label ?? 'fallback'} → ${rejected} dropped`,
        );
        return;
      }

      if (policy.id === 'shared-fallback') {
        const accepted = Math.min(overflow, sharedRemaining);
        const rejected = overflow - accepted;
        sharedRemaining -= accepted;
        sharedFallback += accepted;
        dropped += rejected;
        droppedByExpert.set(expert.id, rejected);
        weightedRisk += accepted * demand.evidenceWeight * (1 - policy.qualityRetention);
        weightedRisk += rejected * demand.evidenceWeight;
        traces.push(`${expert.label}: ${direct} direct → ${accepted} shared → ${rejected} dropped`);
        return;
      }

      dropped += overflow;
      droppedByExpert.set(expert.id, overflow);
      weightedRisk += overflow * demand.evidenceWeight;
      traces.push(`${expert.label}: ${direct} direct → ${overflow} sparse transforms skipped`);
    });

    const results: ExpertResult[] = data.experts.map((expert) => {
      const demand = scenario.demands.find((item) => item.expertId === expert.id)?.tokens ?? 0;
      const capacity = scenario.failedExpertId === expert.id ? 0 : normalCapacity;
      const direct = directByExpert.get(expert.id) ?? 0;
      return {
        ...expert,
        demand,
        capacity,
        direct,
        overflow: demand - direct,
        fallbackIn: fallbackInByExpert.get(expert.id) ?? 0,
        dropped: droppedByExpert.get(expert.id) ?? 0,
        failed: scenario.failedExpertId === expert.id,
      };
    });

    const total = scenario.demands.reduce((sum, demand) => sum + demand.tokens, 0);
    const direct = Array.from(directByExpert.values()).reduce((sum, count) => sum + count, 0);
    const processed = direct + rerouted + sharedFallback;
    const conservation = processed + dropped;
    const maxDemand = Math.max(...results.map((result) => result.demand), normalCapacity, 1);
    const overloadedExperts = results.filter((result) => result.overflow > 0).length;
    const fallbackCount = rerouted + sharedFallback;
    const costIndex = Math.round(((direct + fallbackCount * policy.costMultiplier) / Math.max(total, 1)) * 100);
    const qualityRisk = Math.min(100, Math.round((weightedRisk / Math.max(total, 1)) * 100));
    const latency = Math.round(
      scenario.baseLatencyMs +
        (overloadedExperts ? policy.latencyPenaltyMs : 0) +
        (fallbackCount / Math.max(total, 1)) * 18,
    );
    const status = dropped > 0
      ? `${dropped} assignments lose their selected sparse transform`
      : overloadedExperts > 0
        ? 'Overflow is recovered within the modeled bounds'
        : 'All assignments fit their selected experts';

    return {
      scenario,
      policy,
      normalCapacity,
      results,
      traces,
      total,
      direct,
      rerouted,
      sharedFallback,
      fallbackCount,
      dropped,
      processed,
      conservation,
      maxDemand,
      overloadedExperts,
      costIndex,
      qualityRisk,
      latency,
      status,
    };
  }, [capacityFactor, data, policyId, scenarioId]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !model) return <LabLoading />;

  const reset = () => {
    setScenarioId(data.scenarios[0].id);
    setPolicyId(data.policies[0].id);
    setCapacityFactor(data.capacityFactors[0] ?? 1);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity incident simulator"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a workload state
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((scenario) => (
                    <LabChoice
                      key={scenario.id}
                      selected={model.scenario.id === scenario.id}
                      label={scenario.label}
                      detail={scenario.brief}
                      icon={scenario.failedExpertId ? Unplug : scenario.id === 'vision-burst' ? TriangleAlert : ShieldCheck}
                      accent={scenario.failedExpertId ? 'rose' : scenario.id === 'vision-burst' ? 'amber' : 'emerald'}
                      onClick={() => setScenarioId(scenario.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Reserve expert capacity
                </legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {data.capacityFactors.map((factor) => (
                    <button
                      key={factor}
                      type="button"
                      aria-pressed={capacityFactor === factor}
                      onClick={() => setCapacityFactor(factor)}
                      className={`h-11 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        capacityFactor === factor
                          ? 'border-amber-400 bg-amber-100 text-amber-950 ring-1 ring-amber-500 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      {factor.toFixed(2).replace(/0$/, '')}x
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {model.normalCapacity} assignments per healthy routed expert.
                </p>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Choose overflow behavior
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={model.policy.id === policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'drop' ? TriangleAlert : policy.id === 'second-choice' ? GitBranch : ShieldCheck}
                      accent={policy.id === 'drop' ? 'rose' : policy.id === 'second-choice' ? 'amber' : 'emerald'}
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Assignments conserved"
              value={`${model.conservation}/${model.total}`}
              detail={`${model.processed} processed and ${model.dropped} dropped.`}
              icon={Workflow}
              tone={model.conservation === model.total ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Fallback work"
              value={model.fallbackCount.toLocaleString()}
              detail={`${model.rerouted} second-choice; ${model.sharedFallback} shared.`}
              icon={Route}
              tone={model.fallbackCount ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Modeled quality risk"
              value={`${model.qualityRisk}/100`}
              detail="Evidence-weighted impact of fallback and dropped transforms."
              icon={Gauge}
              tone={model.qualityRisk >= 20 ? 'rose' : model.qualityRisk > 0 ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="Cost / latency index"
              value={`${model.costIndex} · ${model.latency}ms`}
              detail="Relative expert work and modeled sparse-layer latency."
              icon={CircleDollarSign}
              tone={model.costIndex > 110 ? 'violet' : 'cyan'}
            />
          </div>

          <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50" aria-label="Expert capacity routes">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Demand → expert capacity → overflow</p>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Capacity factor {capacityFactor.toFixed(2).replace(/0$/, '')}x
                </span>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {model.results.map((result) => {
                const demandWidth = (result.demand / model.maxDemand) * 100;
                const capacityWidth = (result.capacity / model.maxDemand) * 100;
                const directWidth = result.demand ? (result.direct / result.demand) * 100 : 0;
                return (
                  <article
                    key={result.id}
                    className={`rounded-md border bg-white p-4 dark:bg-neutral-950 ${
                      result.failed ? 'border-rose-400 dark:border-rose-800' : expertBorders[result.tone]
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.label}</p>
                          {result.failed ? (
                            <span className="rounded-sm bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              Failed
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {result.demand} demand · {result.capacity} capacity
                        </p>
                      </div>
                      <Boxes aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400" />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          <span>Demand</span>
                          <span>{result.demand}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                          <div className={`h-full ${expertBars[result.tone]}`} style={{ width: `${demandWidth}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          <span>Capacity</span>
                          <span>{result.capacity}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                          <div className="h-full bg-neutral-500" style={{ width: `${capacityWidth}%` }} />
                        </div>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-sm bg-rose-200 dark:bg-rose-950" role="img" aria-label={`${result.label}: ${result.direct} direct and ${result.overflow} overflow assignments`}>
                        <span className="bg-emerald-500" style={{ width: `${directWidth}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-300">{result.direct} direct</span>
                      {result.overflow ? <span className="text-amber-700 dark:text-amber-300">{result.overflow} overflow</span> : null}
                      {result.fallbackIn ? <span className="text-violet-700 dark:text-violet-300">+{result.fallbackIn} fallback in</span> : null}
                      {result.dropped ? <span className="text-rose-700 dark:text-rose-300">{result.dropped} dropped</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Overflow trace</p>
              <ol className="mt-3 space-y-2">
                {model.traces.map((trace, index) => (
                  <li key={trace} className="grid grid-cols-[24px_1fr] items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-5">{trace}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Selected routed demand</p>
              <p className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{model.total} assignments</p>
            </div>
            <div className="flex items-center justify-center text-neutral-400">
              <ArrowRight aria-hidden="true" className="hidden h-5 w-5 md:block" />
              <ArrowDown aria-hidden="true" className="h-5 w-5 md:hidden" />
            </div>
            <div className={`rounded-md border p-4 ${model.dropped ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Observed consequence</p>
              <p className="mt-1 text-sm font-semibold" aria-live="polite">{model.status}</p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
            <Timer aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            <p className="text-sm leading-6">
              These values are a transparent planning model. Replace capacity, latency, fallback cost, and quality-retention assumptions with traces and evaluations from the actual checkpoint and runtime.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[720px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading expert capacity and failure lab"
    />
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Expert capacity and failure lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
