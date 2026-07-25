'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Eye,
  FileText,
  Gauge,
  GitBranch,
  Layers3,
  Network,
  Route,
  Scale,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ModalityId = 'text' | 'vision' | 'joint';

type Expert = {
  id: string;
  label: string;
  role: string;
  tone: 'slate' | 'blue' | 'cyan' | 'amber' | 'violet';
};

type RoutingPolicy = {
  id: 'top-1' | 'shared-plus-routed' | 'modality-aware';
  label: string;
  detail: string;
  consequence: string;
};

type TokenGroup = {
  id: string;
  label: string;
  modality: ModalityId;
  count: number;
  primaryExpertId: string;
  secondaryExpertId: string;
};

type Workload = {
  id: string;
  label: string;
  brief: string;
  groups: TokenGroup[];
};

type RoutingModel = {
  title: string;
  description: string;
  experts: Expert[];
  policies: RoutingPolicy[];
  workloads: Workload[];
};

type Assignment = {
  groupId: string;
  expertId: string;
  modality: ModalityId;
  count: number;
};

const BLOCK_ID = 'genai/multimodal-moe-systems-token-routing-lab';

const modalityStyles: Record<ModalityId, { chip: string; bar: string; label: string }> = {
  text: {
    chip: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100',
    bar: 'bg-blue-500',
    label: 'Text',
  },
  vision: {
    chip: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100',
    bar: 'bg-cyan-500',
    label: 'Vision',
  },
  joint: {
    chip: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100',
    bar: 'bg-violet-500',
    label: 'Joint',
  },
};

const expertBorders: Record<Expert['tone'], string> = {
  slate: 'border-neutral-300 dark:border-neutral-700',
  blue: 'border-blue-300 dark:border-blue-800',
  cyan: 'border-cyan-300 dark:border-cyan-800',
  amber: 'border-amber-300 dark:border-amber-800',
  violet: 'border-violet-300 dark:border-violet-800',
};

function buildAssignments(workload: Workload, policyId: RoutingPolicy['id']): Assignment[] {
  return workload.groups.flatMap((group) => {
    if (policyId === 'shared-plus-routed') {
      return [
        { groupId: group.id, expertId: 'shared', modality: group.modality, count: group.count },
        {
          groupId: group.id,
          expertId: group.primaryExpertId,
          modality: group.modality,
          count: group.count,
        },
      ];
    }

    if (policyId === 'modality-aware') {
      const primaryCount = Math.round(group.count * 0.75);
      return [
        {
          groupId: group.id,
          expertId: group.primaryExpertId,
          modality: group.modality,
          count: primaryCount,
        },
        {
          groupId: group.id,
          expertId: group.secondaryExpertId,
          modality: group.modality,
          count: group.count - primaryCount,
        },
      ].filter((assignment) => assignment.count > 0);
    }

    return [
      {
        groupId: group.id,
        expertId: group.primaryExpertId,
        modality: group.modality,
        count: group.count,
      },
    ];
  });
}

function balanceScore(loads: number[]) {
  const active = loads.filter((load) => load > 0);
  const total = active.reduce((sum, load) => sum + load, 0);
  if (active.length <= 1 || total === 0) return 0;
  const entropy = -active.reduce((sum, load) => {
    const share = load / total;
    return sum + share * Math.log(share);
  }, 0);
  return Math.round((entropy / Math.log(active.length)) * 100);
}

export default function MultimodalMoeSystemsTokenRoutingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RoutingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workloadId, setWorkloadId] = useState('');
  const [policyId, setPolicyId] = useState<RoutingPolicy['id']>('top-1');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No token-routing model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<RoutingModel>;
      })
      .then((model) => {
        if (!model.workloads?.length || !model.policies?.length || !model.experts?.length) {
          throw new Error('The token-routing model is incomplete.');
        }
        setData(model);
        setWorkloadId(model.workloads[0].id);
        setPolicyId(model.policies[0].id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load token-routing data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const assignments = buildAssignments(workload, policy.id);
    const totalTokens = workload.groups.reduce((sum, group) => sum + group.count, 0);
    const totalAssignments = assignments.reduce((sum, assignment) => sum + assignment.count, 0);
    const loads = data.experts.map((expert) => {
      const expertAssignments = assignments.filter((assignment) => assignment.expertId === expert.id);
      const byModality = expertAssignments.reduce<Record<ModalityId, number>>(
        (totals, assignment) => ({
          ...totals,
          [assignment.modality]: totals[assignment.modality] + assignment.count,
        }),
        { text: 0, vision: 0, joint: 0 },
      );
      return {
        ...expert,
        total: expertAssignments.reduce((sum, assignment) => sum + assignment.count, 0),
        byModality,
      };
    });
    const routedLoads = loads.filter((expert) => expert.id !== 'shared');
    const busiest = routedLoads.reduce(
      (current, expert) => (expert.total > current.total ? expert : current),
      routedLoads[0],
    );
    const routedTotal = routedLoads.reduce((sum, expert) => sum + expert.total, 0);
    const maxLoad = Math.max(...loads.map((expert) => expert.total), 1);
    const balance = balanceScore(routedLoads.map((expert) => expert.total));
    const onlyText = workload.groups.every((group) => group.modality === 'text');
    const busiestShare = routedTotal ? Math.round((busiest.total / routedTotal) * 100) : 0;
    const routeStatus = onlyText
      ? 'Expected text concentration'
      : busiestShare >= 55
        ? 'Hot routed expert'
        : 'Distributed route';

    return {
      workload,
      policy,
      assignments,
      totalTokens,
      totalAssignments,
      dispatchFactor: totalAssignments / totalTokens,
      loads,
      busiest,
      busiestShare,
      balance,
      maxLoad,
      routeStatus,
      onlyText,
    };
  }, [data, workloadId, policyId]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !model) return <LabLoading />;

  const reset = () => {
    setWorkloadId(data.workloads[0].id);
    setPolicyId(data.policies[0].id);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Token routing workbench"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a workload
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((workload) => (
                    <LabChoice
                      key={workload.id}
                      selected={model.workload.id === workload.id}
                      label={workload.label}
                      detail={workload.brief}
                      icon={workload.groups.some((group) => group.modality === 'vision') ? Eye : FileText}
                      accent="blue"
                      onClick={() => setWorkloadId(workload.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose a routing contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={model.policy.id === policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'shared-plus-routed' ? Layers3 : policy.id === 'modality-aware' ? Scale : GitBranch}
                      accent={policy.id === 'modality-aware' ? 'emerald' : policy.id === 'shared-plus-routed' ? 'violet' : 'blue'}
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
              label="Input tokens"
              value={model.totalTokens.toLocaleString()}
              detail={`${model.workload.groups.length} semantic token groups.`}
              icon={FileText}
              tone="blue"
            />
            <LabMetric
              label="Dispatch factor"
              value={`${model.dispatchFactor.toFixed(1)}x`}
              detail={`${model.totalAssignments.toLocaleString()} expert assignments.`}
              icon={Network}
              tone={model.dispatchFactor > 1 ? 'violet' : 'cyan'}
            />
            <LabMetric
              label="Busiest routed expert"
              value={`${model.busiestShare}%`}
              detail={`${model.busiest.label}: ${model.busiest.total} assignments.`}
              icon={Gauge}
              tone={model.busiestShare >= 55 && !model.onlyText ? 'amber' : 'emerald'}
            />
            <LabMetric
              label="Routed balance"
              value={`${model.balance}/100`}
              detail={model.routeStatus}
              icon={Scale}
              tone={model.balance >= 75 ? 'emerald' : model.onlyText ? 'blue' : 'amber'}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,0.9fr)_72px_minmax(0,1.2fr)] md:items-center md:p-5">
              <section aria-label="Input token groups" className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Multimodal sequence
                </p>
                <div className="mt-3 space-y-2">
                  {model.workload.groups.map((group) => {
                    const style = modalityStyles[group.modality];
                    const destinations = model.assignments
                      .filter((assignment) => assignment.groupId === group.id)
                      .map((assignment) => data.experts.find((expert) => expert.id === assignment.expertId)?.label)
                      .filter(Boolean);
                    return (
                      <div key={group.id} className={`rounded-md border p-3 ${style.chip}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">{group.label}</span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">{group.count} tokens</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1" aria-hidden="true">
                          {Array.from({ length: Math.min(8, Math.max(3, Math.ceil(group.count / 8))) }).map((_, index) => (
                            <span key={index} className={`h-2.5 w-2.5 rounded-sm ${style.bar}`} />
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] leading-4 opacity-75">
                          {style.label} → {destinations.join(' + ')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="flex flex-col items-center justify-center text-center text-violet-700 dark:text-violet-300">
                <div className="rounded-full border border-violet-300 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
                  <GitBranch aria-hidden="true" className="h-6 w-6" />
                </div>
                <span className="mt-2 text-[11px] font-semibold uppercase">Router</span>
                <ArrowRight aria-hidden="true" className="mt-2 hidden h-5 w-5 md:block" />
                <ArrowDown aria-hidden="true" className="mt-2 h-5 w-5 md:hidden" />
              </div>

              <section aria-label="Expert assignment loads" className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Expert pool after dispatch
                </p>
                <div className="mt-3 space-y-2">
                  {model.loads.map((expert) => (
                    <div key={expert.id} className={`rounded-md border bg-white p-3 dark:bg-neutral-950 ${expertBorders[expert.tone]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{expert.label}</p>
                          <p className="mt-0.5 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{expert.role}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {expert.total}
                        </span>
                      </div>
                      <div
                        className="mt-3 h-3 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800"
                        role="img"
                        aria-label={`${expert.label} receives ${expert.total} assignments`}
                      >
                        <div className="flex h-full" style={{ width: `${(expert.total / model.maxLoad) * 100}%` }}>
                          {(Object.keys(modalityStyles) as ModalityId[]).map((modality) => {
                            const count = expert.byModality[modality];
                            if (!count || !expert.total) return null;
                            return (
                              <span
                                key={modality}
                                className={modalityStyles[modality].bar}
                                style={{ width: `${(count / expert.total) * 100}%` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div
            className="mt-5 rounded-md border border-violet-200 bg-violet-50 p-4 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <BrainCircuit aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{model.routeStatus}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{model.policy.consequence}</p>
              </div>
            </div>
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
      className="min-h-[640px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading multimodal token routing lab"
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
      <p className="font-semibold">Multimodal token routing lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
