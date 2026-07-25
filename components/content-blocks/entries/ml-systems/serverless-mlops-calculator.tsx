'use client';

import { useMemo, useState } from 'react';
import { Activity, CloudCog, Coins, Gauge, Server, ShieldCheck, Snowflake, TriangleAlert } from 'lucide-react';

import { LabChoice, LabMetric, LabRange, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

type Workload = 'realtime' | 'async' | 'batch';
const BLOCK_ID = 'ml-systems/serverless-mlops-calculator';
const workloads: Array<{ id: Workload; label: string; detail: string; deadlineMs: number }> = [
  { id: 'realtime', label: 'Synchronous inference', detail: 'A caller waits for one prediction under a strict latency budget.', deadlineMs: 500 },
  { id: 'async', label: 'Queue-backed inference', detail: 'A worker may absorb bursts and return the result later.', deadlineMs: 10_000 },
  { id: 'batch', label: 'Scheduled scoring', detail: 'Finite jobs optimize throughput and cost rather than request latency.', deadlineMs: 60_000 },
];

export default function ServerlessMlopsCalculator() {
  const [workloadId, setWorkloadId] = useState<Workload>('realtime');
  const [requestsPerSecond, setRequestsPerSecond] = useState(120);
  const [durationMs, setDurationMs] = useState(180);
  const [coldStartMs, setColdStartMs] = useState(1_400);
  const [memoryMb, setMemoryMb] = useState(2_048);
  const [concurrency, setConcurrency] = useState(80);
  const [warmInstances, setWarmInstances] = useState(8);
  const workload = workloads.find((item) => item.id === workloadId) ?? workloads[0];
  const result = useMemo(() => {
    const requiredConcurrency = Math.ceil(requestsPerSecond * durationMs / 1_000);
    const capacityRps = concurrency * 1_000 / durationMs;
    const warmCapacityRps = warmInstances * 1_000 / durationMs;
    const coldShare = workloadId === 'batch' ? 0 : Math.max(0, Math.min(1, (requestsPerSecond - warmCapacityRps) / Math.max(1, requestsPerSecond)));
    const p50Ms = durationMs;
    const expectedLatencyMs = durationMs + coldShare * coldStartMs;
    const computeGbSeconds = (memoryMb / 1_024) * (durationMs / 1_000);
    const computePerMillion = computeGbSeconds * 1_000_000;
    const concurrencyPressure = requiredConcurrency / concurrency * 100;
    const deadlineMiss = workloadId === 'realtime' && expectedLatencyMs > workload.deadlineMs;
    const overloaded = concurrencyPressure > 80 || requestsPerSecond > capacityRps;
    return { capacityRps, coldShare, computePerMillion, concurrencyPressure, deadlineMiss, expectedLatencyMs, overloaded, p50Ms, requiredConcurrency };
  }, [coldStartMs, concurrency, durationMs, memoryMb, requestsPerSecond, warmInstances, workload.deadlineMs, workloadId]);
  const reset = () => { setWorkloadId('realtime'); setRequestsPerSecond(120); setDurationMs(180); setColdStartMs(1_400); setMemoryMb(2_048); setConcurrency(80); setWarmInstances(8); };
  const unhealthy = result.overloaded || result.deadlineMiss;

  return <div data-content-block={BLOCK_ID}><LearningLab><LearningLabHeader eyebrow="Serverless inference lab" title="Test whether scale-to-zero fits the workload" description="Model latency, concurrency, warm capacity, and compute consumption separately. The output is a planning envelope, not a cloud-provider quote." icon={CloudCog} accent="cyan" onReset={reset} /><LearningLabBody controls={<div className="space-y-7"><fieldset><legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload contract</legend><div className="mt-3 grid gap-2">{workloads.map((item) => <LabChoice key={item.id} selected={item.id === workload.id} label={item.label} detail={item.detail} icon={item.id === 'realtime' ? Gauge : Activity} accent={item.id === 'realtime' ? 'cyan' : 'violet'} onClick={() => setWorkloadId(item.id)} />)}</div></fieldset><LabRange label="Arrival rate" value={requestsPerSecond} output={`${requestsPerSecond.toLocaleString()}/s`} min={1} max={4_000} step={10} accent="blue" lowLabel="Occasional" highLabel="Sustained burst" onChange={setRequestsPerSecond} /><LabRange label="Warm execution" value={durationMs} output={`${durationMs}ms`} min={20} max={5_000} step={20} accent="emerald" lowLabel="Small model" highLabel="Heavy handler" onChange={setDurationMs} /><LabRange label="Cold-start penalty" value={coldStartMs} output={`${coldStartMs}ms`} min={0} max={15_000} step={100} accent="rose" lowLabel="Cached artifact" highLabel="Slow initialization" onChange={setColdStartMs} /><LabRange label="Function memory" value={memoryMb} output={`${memoryMb}MB`} min={512} max={10_240} step={512} accent="violet" lowLabel="Compact" highLabel="Platform ceiling" onChange={setMemoryMb} /><LabRange label="Concurrency quota" value={concurrency} output={`${concurrency}`} min={5} max={2_000} step={5} accent="amber" lowLabel="Bounded" highLabel="Large quota" onChange={setConcurrency} /><LabRange label="Pre-warmed instances" value={warmInstances} output={`${warmInstances}`} min={0} max={500} step={1} accent="cyan" lowLabel="Scale to zero" highLabel="Reserved capacity" onChange={setWarmInstances} /></div>}><div className="space-y-6"><div className={`rounded-md border p-5 ${unhealthy ? warningClass : healthyClass}`}><div className="flex items-start gap-3">{unhealthy ? <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}<div><p className="text-xs font-semibold uppercase opacity-75">Fit verdict</p><h4 className="mt-1 text-xl font-semibold">{result.overloaded ? 'Concurrency is too close to saturation' : result.deadlineMiss ? 'Cold starts break the synchronous deadline' : 'The workload fits the modeled serverless envelope'}</h4><p className="mt-2 text-sm leading-6 opacity-80">{result.overloaded ? 'Raise an approved quota, reduce execution time, queue work, or move sustained traffic to a dedicated serving pool.' : result.deadlineMiss ? 'Pre-warm the critical path, shrink initialization, or choose an asynchronous contract instead of hiding the tail.' : 'Keep load tests, quota alarms, artifact-size limits, and a dedicated-serving crossover threshold in the release evidence.'}</p></div></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><LabMetric label="Needed concurrency" value={result.requiredConcurrency.toLocaleString()} detail={`${result.concurrencyPressure.toFixed(0)}% of configured quota`} icon={Server} tone={result.concurrencyPressure > 80 ? 'rose' : 'blue'} /><LabMetric label="Cold request share" value={`${(result.coldShare * 100).toFixed(0)}%`} detail={`${warmInstances} warm execution slots`} icon={Snowflake} tone={result.coldShare > 0.1 ? 'rose' : 'cyan'} /><LabMetric label="Expected latency" value={`${result.expectedLatencyMs.toFixed(0)}ms`} detail={`${result.p50Ms}ms warm path`} icon={Gauge} tone={result.deadlineMiss ? 'rose' : 'emerald'} /><LabMetric label="Compute / 1M" value={`${result.computePerMillion.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB-s`} detail="Apply provider prices and request fees separately" icon={Coins} tone="amber" /></div><div className="grid gap-3 md:grid-cols-3"><Stage title="Bound" detail="Set memory, duration, payload, concurrency, and downstream connection limits before enabling automatic scale-out." /><Stage title="Warm" detail="Pre-initialize only the latency-critical slice; measure artifact download, runtime import, and model-load time separately." /><Stage title="Cross over" detail="Compare sustained serverless compute and pre-warming against an autoscaled dedicated endpoint at representative utilization." /></div></div></LearningLabBody></LearningLab></div>;
}

function Stage({ title, detail }: { title: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
