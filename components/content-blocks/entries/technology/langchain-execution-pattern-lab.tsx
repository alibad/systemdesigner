'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSearch,
  GitBranch,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
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
  | 'structured-output'
  | 'retrieval'
  | 'known-actions'
  | 'dynamic-routing'
  | 'thread-state';

type Pattern = {
  id: string;
  label: string;
  detail: string;
  capabilities: Capability[];
  baseCalls: number;
  control: string;
  path: string[];
};

type Workload = {
  id: string;
  label: string;
  detail: string;
  requirements: Capability[];
  risk: string;
  recommendedPatternId: string;
};

type ExecutionPatternData = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    patternId: string;
    persistState: boolean;
    structuredOutput: boolean;
  };
  patterns: Pattern[];
  workloads: Workload[];
};

const BLOCK_ID = 'technology/langchain-execution-pattern-lab';
const capabilities: Capability[] = [
  'structured-output',
  'retrieval',
  'known-actions',
  'dynamic-routing',
  'thread-state',
];

const capabilityLabels: Record<Capability, string> = {
  'structured-output': 'Typed output contract',
  retrieval: 'Grounded retrieval step',
  'known-actions': 'Application tools',
  'dynamic-routing': 'Runtime tool choice',
  'thread-state': 'Thread-scoped state',
};

const workloadIcons: Record<string, LucideIcon> = {
  'ticket-routing': Braces,
  'policy-answer': FileSearch,
  'refund-assistant': Bot,
  'invoice-pipeline': Workflow,
};

const patternIcons: Record<string, LucideIcon> = {
  'direct-model': Sparkles,
  'deterministic-workflow': Route,
  'agent-loop': GitBranch,
};

function isCapability(value: unknown): value is Capability {
  return capabilities.includes(value as Capability);
}

function isExecutionPatternData(value: unknown): value is ExecutionPatternData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExecutionPatternData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.workloadId
      && candidate.defaults.patternId
      && typeof candidate.defaults.persistState === 'boolean'
      && typeof candidate.defaults.structuredOutput === 'boolean'
      && Array.isArray(candidate.patterns)
      && candidate.patterns.length === 3
      && candidate.patterns.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && Array.isArray(item.capabilities)
        && item.capabilities.every(isCapability)
        && Number.isFinite(item.baseCalls)
        && typeof item.control === 'string'
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
        && typeof item.risk === 'string'
        && typeof item.recommendedPatternId === 'string'
      )),
  );
}

export default function LangChainExecutionPatternLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ExecutionPatternData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No execution-pattern model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isExecutionPatternData(payload)) {
          throw new Error('The execution-pattern model is incomplete.');
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

  return <ExecutionComposer data={data} />;
}

function ExecutionComposer({ data }: { data: ExecutionPatternData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [patternId, setPatternId] = useState(data.defaults.patternId);
  const [persistState, setPersistState] = useState(data.defaults.persistState);
  const [structuredOutput, setStructuredOutput] = useState(data.defaults.structuredOutput);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const pattern = data.patterns.find((item) => item.id === patternId) ?? data.patterns[0];

  const result = useMemo(() => {
    const enabled = new Set(pattern.capabilities);
    if (!persistState) enabled.delete('thread-state');
    if (!structuredOutput) enabled.delete('structured-output');

    const missing = workload.requirements.filter((requirement) => !enabled.has(requirement));
    const recommended = pattern.id === workload.recommendedPatternId;
    const stateUnneeded = persistState && !workload.requirements.includes('thread-state');
    const schemaUnneeded = structuredOutput && !workload.requirements.includes('structured-output');
    const extraControls = Number(stateUnneeded) + Number(schemaUnneeded);
    const status = missing.length > 0
      ? 'Contract gap'
      : recommended && extraControls === 0
        ? 'Right-sized'
        : 'Works, but wider';
    const tone = missing.length > 0 ? 'rose' : recommended ? 'emerald' : 'amber';
    const estimatedCalls = pattern.baseCalls + (workload.requirements.includes('retrieval') ? 1 : 0);

    const verdict = missing.length > 0
      ? `The design cannot satisfy ${missing.map((item) => capabilityLabels[item].toLowerCase()).join(' and ')}. Add the missing boundary or choose a different execution model.`
      : !recommended
        ? `${pattern.label} can be made to work, but ${data.patterns.find((item) => item.id === workload.recommendedPatternId)?.label ?? 'the recommended pattern'} exposes a smaller control and operating surface for this workload.`
        : extraControls > 0
          ? 'The execution model fits, but it retains state or output machinery that this workload does not require. Remove unneeded state before it becomes a privacy and migration obligation.'
          : 'The execution path satisfies the workload with the smallest useful control surface. Keep each boundary observable and validate the final application contract.';

    return { enabled, estimatedCalls, extraControls, missing, recommended, status, tone, verdict } as const;
  }, [data.patterns, pattern, persistState, structuredOutput, workload]);

  function reset() {
    setWorkloadId(data.defaults.workloadId);
    setPatternId(data.defaults.patternId);
    setPersistState(data.defaults.persistState);
    setStructuredOutput(data.defaults.structuredOutput);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Execution pattern composer"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Workload contract"
                items={data.workloads}
                selectedId={workload.id}
                iconFor={(id) => workloadIcons[id] ?? Workflow}
                accent="blue"
                onSelect={setWorkloadId}
              />
              <ChoiceGroup
                label="2. Execution model"
                items={data.patterns}
                selectedId={pattern.id}
                iconFor={(id) => patternIcons[id] ?? Route}
                accent="violet"
                onSelect={setPatternId}
              />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Explicit contracts
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <LabChoice
                    selected={structuredOutput}
                    label="Typed output"
                    detail={structuredOutput ? 'Validate a schema before application use.' : 'Return free-form model content.'}
                    icon={Braces}
                    accent="emerald"
                    onClick={() => setStructuredOutput((value) => !value)}
                  />
                  <LabChoice
                    selected={persistState}
                    label="Thread persistence"
                    detail={persistState ? 'Resume state by thread ID.' : 'Keep state inside one request.'}
                    icon={Database}
                    accent="amber"
                    onClick={() => setPersistState((value) => !value)}
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
                detail={result.missing.length ? `${result.missing.length} required boundary missing` : 'All required boundaries are present'}
                icon={result.missing.length ? XCircle : CheckCircle2}
                tone={result.tone}
              />
              <LabMetric
                label="Estimated model calls"
                value={`~${result.estimatedCalls}`}
                detail="Planning estimate per successful request"
                icon={Sparkles}
                tone="cyan"
              />
              <LabMetric
                label="Control model"
                value={pattern.control}
                detail={pattern.id === 'agent-loop' ? 'Policy determines the usable boundary' : 'Application fixes the path'}
                icon={ShieldCheck}
                tone={pattern.id === 'agent-loop' ? 'amber' : 'blue'}
              />
              <LabMetric
                label="State lifetime"
                value={persistState ? 'Thread' : 'Request'}
                detail={persistState ? 'Requires a durable production checkpointer' : 'No cross-turn state retained'}
                icon={Database}
                tone={persistState ? 'violet' : 'neutral'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Executed path
              </p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                {workload.label} through {pattern.label.toLowerCase()}
              </h4>
              <ol className="mt-4 grid gap-2 md:grid-flow-col md:auto-cols-fr">
                {pattern.path.map((step, index) => (
                  <li key={step} className="relative min-w-0">
                    <div className="h-full rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                        {index + 1}
                      </span>
                      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{step}</p>
                    </div>
                    {index < pattern.path.length - 1 ? (
                      <>
                        <ArrowDown aria-hidden="true" className="mx-auto my-1 h-4 w-4 text-neutral-400 md:hidden" />
                        <ArrowRight aria-hidden="true" className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-neutral-50 p-0.5 text-neutral-400 md:block dark:bg-neutral-900" />
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Required contract
                </p>
                <ul className="mt-3 space-y-2">
                  {workload.requirements.map((requirement) => {
                    const present = result.enabled.has(requirement);
                    return (
                      <li key={requirement} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                        {present
                          ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          : <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                        <span>{capabilityLabels[requirement]}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Failure to design for
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{workload.risk}</p>
              </section>
            </div>

            <div className={`rounded-md border p-4 ${result.missing.length ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30' : result.recommended ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
              <div className="flex items-start gap-3">
                {result.missing.length
                  ? <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Design verdict</p>
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

function ChoiceGroup({
  label,
  items,
  selectedId,
  iconFor,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  iconFor: (id: string) => LucideIcon;
  accent: 'blue' | 'violet';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</legend>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <LabChoice
            key={item.id}
            selected={item.id === selectedId}
            label={item.label}
            detail={item.detail}
            icon={iconFor(item.id)}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Execution pattern composer"
          title="Loading the execution model"
          description="The lab is reading its workload and architecture contracts."
          icon={Layers3}
          accent="cyan"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Unable to load the lab</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-white">
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading execution patterns
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
