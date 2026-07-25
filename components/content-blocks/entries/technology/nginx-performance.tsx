'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleGauge,
  CloudCog,
  Gauge,
  Network,
  Server,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface CapacityData {
  title: string;
  description: string;
  edgeWorkMs: number;
  targetSlotUtilizationPct: number;
  upstreamBudgetRps: number;
  defaults: {
    requestRps: number;
    workers: number;
    workerConnections: number;
    cacheHitRatePct: number;
    upstreamLatencyMs: number;
  };
}

const BLOCK_ID = 'technology/nginx-performance';

function isCapacityData(value: unknown): value is CapacityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityData>;
  return Boolean(
    candidate.title &&
      candidate.description &&
      candidate.defaults &&
      Number.isFinite(candidate.edgeWorkMs) &&
      Number.isFinite(candidate.targetSlotUtilizationPct) &&
      Number.isFinite(candidate.upstreamBudgetRps),
  );
}

export default function NginxPerformance({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<CapacityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No proxy capacity assumptions were supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityData(payload)) throw new Error('Proxy capacity assumptions are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load proxy capacity assumptions.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Capacity lab unavailable" detail={error} />;
  if (!data) return <State title="Loading capacity lab" detail="Preparing the connection envelope..." />;
  return <CapacityLab data={data} />;
}

function CapacityLab({ data }: { data: CapacityData }) {
  const [requestRps, setRequestRps] = useState(data.defaults.requestRps);
  const [workers, setWorkers] = useState(data.defaults.workers);
  const [workerConnections, setWorkerConnections] = useState(data.defaults.workerConnections);
  const [cacheHitRatePct, setCacheHitRatePct] = useState(data.defaults.cacheHitRatePct);
  const [upstreamLatencyMs, setUpstreamLatencyMs] = useState(data.defaults.upstreamLatencyMs);

  const result = useMemo(() => {
    const missRatio = (100 - cacheHitRatePct) / 100;
    const upstreamRps = requestRps * missRatio;
    const averageRequestMs = data.edgeWorkMs + upstreamLatencyMs * missRatio;
    const downstreamConnections = requestRps * (averageRequestMs / 1000);
    const upstreamConnections = upstreamRps * (upstreamLatencyMs / 1000);
    const requiredSlots = downstreamConnections + upstreamConnections;
    const rawSlots = workers * workerConnections;
    const plannedSlots = rawSlots * (data.targetSlotUtilizationPct / 100);
    const slotUtilizationPct = (requiredSlots / plannedSlots) * 100;
    const slotsHealthy = requiredSlots <= plannedSlots;
    const upstreamHealthy = upstreamRps <= data.upstreamBudgetRps;

    return {
      averageRequestMs,
      downstreamConnections,
      healthy: slotsHealthy && upstreamHealthy,
      plannedSlots,
      requiredSlots,
      slotUtilizationPct,
      slotsHealthy,
      upstreamConnections,
      upstreamHealthy,
      upstreamRps,
    };
  }, [cacheHitRatePct, data.edgeWorkMs, data.targetSlotUtilizationPct, data.upstreamBudgetRps, requestRps, upstreamLatencyMs, workerConnections, workers]);

  const reset = () => {
    setRequestRps(data.defaults.requestRps);
    setWorkers(data.defaults.workers);
    setWorkerConnections(data.defaults.workerConnections);
    setCacheHitRatePct(data.defaults.cacheHitRatePct);
    setUpstreamLatencyMs(data.defaults.upstreamLatencyMs);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Proxy capacity lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <LabRange label="Incoming requests" value={requestRps} output={`${requestRps.toLocaleString()} req/s`} min={5000} max={200000} step={5000} accent="blue" lowLabel="5k" highLabel="200k req/s" onChange={setRequestRps} />
              <LabRange label="Worker processes" value={workers} output={`${workers}`} min={1} max={16} accent="violet" lowLabel="1" highLabel="16 workers" onChange={setWorkers} />
              <LabRange label="Worker connections" value={workerConnections} output={workerConnections.toLocaleString()} min={512} max={8192} step={512} accent="cyan" lowLabel="512" highLabel="8,192 per worker" onChange={setWorkerConnections} />
              <LabRange label="Cache hit rate" value={cacheHitRatePct} output={`${cacheHitRatePct}%`} min={0} max={98} step={1} accent="emerald" lowLabel="No edge hits" highLabel="98% hits" onChange={setCacheHitRatePct} />
              <LabRange label="Upstream latency" value={upstreamLatencyMs} output={`${upstreamLatencyMs}ms`} min={20} max={1000} step={20} accent="amber" lowLabel="20ms" highLabel="1s" onChange={setUpstreamLatencyMs} />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.healthy ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Capacity verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.healthy
                      ? 'The modeled connection and upstream budgets both have headroom'
                      : !result.slotsHealthy
                        ? 'Downstream and upstream sockets exceed the planned worker envelope'
                        : 'Cache misses exceed the declared upstream request budget'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    This is a planning model, not a benchmark. Worker connections include all connections a worker owns, and a proxied request can occupy both a downstream and an upstream socket.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Required slots" value={Math.ceil(result.requiredSlots).toLocaleString()} detail={`${Math.ceil(result.downstreamConnections).toLocaleString()} downstream + ${Math.ceil(result.upstreamConnections).toLocaleString()} upstream`} icon={Network} tone={result.slotsHealthy ? 'cyan' : 'rose'} />
              <LabMetric label="Planned slots" value={Math.floor(result.plannedSlots).toLocaleString()} detail={`${data.targetSlotUtilizationPct}% of configured worker slots`} icon={Server} tone="blue" />
              <LabMetric label="Upstream traffic" value={`${Math.round(result.upstreamRps).toLocaleString()} req/s`} detail={`${100 - cacheHitRatePct}% cache misses`} icon={CloudCog} tone={result.upstreamHealthy ? 'emerald' : 'rose'} />
              <LabMetric label="Modeled latency" value={`${Math.round(result.averageRequestMs)}ms`} detail="Edge work plus miss-weighted upstream time" icon={Activity} tone={result.averageRequestMs <= 250 ? 'violet' : 'amber'} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Planned connection-slot use</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Keep operating reserve for bursts, slow clients, health probes, reload overlap, and uneven worker load.</p>
                </div>
                <CircleGauge aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className={`h-full rounded-full transition-[width] ${result.slotsHealthy ? 'bg-blue-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, result.slotUtilizationPct)}%` }} />
              </div>
              <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{result.slotUtilizationPct.toFixed(0)}% of planned envelope</span>
                <span>{workers} workers</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stage icon={Network} title="Count both sides" detail="Client keep-alive, HTTP/2 streams, WebSockets, upstream keep-alive, and retries create different socket and concurrency shapes." />
              <Stage icon={Zap} title="Protect the upstream" detail="Cache hit rate matters through the work avoided. Budget misses, retry amplification, and cold-cache recovery against source capacity." />
              <Stage icon={Gauge} title="Benchmark the path" detail="Measure the exact TLS, protocol, payload, buffering, kernel, file-descriptor, worker, and upstream behavior on target hosts." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ icon: Icon, title, detail }: { icon: typeof Network; title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <Icon aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function State({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{detail}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
