'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  LoaderCircle,
  Route,
  ShieldCheck,
  UserCheck,
  Users,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Capability =
  | 'specialist-collaboration'
  | 'deterministic-routing'
  | 'typed-state'
  | 'durable-resume'
  | 'human-release';

type Mode = {
  id: string;
  label: string;
  detail: string;
  capabilities: Capability[];
  baseModelCalls: number;
  path: string[];
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  requirements: Capability[];
  recommendedModeId: string;
  failure: string;
};

type OrchestrationData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    modeId: string;
    durableState: boolean;
    humanGate: boolean;
  };
  modes: Mode[];
  workloads: Workload[];
};

const BLOCK_ID = 'technology/crewai-orchestration-boundary-lab';

const capabilityIds: Capability[] = [
  'specialist-collaboration',
  'deterministic-routing',
  'typed-state',
  'durable-resume',
  'human-release',
];

const capabilityLabels: Record<Capability, string> = {
  'specialist-collaboration': 'Specialist collaboration',
  'deterministic-routing': 'Deterministic routing',
  'typed-state': 'Typed run state',
  'durable-resume': 'Durable resume',
  'human-release': 'Human release gate',
};

const workloadIcons: Record<string, LucideIcon> = {
  'exploratory-brief': Users,
  'webhook-triage': GitBranch,
  'regulated-recommendation': ShieldCheck,
  'long-running-enrichment': Database,
};

const modeIcons: Record<string, LucideIcon> = {
  crew: Users,
  flow: Route,
  hybrid: Workflow,
};

function isCapability(value: unknown): value is Capability {
  return capabilityIds.includes(value as Capability);
}

function isOrchestrationData(value: unknown): value is OrchestrationData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OrchestrationData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.modeId
      && typeof candidate.defaults.durableState === 'boolean'
      && typeof candidate.defaults.humanGate === 'boolean'
      && Array.isArray(candidate.modes)
      && candidate.modes.length === 3
      && candidate.modes.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && Array.isArray(item.capabilities)
        && item.capabilities.every(isCapability)
        && Number.isInteger(item.baseModelCalls)
        && item.baseModelCalls > 0
        && Array.isArray(item.path)
        && item.path.length >= 3
        && item.path.every((step) => typeof step === 'string')
      ))
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && Array.isArray(item.requirements)
        && item.requirements.every(isCapability)
        && typeof item.recommendedModeId === 'string'
        && typeof item.failure === 'string'
      )),
  );
}

export default function CrewAIOrchestrationBoundaryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<OrchestrationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No orchestration model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isOrchestrationData(payload)) {
          throw new Error('The orchestration model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }

  return <OrchestrationComposer data={data} />;
}

function OrchestrationComposer({ data }: { data: OrchestrationData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [modeId, setModeId] = useState(data.defaults.modeId);
  const [durableState, setDurableState] = useState(data.defaults.durableState);
  const [humanGate, setHumanGate] = useState(data.defaults.humanGate);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const mode = data.modes.find((item) => item.id === modeId) ?? data.modes[0];

  const result = useMemo(() => {
    const enabled = new Set(mode.capabilities);
    if (durableState) enabled.add('durable-resume');
    if (humanGate) enabled.add('human-release');

    const missing = workload.requirements.filter((requirement) => !enabled.has(requirement));
    const extra = capabilityIds.filter(
      (capability) => enabled.has(capability) && !workload.requirements.includes(capability),
    );
    const recommended = mode.id === workload.recommendedModeId;
    const accepted = missing.length === 0;
    const status = !accepted
      ? 'Contract gap'
      : recommended && extra.length === 0
        ? 'Right-sized'
        : 'Fits with overhead';
    const tone = !accepted ? 'rose' : recommended && extra.length === 0 ? 'emerald' : 'amber';
    const path = [...mode.path];
    if (durableState) path.splice(Math.max(1, path.length - 1), 0, 'Durable state');
    if (humanGate) path.splice(Math.max(1, path.length - 1), 0, 'Human gate');
    const verdict = !accepted
      ? `${workload.failure} Add ${missing.map((item) => capabilityLabels[item].toLowerCase()).join(' and ')} or choose a different execution shape.`
      : !recommended
        ? `${mode.label} can satisfy the contract, but ${data.modes.find((item) => item.id === workload.recommendedModeId)?.label ?? 'the recommended shape'} exposes a smaller core execution surface.`
        : extra.length > 0
          ? `The core shape fits, but ${extra.map((item) => capabilityLabels[item].toLowerCase()).join(' and ')} are not required by this workload. Remove them unless another explicit contract depends on them.`
          : 'The selected shape exposes every required capability without adding an unused state or release boundary.';

    return {
      accepted,
      enabled,
      extra,
      missing,
      path,
      recommended,
      status,
      tone,
      verdict,
    } as const;
  }, [data.modes, durableState, humanGate, mode, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setModeId(data.defaults.modeId);
    setDurableState(data.defaults.durableState);
    setHumanGate(data.defaults.humanGate);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Orchestration boundary lab"
          title={data.title}
          description={data.description}
          icon={Workflow}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Workload contract
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={workloadIcons[item.id] ?? Bot}
                      accent="blue"
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Execution shape
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.modes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mode.id}
                      label={item.label}
                      detail={item.detail}
                      icon={modeIcons[item.id] ?? Route}
                      accent={item.id === 'hybrid' ? 'violet' : item.id === 'flow' ? 'emerald' : 'blue'}
                      onClick={() => setModeId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Recovery and release
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <LabChoice
                    selected={durableState}
                    label="Durable state"
                    detail={durableState ? 'Resume accepted progress after interruption.' : 'Run state ends with this worker.'}
                    icon={Database}
                    accent="emerald"
                    onClick={() => setDurableState((value) => !value)}
                  />
                  <LabChoice
                    selected={humanGate}
                    label="Human release gate"
                    detail={humanGate ? 'Pause before the final release decision.' : 'No operator checkpoint is present.'}
                    icon={UserCheck}
                    accent="amber"
                    onClick={() => setHumanGate((value) => !value)}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Architecture fit"
                value={result.status}
                detail={result.accepted ? 'The required capability set is present.' : 'At least one workload requirement is missing.'}
                icon={result.accepted ? CheckCircle2 : XCircle}
                tone={result.tone}
              />
              <LabMetric
                label="Missing boundaries"
                value={`${result.missing.length}`}
                detail={result.missing.length ? result.missing.map((item) => capabilityLabels[item]).join(', ') : 'No required capability is missing'}
                icon={ShieldCheck}
                tone={result.missing.length ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Unused boundaries"
                value={`${result.extra.length}`}
                detail={result.extra.length ? result.extra.map((item) => capabilityLabels[item]).join(', ') : 'No unnecessary boundary selected'}
                icon={GitBranch}
                tone={result.extra.length ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Base model turns"
                value={`${mode.baseModelCalls}`}
                detail="Illustrative turns for comparing control surface, not a latency promise."
                icon={Bot}
                tone={mode.baseModelCalls > 3 ? 'violet' : 'blue'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Runtime runway
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {workload.label} through {mode.label.toLowerCase()}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {result.path.length} observable stages
                </span>
              </div>

              <ol className="mt-5 grid gap-2 md:grid-flow-col md:auto-cols-fr md:grid-rows-1 md:items-stretch">
                {result.path.map((step, index) => {
                  const isCrew = step.toLowerCase().includes('crew');
                  const isControl = step.toLowerCase().includes('flow') || step.toLowerCase().includes('route');
                  const isGate = step.toLowerCase().includes('human');
                  const isState = step.toLowerCase().includes('state');
                  const Icon = isCrew ? Users : isControl ? Route : isGate ? UserCheck : isState ? Database : Workflow;
                  const style = isCrew
                    ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50'
                    : isGate
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                      : isState
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                        : 'border-blue-200 bg-white text-neutral-950 dark:border-blue-900 dark:bg-neutral-950 dark:text-white';

                  return (
                    <li key={`${step}-${index}`} className="relative min-w-0 md:flex md:items-stretch">
                      <div className={`flex min-h-20 w-full items-center gap-3 rounded-md border p-3 ${style}`}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/75 shadow-sm dark:bg-neutral-950/70">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase opacity-65">Stage {index + 1}</span>
                          <span className="mt-1 block text-sm font-semibold leading-5">{step}</span>
                        </div>
                      </div>
                      {index < result.path.length - 1 ? (
                        <>
                          <ArrowDown aria-hidden="true" className="mx-auto my-1 h-4 w-4 text-neutral-400 md:hidden" />
                          <ArrowRight aria-hidden="true" className="mx-1 hidden h-4 w-4 shrink-0 self-center text-neutral-400 md:block" />
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required capabilities
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {workload.requirements.map((capability) => {
                    const present = result.enabled.has(capability);
                    return (
                      <li key={capability} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                        {present
                          ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                        <span>{capabilityLabels[capability]}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Smallest default
                </p>
                <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                  {data.modes.find((item) => item.id === workload.recommendedModeId)?.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Add persistence and approval only when the workload requires them.
                </p>
              </section>
            </div>

            <div className={`rounded-md border p-4 ${result.accepted ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
              <div className="flex items-start gap-3">
                {result.accepted
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Architecture consequence</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.verdict}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Orchestration boundary lab"
          title="Loading the orchestration model"
          description="The lab is reading its workload and capability contracts."
          icon={Workflow}
          accent="violet"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Unable to load the lab</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                Loading orchestration boundaries
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
