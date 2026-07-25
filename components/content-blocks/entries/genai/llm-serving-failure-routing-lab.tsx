'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleX, CloudOff, Radio, Route, ShieldAlert, Timer, TriangleAlert, Workflow } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FailureModel = {
  title: string;
  description: string;
  stages: string[];
  defaults: {
    schedulerSaturation: number;
    workersLost: number;
    cachePressure: number;
    safetyState: 'healthy' | 'unavailable';
    streamDisconnect: boolean;
    policy: 'protect' | 'limited' | 'bypass';
  };
};

type NodeState = 'active' | 'degraded' | 'failed' | 'bypassed';

type PathNode = { label: string; detail: string; state: NodeState };

const BLOCK_ID = 'genai/llm-serving-failure-routing-lab';

export default function LlmServingFailureRoutingLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No failure-routing model was supplied.');
      return;
    }
    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<FailureModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the failure-routing model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <FailureRoutingLab data={data} />;
}

function FailureRoutingLab({ data }: { data: FailureModel }) {
  const [schedulerSaturation, setSchedulerSaturation] = useState(data.defaults.schedulerSaturation);
  const [workersLost, setWorkersLost] = useState(data.defaults.workersLost);
  const [cachePressure, setCachePressure] = useState(data.defaults.cachePressure);
  const [safetyState, setSafetyState] = useState<'healthy' | 'unavailable'>(data.defaults.safetyState);
  const [streamDisconnect, setStreamDisconnect] = useState(data.defaults.streamDisconnect);
  const [policy, setPolicy] = useState<'protect' | 'limited' | 'bypass'>(data.defaults.policy);

  const result = useMemo(() => getRoute({ schedulerSaturation, workersLost, cachePressure, safetyState, streamDisconnect, policy, stages: data.stages }), [cachePressure, data.stages, policy, safetyState, schedulerSaturation, streamDisconnect, workersLost]);

  const reset = () => {
    setSchedulerSaturation(data.defaults.schedulerSaturation);
    setWorkersLost(data.defaults.workersLost);
    setCachePressure(data.defaults.cachePressure);
    setSafetyState(data.defaults.safetyState);
    setStreamDisconnect(data.defaults.streamDisconnect);
    setPolicy(data.defaults.policy);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Failure routing lab" title={data.title} description={data.description} icon={Route} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Inject serving pressure</legend>
                <div className="mt-3 space-y-5">
                  <LabRange label="Scheduler saturation" value={schedulerSaturation} output={`${schedulerSaturation}%`} min={10} max={130} step={5} accent="rose" lowLabel="Headroom" highLabel="Deadline loss" onChange={setSchedulerSaturation} />
                  <LabRange label="Workers lost" value={workersLost} output={`${workersLost} of 3`} min={0} max={3} accent="rose" lowLabel="Healthy pool" highLabel="No capacity" onChange={setWorkersLost} />
                  <LabRange label="KV-cache pressure" value={cachePressure} output={`${cachePressure}%`} min={10} max={120} step={5} accent="amber" lowLabel="Cache headroom" highLabel="Evictions" onChange={setCachePressure} />
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Change dependency state</legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice selected={safetyState === 'healthy'} label="Safety dependency healthy" detail="Schema and policy checks can complete." icon={ShieldAlert} accent="emerald" onClick={() => setSafetyState('healthy')} />
                  <LabChoice selected={safetyState === 'unavailable'} label="Safety dependency unavailable" detail="The output gate cannot make its required decision." icon={CloudOff} accent="rose" onClick={() => setSafetyState('unavailable')} />
                  <LabChoice selected={!streamDisconnect} label="Client stream connected" detail="Tokens can still reach the requester." icon={Radio} accent="cyan" onClick={() => setStreamDisconnect(false)} />
                  <LabChoice selected={streamDisconnect} label="Client stream disconnected" detail="Cancellation should reach the scheduler and worker." icon={CircleX} accent="rose" onClick={() => setStreamDisconnect(true)} />
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Choose admission and fallback policy</legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={policy === 'protect'} label="Protect the contract" detail="Reject excess load; fail closed when required controls are unavailable." icon={ShieldAlert} accent="emerald" onClick={() => setPolicy('protect')} />
                  <LabChoice selected={policy === 'limited'} label="Limited safe response" detail="Serve only a declared low-risk subset on an approved fallback route." icon={Workflow} accent="amber" onClick={() => setPolicy('limited')} />
                  <LabChoice selected={policy === 'bypass'} label="Bypass gate (unsafe)" detail="Shows the correctness risk of an availability-first shortcut." icon={TriangleAlert} accent="rose" onClick={() => setPolicy('bypass')} />
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Request path" value={result.pathLabel} detail={result.pathDetail} icon={Route} tone={result.tone} />
              <LabMetric label="Dropped or degraded work" value={result.workOutcome} detail={result.workDetail} icon={CircleX} tone={result.tone} />
              <LabMetric label="Estimated latency" value={result.latency} detail={result.latencyDetail} icon={Timer} tone={result.tone} />
              <LabMetric label="Correctness risk" value={result.risk} detail={result.riskDetail} icon={TriangleAlert} tone={result.riskTone} />
            </div>
            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Active request path</p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {result.nodes.map((node, index) => <PathNodeCard key={`${node.label}-${index}`} node={node} index={index} />)}
              </ol>
            </section>
            <section className={`rounded-md border p-4 ${result.tone === 'rose' ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.tone === 'amber' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Recovery sequence</p>
              <ol className="mt-3 grid gap-3 md:grid-cols-3">{result.recovery.map((step, index) => <li key={step} className="rounded-md border border-current/20 bg-white/40 p-3 text-sm leading-5 dark:bg-black/10"><span className="font-semibold">{index + 1}.</span> {step}</li>)}</ol>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function getRoute({ schedulerSaturation, workersLost, cachePressure, safetyState, streamDisconnect, policy, stages }: { schedulerSaturation: number; workersLost: number; cachePressure: number; safetyState: 'healthy' | 'unavailable'; streamDisconnect: boolean; policy: 'protect' | 'limited' | 'bypass'; stages: string[] }) {
  const overloaded = schedulerSaturation >= 90 || workersLost >= 2 || cachePressure >= 90;
  const severe = schedulerSaturation >= 115 || workersLost === 3 || cachePressure >= 110;
  const safetyBlocked = safetyState === 'unavailable' && policy === 'protect';
  const safetyBypassed = safetyState === 'unavailable' && policy === 'bypass';
  const limitedFallback = safetyState === 'unavailable' && policy === 'limited';
  const nodes: PathNode[] = [
    { label: stages[0] ?? 'Gateway admission', detail: severe && policy === 'protect' ? 'Rejects before queueing an impossible deadline.' : 'Preserves request ID, tenant limit, and deadline.', state: severe && policy === 'protect' ? 'failed' : overloaded ? 'degraded' : 'active' },
    { label: stages[1] ?? 'Deadline-aware scheduler', detail: schedulerSaturation >= 90 ? 'Fair queue limit reached; lower-priority work is not admitted.' : 'Places compatible work with remaining deadline.', state: schedulerSaturation >= 115 ? 'failed' : schedulerSaturation >= 70 ? 'degraded' : 'active' },
    { label: stages[2] ?? 'Model worker and KV cache', detail: workersLost === 3 ? 'No healthy worker remains.' : cachePressure >= 90 ? 'Cache reservation rejects new long-context sequences.' : workersLost > 0 ? `${workersLost} worker(s) draining; route capacity reduced.` : 'Worker owns prefill, decode, and cache release.', state: workersLost === 3 ? 'failed' : cachePressure >= 90 || workersLost > 0 ? 'degraded' : 'active' },
    { label: stages[3] ?? 'Safety and schema gate', detail: safetyBlocked ? 'Cannot prove required safety decision; response is withheld.' : safetyBypassed ? 'Unsafe policy bypass lets an unchecked response continue.' : limitedFallback ? 'Only a documented safe subset may continue.' : 'Applies policy and structured-output validation.', state: safetyBlocked ? 'failed' : safetyBypassed ? 'bypassed' : limitedFallback ? 'degraded' : 'active' },
    { label: stages[4] ?? 'Streaming response', detail: streamDisconnect ? 'Disconnect propagates cancellation and cache release.' : safetyBlocked || severe ? 'No response stream is opened.' : 'Streams tokens until completion or deadline.', state: streamDisconnect || safetyBlocked || severe ? 'bypassed' : 'active' },
  ];

  if (streamDisconnect) {
    return { nodes, tone: 'amber' as const, riskTone: 'emerald' as const, pathLabel: 'Cancel in flight', pathDetail: 'The request is stopped at the connection boundary with its original ID and deadline.', workOutcome: '1 stream canceled', workDetail: 'No additional tokens should be produced unless this is an explicit durable job.', latency: 'Bounded', latencyDetail: 'Cancellation prevents abandoned decode from extending the queue.', risk: 'Low', riskDetail: 'Correctness is protected because no partial result is presented as complete.', recovery: ['Propagate the disconnect to scheduler and worker.', 'Release the request KV cache and mark the cancellation reason.', 'Retry only through a new, explicit request or durable job contract.'] };
  }
  if (safetyBlocked) {
    return { nodes, tone: 'rose' as const, riskTone: 'emerald' as const, pathLabel: 'Fail closed', pathDetail: 'The output gate prevents a response whose required safety decision is unavailable.', workOutcome: 'Response withheld', workDetail: 'No unsafe fallback is emitted; callers receive a typed dependency failure.', latency: 'Fast failure', latencyDetail: 'The route ends before a misleading response reaches the client.', risk: 'Low', riskDetail: 'Availability falls, but the required product control remains intact.', recovery: ['Mark the safety dependency unhealthy and stop routing affected classes.', 'Drain or retry only within the request deadline after dependency recovery.', 'Run policy and schema checks before replaying an idempotent request.'] };
  }
  if (severe && policy === 'protect') {
    return { nodes, tone: 'rose' as const, riskTone: 'emerald' as const, pathLabel: 'Reject at admission', pathDetail: 'The gateway protects existing work by refusing a deadline it cannot meet.', workOutcome: 'New work dropped', workDetail: 'Existing admitted sequences drain; low-priority requests receive explicit retry guidance.', latency: 'No queue added', latencyDetail: 'Rejection avoids turning an overload into a fleet-wide timeout.', risk: 'Low', riskDetail: 'No degraded answer is claimed.', recovery: ['Freeze new admission for the saturated class.', 'Drain queues and replace lost workers before reopening capacity.', 'Ramp traffic gradually while watching queue wait and cache reservations.'] };
  }
  if (safetyBypassed) {
    return { nodes, tone: 'rose' as const, riskTone: 'rose' as const, pathLabel: 'Unsafe bypass', pathDetail: 'The response continues without a required safety or schema decision.', workOutcome: 'Work served unchecked', workDetail: 'Availability is preserved at the cost of an invalid product contract.', latency: overloaded ? 'High and unstable' : 'Lower now', latencyDetail: 'Skipping a dependency may reduce one wait but does not repair queue or worker pressure.', risk: 'High', riskDetail: 'Unchecked content or tool instructions can reach the user. This is a failure mode, not a recommended fallback.', recovery: ['Stop the bypass and restore fail-closed routing.', 'Identify outputs served without required validation using request IDs.', 'Repair the dependency, then review and notify affected downstream owners.'] };
  }
  if (limitedFallback) {
    return { nodes, tone: 'amber' as const, riskTone: 'amber' as const, pathLabel: 'Limited safe route', pathDetail: 'Only a predefined low-risk response subset continues on a constrained fallback.', workOutcome: 'Complex work deferred', workDetail: 'Requests requiring actions, strict schemas, or high-risk content are withheld.', latency: overloaded ? 'Elevated' : 'Moderate', latencyDetail: 'The fallback still obeys its deadline and admission budget.', risk: 'Moderate', riskDetail: 'Risk stays bounded only while the fallback claims and scope are explicit.', recovery: ['Route only approved low-risk classes to the limited path.', 'Defer restricted work with its request ID and remaining deadline.', 'Restore the safety gate and replay only idempotent deferred requests.'] };
  }
  if (overloaded) {
    return { nodes, tone: 'amber' as const, riskTone: 'amber' as const, pathLabel: 'Degraded capacity', pathDetail: 'Healthy controls still run, but admission and cache pressure reduce the eligible request set.', workOutcome: 'Some work deferred', workDetail: 'Long-context or lower-priority requests should wait or receive a typed overload response.', latency: 'Elevated', latencyDetail: 'Queue and placement delay grow before full collapse.', risk: 'Moderate', riskDetail: 'Correctness is retained only if model and safety contracts are not silently weakened.', recovery: ['Tighten queue and cache admission by service class.', 'Drain unhealthy workers and scale the model pool using queue wait.', 'Return to normal limits only after TTFT and cache pressure recover.'] };
  }
  return { nodes, tone: 'emerald' as const, riskTone: 'emerald' as const, pathLabel: 'Healthy primary route', pathDetail: 'The request reaches the selected worker, output gate, and connected stream inside its budget.', workOutcome: 'No degraded work', workDetail: 'All admitted requests preserve their declared safety and schema contract.', latency: 'Within target', latencyDetail: 'Headroom remains for normal arrival variation.', risk: 'Low', riskDetail: 'The route remains observable and cancellable if conditions change.', recovery: ['Continue sampling queue, cache, worker, and safety health.', 'Keep a warm floor for the model tier.', 'Test each failure policy before changing the serving runtime.'] };
}

function PathNodeCard({ node, index }: { node: PathNode; index: number }) {
  const classes: Record<NodeState, string> = {
    active: 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white',
    degraded: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
    bypassed: 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
  };
  return <li className={`min-w-0 rounded-md border p-3 ${classes[node.state]}`}><div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-75"><span>Step {index + 1}</span><span>{node.state}</span></div><p className="mt-2 text-sm font-semibold">{node.label}</p><p className="mt-1 text-xs leading-5 opacity-80">{node.detail}</p></li>;
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[680px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading overload and failure routing lab" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">Overload and failure routing lab unavailable</p><p className="mt-2 opacity-80">{detail}</p></div>;
}
