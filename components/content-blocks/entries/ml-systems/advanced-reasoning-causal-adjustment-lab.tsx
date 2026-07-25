'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Link2,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Node = { id: string; label: string; role: string; detail: string };
type Edge = { from: string; to: string; label: string };
type AdjustmentPolicy = {
  id: string;
  label: string;
  detail: string;
  estimateOffset: number;
  status: string;
  explanation: string;
};
type MeasurementPolicy = {
  id: string;
  label: string;
  detail: string;
  attenuation: number;
};
type LabData = {
  title: string;
  description: string;
  defaults: { policyId: string; measurementId: string };
  trueEffect: number;
  nodes: Node[];
  edges: Edge[];
  policies: AdjustmentPolicy[];
  measurementPolicies: MeasurementPolicy[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.trueEffect === 'number' &&
      data.defaults &&
      Array.isArray(data.nodes) && data.nodes.length > 0 &&
      Array.isArray(data.edges) &&
      Array.isArray(data.policies) && data.policies.length > 0 &&
      Array.isArray(data.measurementPolicies) && data.measurementPolicies.length > 0,
  );
}

export default function AdvancedReasoningCausalAdjustmentLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No causal-adjustment model was supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Causal-adjustment data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load lab data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError message={error} />;
  if (!data) return <LoadState />;
  return <AdjustmentLab data={data} />;
}

function AdjustmentLab({ data }: { data: LabData }) {
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [measurementId, setMeasurementId] = useState(data.defaults.measurementId);

  const result = useMemo(() => {
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const measurement = data.measurementPolicies.find((item) => item.id === measurementId) ?? data.measurementPolicies[0];
    const residualConfounding = policy.id === 'confounder' ? 9 * (1 - measurement.attenuation) : 0;
    const bias = policy.estimateOffset + residualConfounding;
    const estimate = data.trueEffect + bias;
    const identified = Math.abs(bias) <= 1;
    const adjustmentNode = policy.id === 'confounder' ? 'maturity' : policy.id === 'mediator' ? 'engagement' : policy.id === 'collider' ? 'support' : null;
    const status = identified
      ? 'Backdoor path blocked'
      : policy.id === 'confounder'
        ? 'Residual confounding remains'
        : policy.status;
    const explanation = policy.id === 'confounder' && !identified
      ? `${measurement.label} leaves ${Math.round((1 - measurement.attenuation) * 100)}% of the confounding signal unresolved.`
      : policy.explanation;
    return { policy, measurement, bias, estimate, identified, adjustmentNode, status, explanation };
  }, [data, measurementId, policyId]);

  function reset() {
    setPolicyId(data.defaults.policyId);
    setMeasurementId(data.defaults.measurementId);
  }

  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const paths = [
    { id: 'backdoor', label: 'Backdoor path', nodes: ['policy', 'maturity', 'retention'], blocked: result.policy.id === 'confounder', warning: result.policy.id !== 'confounder' },
    { id: 'mechanism', label: 'Causal mechanism', nodes: ['policy', 'engagement', 'retention'], blocked: result.policy.id === 'mediator', warning: result.policy.id === 'mediator' },
    { id: 'collider', label: 'Collider path', nodes: ['policy', 'support', 'maturity'], blocked: result.policy.id !== 'collider', warning: result.policy.id === 'collider' },
  ];

  return (
    <div data-content-block="ml-systems/advanced-reasoning-causal-adjustment-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Causal identification lab"
          title={data.title}
          description={data.description}
          icon={GitBranch}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose an adjustment set</legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice key={policy.id} selected={policy.id === result.policy.id} label={policy.label} detail={policy.detail} icon={policy.id === 'none' ? Ban : Link2} accent={policy.id === 'confounder' ? 'emerald' : policy.id === 'none' ? 'amber' : 'rose'} onClick={() => setPolicyId(policy.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Check confounder measurement</legend>
                <div className="mt-3 space-y-2">
                  {data.measurementPolicies.map((measurement) => (
                    <LabChoice key={measurement.id} selected={measurement.id === result.measurement.id} label={measurement.label} detail={measurement.detail} icon={Scale} accent="blue" onClick={() => setMeasurementId(measurement.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Identification verdict</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{result.status}</h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${result.identified ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'}`}>
                {result.identified ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                {result.identified ? 'Total effect identified' : 'Biased estimate'}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <LabMetric label="Estimated lift" value={`${result.estimate.toFixed(1)} pp`} detail={`Target estimand: ${data.trueEffect.toFixed(1)} pp`} icon={Target} tone={result.identified ? 'emerald' : 'rose'} />
              <LabMetric label="Absolute bias" value={`${Math.abs(result.bias).toFixed(1)} pp`} detail="Difference from the modeled total effect" icon={Scale} tone={Math.abs(result.bias) <= 1 ? 'emerald' : 'amber'} />
              <LabMetric label="Confounder captured" value={`${Math.round(result.measurement.attenuation * 100)}%`} detail={result.measurement.label} icon={ShieldCheck} tone="blue" />
            </div>

            <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Observable causal paths</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">A blocked path is useful only when it is a backdoor path.</p>
                </div>
                <CircleDot className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
              </div>
              <div className="mt-4 space-y-3">
                {paths.map((path) => (
                  <div key={path.id} className={`rounded-md border p-3 ${path.warning ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : path.blocked ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{path.label}</p>
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{path.blocked ? 'Blocked' : 'Open'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {path.nodes.map((nodeId, index) => {
                        const node = nodeById.get(nodeId);
                        const adjusted = nodeId === result.adjustmentNode;
                        return (
                          <div key={nodeId} className="contents">
                            <div className={`rounded-md border px-3 py-2 ${adjusted ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-400 dark:border-violet-700 dark:bg-violet-950/40' : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'}`}>
                              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{node?.label}</p>
                              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{node?.role}{adjusted ? ' · adjusted' : ''}</p>
                            </div>
                            {index < path.nodes.length - 1 ? <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" /> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-6 rounded-md border p-4 ${result.identified ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
              <p className="font-semibold text-neutral-950 dark:text-white">{result.policy.label}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState() {
  return <div className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading causal adjustment lab" />;
}

function LoadError({ message }: { message: string }) {
  return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{message}</p>;
}
