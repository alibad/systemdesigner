'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Braces,
  CircleAlert,
  CircleCheck,
  FileCheck2,
  Gauge,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
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

type Risk = 'medium' | 'high';

type PromptTask = {
  id: string;
  label: string;
  detail: string;
  risk: Risk;
  instruction: string;
  audience: string;
  constraints: string[];
  baseTokens: number;
  exampleCoverage: number;
  maxExampleCoverage: number;
  exampleTokens: number;
  example: string;
  noExampleRisk: string;
};

type ContextOption = {
  id: string;
  label: string;
  detail: string;
  coverage: number;
  tokens: number;
  trusted: boolean;
  snippet: string;
  risk: string;
};

type OutputContract = {
  id: string;
  label: string;
  detail: string;
  coverage: number;
  tokens: number;
  format: string;
  validator: string;
  risk: string;
};

type PromptContractData = {
  title: string;
  description: string;
  defaults: {
    taskId: string;
    contextId: string;
    outputId: string;
    exampleCount: number;
  };
  tasks: PromptTask[];
  contextOptions: ContextOption[];
  outputContracts: OutputContract[];
};

const BLOCK_ID = 'genai/prompt-engineering-contract-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPromptContractData(value: unknown): value is PromptContractData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PromptContractData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.taskId
      && candidate.defaults.contextId
      && candidate.defaults.outputId
      && isFiniteNumber(candidate.defaults.exampleCount)
      && Array.isArray(candidate.tasks)
      && candidate.tasks.length > 0
      && candidate.tasks.every((task) => (
        task.id
          && task.label
          && task.instruction
          && Array.isArray(task.constraints)
          && task.constraints.length > 0
          && isFiniteNumber(task.baseTokens)
          && isFiniteNumber(task.exampleCoverage)
      ))
      && Array.isArray(candidate.contextOptions)
      && candidate.contextOptions.length > 0
      && candidate.contextOptions.every((context) => (
        context.id && context.label && isFiniteNumber(context.coverage) && isFiniteNumber(context.tokens)
      ))
      && Array.isArray(candidate.outputContracts)
      && candidate.outputContracts.length > 0
      && candidate.outputContracts.every((contract) => (
        contract.id && contract.label && isFiniteNumber(contract.coverage) && isFiniteNumber(contract.tokens)
      )),
  );
}

export default function PromptEngineeringContractLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PromptContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No prompt-contract scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isPromptContractData(payload)) throw new Error('Prompt-contract data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load prompt-contract data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? <LoadError detail={error} /> : data ? <ContractWorkbench data={data} /> : <LoadState />}
    </div>
  );
}

function ContractWorkbench({ data }: { data: PromptContractData }) {
  const initialTask = data.tasks.find((item) => item.id === data.defaults.taskId) ?? data.tasks[0];
  const initialContext = data.contextOptions.find((item) => item.id === data.defaults.contextId)
    ?? data.contextOptions[0];
  const initialOutput = data.outputContracts.find((item) => item.id === data.defaults.outputId)
    ?? data.outputContracts[0];
  const [taskId, setTaskId] = useState(initialTask.id);
  const [contextId, setContextId] = useState(initialContext.id);
  const [outputId, setOutputId] = useState(initialOutput.id);
  const [exampleCount, setExampleCount] = useState(data.defaults.exampleCount);

  const task = data.tasks.find((item) => item.id === taskId) ?? data.tasks[0];
  const context = data.contextOptions.find((item) => item.id === contextId) ?? data.contextOptions[0];
  const output = data.outputContracts.find((item) => item.id === outputId) ?? data.outputContracts[0];

  const model = useMemo(() => {
    const exampleCoverage = Math.min(
      task.maxExampleCoverage,
      exampleCount * task.exampleCoverage,
    );
    const coverage = Math.min(100, 30 + context.coverage + output.coverage + exampleCoverage);
    const tokens = task.baseTokens + context.tokens + output.tokens + exampleCount * task.exampleTokens;

    let risk = 'The contract exposes the main requirements. Validate the generated values before use.';
    let riskTone: 'emerald' | 'amber' | 'rose' = coverage >= 90 ? 'emerald' : 'amber';
    if (context.coverage === 0) {
      risk = context.risk;
      riskTone = 'rose';
    } else if (output.coverage < 10) {
      risk = output.risk;
      riskTone = 'rose';
    } else if (exampleCount === 0 && task.exampleCoverage >= 7) {
      risk = task.noExampleRisk;
      riskTone = 'amber';
    } else if (!context.trusted) {
      risk = context.risk;
      riskTone = 'amber';
    } else if (coverage < 90) {
      risk = output.risk;
      riskTone = 'amber';
    }

    return { coverage, exampleCoverage, risk, riskTone, tokens };
  }, [context, exampleCount, output, task]);

  const reset = () => {
    setTaskId(initialTask.id);
    setContextId(initialContext.id);
    setOutputId(initialOutput.id);
    setExampleCount(data.defaults.exampleCount);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt contract workbench"
        title={data.title}
        description={data.description}
        icon={Layers3}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Product task
              </legend>
              <div className="mt-3 grid gap-2">
                {data.tasks.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === task.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.risk === 'high' ? ShieldAlert : Target}
                    accent={item.risk === 'high' ? 'rose' : 'blue'}
                    onClick={() => setTaskId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Evidence package
              </legend>
              <div className="mt-3 grid gap-2">
                {data.contextOptions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === context.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.trusted ? BookOpenCheck : item.coverage > 0 ? MessageSquareText : CircleAlert}
                    accent={item.trusted ? 'emerald' : item.coverage > 0 ? 'amber' : 'rose'}
                    onClick={() => setContextId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Output contract
              </legend>
              <div className="mt-3 grid gap-2">
                {data.outputContracts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === output.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.coverage >= 25 ? Braces : item.coverage >= 15 ? FileCheck2 : MessageSquareText}
                    accent={item.coverage >= 25 ? 'violet' : item.coverage >= 15 ? 'blue' : 'amber'}
                    onClick={() => setOutputId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="4. Few-shot examples"
              value={exampleCount}
              output={`${exampleCount}`}
              min={0}
              max={3}
              step={1}
              accent="violet"
              lowLabel="No examples"
              highLabel="Three examples"
              onChange={setExampleCount}
            />
          </div>
        )}
      >
        <div className="min-w-0 space-y-6" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Requirement coverage"
              value={`${model.coverage}%`}
              detail="Modeled visibility of the task contract, not model accuracy."
              icon={Gauge}
              tone={model.coverage >= 90 ? 'emerald' : model.coverage >= 70 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Estimated input"
              value={`${model.tokens} tokens`}
              detail="Longer examples and evidence consume request budget."
              icon={Sparkles}
              tone="violet"
            />
            <LabMetric
              label="External validator"
              value={output.validator}
              detail="Generation does not validate itself."
              icon={FileCheck2}
              tone={output.coverage >= 25 ? 'blue' : 'amber'}
            />
          </div>

          <section aria-labelledby="prompt-packet-title">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Assembled request
            </p>
            <h4 id="prompt-packet-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
              Prompt packet for {task.audience}
            </h4>
            <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 bg-neutral-950 text-neutral-100 dark:border-neutral-700">
              <PromptLayer
                label="Trusted instruction"
                value={task.instruction}
                accent="border-blue-500 text-blue-300"
              />
              <PromptLayer
                label="Evidence boundary"
                value={context.snippet}
                accent={context.trusted ? 'border-emerald-500 text-emerald-300' : 'border-amber-500 text-amber-300'}
              />
              <div className="border-b border-neutral-800 px-4 py-4 sm:px-5">
                <p className="border-l-2 border-amber-500 pl-3 text-xs font-semibold uppercase text-amber-300">
                  Constraints
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-300">
                  {task.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                </ul>
              </div>
              <PromptLayer
                label={`Examples (${exampleCount})`}
                value={exampleCount > 0 ? task.example : 'No boundary example is included.'}
                accent="border-violet-500 text-violet-300"
              />
              <PromptLayer
                label="Output contract"
                value={output.format}
                accent="border-cyan-500 text-cyan-300"
                last
              />
            </div>
          </section>

          <section aria-labelledby="coverage-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Visible requirements
                </p>
                <h4 id="coverage-title" className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  Coverage changes with each contract layer
                </h4>
              </div>
              <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {model.coverage} / 100
              </span>
            </div>
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
              role="img"
              aria-label={`Modeled prompt-contract coverage is ${model.coverage} percent`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                  model.coverage >= 90 ? 'bg-emerald-500' : model.coverage >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${model.coverage}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-neutral-600 sm:grid-cols-3 dark:text-neutral-300">
              <span>Evidence: +{context.coverage}</span>
              <span>Output: +{output.coverage}</span>
              <span>Examples: +{model.exampleCoverage}</span>
            </div>
          </section>

          <div className={`rounded-md border p-4 ${riskPanel(model.riskTone)}`}>
            <div className="flex items-start gap-3">
              {model.riskTone === 'emerald' ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {model.riskTone === 'emerald' ? 'Contract is ready for evaluation' : 'Likely failure to test'}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-85">{model.risk}</p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function PromptLayer({
  accent,
  label,
  last = false,
  value,
}: {
  accent: string;
  label: string;
  last?: boolean;
  value: string;
}) {
  return (
    <div className={`${last ? '' : 'border-b border-neutral-800'} px-4 py-4 sm:px-5`}>
      <p className={`border-l-2 pl-3 text-xs font-semibold uppercase ${accent}`}>{label}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-300">{value}</p>
    </div>
  );
}

function riskPanel(tone: 'emerald' | 'amber' | 'rose') {
  if (tone === 'emerald') {
    return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50';
  }
  if (tone === 'rose') {
    return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50';
  }
  return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50';
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt contract workbench"
        title="Loading prompt scenarios"
        description="Preparing the contract layers and consequence model."
        icon={LoaderCircle}
        accent="violet"
      />
      <LearningLabBody>
        <div className="flex min-h-40 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading scenarios
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Prompt contract workbench"
        title="Prompt scenarios are unavailable"
        description="The lab could not load its lesson-owned data."
        icon={CircleAlert}
        accent="rose"
      />
      <LearningLabBody>
        <p className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50">
          {detail}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
