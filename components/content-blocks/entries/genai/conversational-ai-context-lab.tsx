'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  Clock3,
  Coins,
  Database,
  Gauge,
  Layers3,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Workload {
  id: string;
  label: string;
  detail: string;
  systemTokens: number;
  turnTokens: number;
  chunkTokens: number;
  inputDollarsPerMillion: number;
  outputDollarsPerMillion: number;
}

interface ContextData {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    memoryPolicy: MemoryPolicy;
    contextWindow: number;
    turns: number;
    chunks: number;
    requestedOutput: number;
  };
  workloads: Workload[];
}

type MemoryPolicy = 'recent' | 'summary' | 'retrieval';

const BLOCK_ID = 'genai/conversational-ai-context-lab';
const memoryPolicies: Array<{ id: MemoryPolicy; label: string; detail: string }> = [
  {
    id: 'recent',
    label: 'Recent-turn window',
    detail: 'Keep the newest turns verbatim and drop older dialogue at a declared boundary.',
  },
  {
    id: 'summary',
    label: 'Summary plus recent turns',
    detail: 'Compress older dialogue, preserve the latest turns, and version the summary source.',
  },
  {
    id: 'retrieval',
    label: 'Retrieve approved memories',
    detail: 'Select a few permission-scoped facts instead of replaying the whole conversation.',
  },
];

function isContextData(value: unknown): value is ContextData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContextData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.defaults &&
      Array.isArray(candidate.workloads) &&
      candidate.workloads.length > 0,
  );
}

export default function ConversationalAiContextLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ContextData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No context scenarios were supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isContextData(payload)) throw new Error('Context scenario data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load context scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Context lab unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading context lab" detail="Preparing turn budgets..." />;
  return <ContextLab data={data} />;
}

function ContextLab({ data }: { data: ContextData }) {
  const [workloadId, setWorkloadId] = useState(data.defaults.workloadId);
  const [memoryPolicy, setMemoryPolicy] = useState<MemoryPolicy>(data.defaults.memoryPolicy);
  const [contextWindow, setContextWindow] = useState(data.defaults.contextWindow);
  const [turns, setTurns] = useState(data.defaults.turns);
  const [chunks, setChunks] = useState(data.defaults.chunks);
  const [requestedOutput, setRequestedOutput] = useState(data.defaults.requestedOutput);
  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];

  const result = useMemo(() => {
    const verbatimTurns = memoryPolicy === 'recent' ? Math.min(turns, 12) : memoryPolicy === 'summary' ? Math.min(turns, 4) : Math.min(turns, 2);
    const verbatimTokens = verbatimTurns * workload.turnTokens * 2;
    const summaryTokens = memoryPolicy === 'summary' && turns > 4 ? 480 + (turns - 4) * 12 : 0;
    const recalledTokens = memoryPolicy === 'retrieval' ? Math.min(turns, 8) * 70 : 0;
    const historyTokens = verbatimTokens + summaryTokens + recalledTokens;
    const retrievalTokens = chunks * workload.chunkTokens;
    const promptTokens = workload.systemTokens + historyTokens + retrievalTokens;
    const availableOutput = Math.max(0, contextWindow - promptTokens);
    const deliveredOutput = Math.min(requestedOutput, availableOutput);
    const utilization = Math.min(100, (promptTokens + requestedOutput) / contextWindow * 100);
    const turnCost = promptTokens / 1_000_000 * workload.inputDollarsPerMillion + deliveredOutput / 1_000_000 * workload.outputDollarsPerMillion;
    const clipped = deliveredOutput < requestedOutput;
    const staleWindow = memoryPolicy === 'recent' && turns > 12;
    const pressured = clipped || utilization > 90;
    return {
      availableOutput,
      clipped,
      deliveredOutput,
      historyTokens,
      pressured,
      promptTokens,
      retrievalTokens,
      staleWindow,
      turnCost,
      utilization,
      verbatimTurns,
    };
  }, [chunks, contextWindow, memoryPolicy, requestedOutput, turns, workload]);

  const reset = () => {
    setWorkloadId(data.defaults.workloadId);
    setMemoryPolicy(data.defaults.memoryPolicy);
    setContextWindow(data.defaults.contextWindow);
    setTurns(data.defaults.turns);
    setChunks(data.defaults.chunks);
    setRequestedOutput(data.defaults.requestedOutput);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Conversation context lab"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload</legend>
                <div className="mt-3 grid gap-2">
                  {data.workloads.map((item) => (
                    <LabChoice key={item.id} selected={item.id === workload.id} label={item.label} detail={item.detail} icon={Bot} accent="cyan" onClick={() => setWorkloadId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Memory contract</legend>
                <div className="mt-3 grid gap-2">
                  {memoryPolicies.map((item) => (
                    <LabChoice key={item.id} selected={item.id === memoryPolicy} label={item.label} detail={item.detail} icon={Database} accent="violet" onClick={() => setMemoryPolicy(item.id)} />
                  ))}
                </div>
              </fieldset>
              <LabRange label="Context window" value={contextWindow} output={`${Math.round(contextWindow / 1000)}K tokens`} min={8_000} max={128_000} step={8_000} accent="blue" lowLabel="Tight envelope" highLabel="More prompt capacity" onChange={setContextWindow} />
              <LabRange label="Conversation turns" value={turns} output={`${turns} turns`} min={1} max={80} step={1} accent="violet" lowLabel="New session" highLabel="Long-running thread" onChange={setTurns} />
              <LabRange label="Retrieved evidence" value={chunks} output={`${chunks} chunks`} min={0} max={20} step={1} accent="cyan" lowLabel="No evidence" highLabel="More context" onChange={setChunks} />
              <LabRange label="Requested output" value={requestedOutput} output={`${requestedOutput.toLocaleString()} tokens`} min={256} max={8_192} step={256} accent="amber" lowLabel="Concise" highLabel="Long response" onChange={setRequestedOutput} />
            </div>
          }
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.pressured ? warningClass : healthyClass}`}>
              <div className="flex items-start gap-3">
                {result.pressured ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Turn verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.clipped ? 'The response cannot fit the declared context envelope' : result.pressured ? 'The turn has too little recovery headroom' : 'The turn fits with explicit output headroom'}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.clipped
                      ? `Only ${result.deliveredOutput.toLocaleString()} of ${requestedOutput.toLocaleString()} requested output tokens remain after prompt assembly.`
                      : result.staleWindow
                        ? `The recent-turn policy keeps ${result.verbatimTurns} turns and drops older dialogue. The assistant must not pretend the discarded context is still present.`
                        : 'Memory, retrieved evidence, and generation each consume a visible share of one bounded request.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Prompt tokens" value={result.promptTokens.toLocaleString()} detail={`${result.utilization.toFixed(0)}% including requested output`} icon={Layers3} tone={result.pressured ? 'rose' : 'blue'} />
              <LabMetric label="History" value={result.historyTokens.toLocaleString()} detail={`${result.verbatimTurns} verbatim turns plus memory state`} icon={Database} tone="violet" />
              <LabMetric label="Output headroom" value={result.availableOutput.toLocaleString()} detail={`${result.deliveredOutput.toLocaleString()} tokens can be delivered`} icon={Gauge} tone={result.clipped ? 'rose' : 'emerald'} />
              <LabMetric label="Modeled turn cost" value={`$${result.turnCost.toFixed(4)}`} detail="Input plus delivered output" icon={Coins} tone="amber" />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Context composition</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Every source competes for the same window</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{contextWindow.toLocaleString()} token ceiling</p>
              </div>
              <div className="mt-5 space-y-3">
                <BudgetBar label="Instructions" value={workload.systemTokens} total={contextWindow} tone="bg-blue-500" />
                <BudgetBar label="Conversation memory" value={result.historyTokens} total={contextWindow} tone="bg-violet-500" />
                <BudgetBar label="Retrieved evidence" value={result.retrievalTokens} total={contextWindow} tone="bg-cyan-500" />
                <BudgetBar label="Requested output" value={requestedOutput} total={contextWindow} tone="bg-amber-500" />
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-3">
              <EvidenceCard title="Declare" detail="Set per-turn input, output, latency, tool, and cost budgets before calling a model." />
              <EvidenceCard title="Assemble" detail="Keep provenance and tenant scope on every memory and retrieval item admitted to the prompt." />
              <EvidenceCard title="Observe" detail="Record selected context, truncation, time to first token, cancellations, tool outcomes, and final policy state." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BudgetBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const percentage = Math.max(1, Math.min(100, value / total * 100));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-neutral-700 dark:text-neutral-200">{label}</span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{value.toLocaleString()} tokens</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function EvidenceCard({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>;
}

function LabState({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabBody><div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"><Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p></div></div></LearningLabBody></LearningLab></div>;
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
