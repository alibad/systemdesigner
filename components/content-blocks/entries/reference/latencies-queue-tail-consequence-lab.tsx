'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  GitFork,
  RefreshCw,
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

type ReplayMode = 'none' | 'retry' | 'hedge';
type TimeoutPolicy = { id: string; label: string; multiplier: number; detail: string };
type QueueTailModel = {
  defaults: { utilizationPercent: number; serviceTimeMs: number; fanoutWidth: number; percentile: number; replayMode: ReplayMode; timeoutPolicy: string };
  limits: { utilizationPercent: { min: number; max: number; step: number }; serviceTimeMs: { min: number; max: number; step: number }; fanoutWidth: { min: number; max: number; step: number } };
  percentiles: number[];
  timeoutPolicies: TimeoutPolicy[];
};

const replayChoices: Array<{ id: ReplayMode; label: string; detail: string }> = [
  { id: 'none', label: 'No replay', detail: 'One bounded attempt; callers receive the deadline outcome.' },
  { id: 'retry', label: 'Retry after timeout', detail: 'A second sequential attempt can recover delay but adds load after a miss.' },
  { id: 'hedge', label: 'Hedge a slow attempt', detail: 'Start a duplicate after a delay; it may reduce tail latency at the cost of concurrent work.' },
];

function formatMs(value: number) {
  return `${Math.max(0, Math.round(value))} ms`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.995 ? 2 : 1)}%`;
}

export default function LatenciesQueueTailConsequenceLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<QueueTailModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [utilizationPercent, setUtilizationPercent] = useState(72);
  const [serviceTimeMs, setServiceTimeMs] = useState(18);
  const [fanoutWidth, setFanoutWidth] = useState(4);
  const [percentile, setPercentile] = useState(99);
  const [replayMode, setReplayMode] = useState<ReplayMode>('none');
  const [timeoutPolicy, setTimeoutPolicy] = useState('balanced');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The queue and tail model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<QueueTailModel>;
      })
      .then((model) => {
        setData(model);
        setUtilizationPercent(model.defaults.utilizationPercent);
        setServiceTimeMs(model.defaults.serviceTimeMs);
        setFanoutWidth(model.defaults.fanoutWidth);
        setPercentile(model.defaults.percentile);
        setReplayMode(model.defaults.replayMode);
        setTimeoutPolicy(model.defaults.timeoutPolicy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the queue and tail model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;
    const policy = data.timeoutPolicies.find((item) => item.id === timeoutPolicy) ?? data.timeoutPolicies[0];
    const rawUtilization = utilizationPercent / 100;
    const replayPressure = replayMode === 'hedge' ? rawUtilization * 0.08 : replayMode === 'retry' ? rawUtilization * 0.04 : 0;
    const effectiveUtilization = Math.min(0.995, rawUtilization + replayPressure);
    const meanQueueMs = serviceTimeMs * effectiveUtilization / (1 - effectiveUtilization);
    const percentileFraction = percentile / 100;
    const queueDelayMs = meanQueueMs * -Math.log(1 - percentileFraction);
    const timeoutMs = serviceTimeMs * policy.multiplier;
    const attemptMeanMs = serviceTimeMs + meanQueueMs;
    const attemptSuccess = 1 - Math.exp(-timeoutMs / attemptMeanMs);
    const branchSuccess = replayMode === 'none' ? attemptSuccess : 1 - Math.pow(1 - attemptSuccess, 2);
    const requestSuccess = Math.pow(branchSuccess, fanoutWidth);
    const requiredBranchPercentile = Math.pow(percentileFraction, 1 / fanoutWidth) * 100;
    const extraAttemptRate = replayMode === 'none'
      ? 0
      : replayMode === 'retry'
        ? 1 - attemptSuccess
        : Math.exp(-(timeoutMs * 0.6) / attemptMeanMs);
    const wastedWork = fanoutWidth * extraAttemptRate;
    return { attemptSuccess, effectiveUtilization, meanQueueMs, policy, queueDelayMs, requestSuccess, requiredBranchPercentile, timeoutMs, wastedWork };
  }, [data, fanoutWidth, percentile, replayMode, serviceTimeMs, timeoutPolicy, utilizationPercent]);

  if (loadError) return <LabError title="Queue and tail consequence lab unavailable" detail={loadError} />;
  if (!data || !model) return <LabLoading label="Loading queue and tail consequence lab" />;

  const isSaturated = model.effectiveUtilization >= 0.88;
  const requestAtRisk = model.requestSuccess < 0.99;
  const selectedPolicy = model.policy;
  const reset = () => {
    setUtilizationPercent(data.defaults.utilizationPercent);
    setServiceTimeMs(data.defaults.serviceTimeMs);
    setFanoutWidth(data.defaults.fanoutWidth);
    setPercentile(data.defaults.percentile);
    setReplayMode(data.defaults.replayMode);
    setTimeoutPolicy(data.defaults.timeoutPolicy);
  };
  const guidance = isSaturated
    ? 'Utilization is near saturation. Protect the resource first: reduce offered work, bound queues and pools, shed lower-priority requests, or add measured headroom. Retrying into this queue can make the tail worse.'
    : fanoutWidth >= 6
      ? 'Wide required fanout makes the request depend on an extreme tail from every branch. Remove optional calls, combine data where ownership permits, or return non-critical work asynchronously.'
      : replayMode !== 'none' && model.wastedWork >= 0.2
        ? 'Replay is adding visible work. Keep it only for idempotent operations, cap it by the remaining deadline, and test whether the recovery gain exceeds the added queue pressure.'
        : 'The modeled pressure is bounded. Keep tracing queue wait, service time, request success, and replay volume so a traffic or dependency change does not silently consume the margin.';

  return (
    <div data-content-block="reference/latencies-queue-tail-consequence-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Queue and tail consequence lab"
          title="Watch a bounded resource magnify a required fanout"
          description="The model uses a simple single-resource queue approximation and independent branch outcomes. It is for reasoning about pressure, not predicting a production percentile without traces."
          icon={Activity}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange label="Resource utilization" value={utilizationPercent} output={`${utilizationPercent}%`} min={data.limits.utilizationPercent.min} max={data.limits.utilizationPercent.max} step={data.limits.utilizationPercent.step} accent="rose" lowLabel="headroom" highLabel="near saturation" onChange={setUtilizationPercent} />
              <LabRange label="Service time per branch" value={serviceTimeMs} output={formatMs(serviceTimeMs)} min={data.limits.serviceTimeMs.min} max={data.limits.serviceTimeMs.max} step={data.limits.serviceTimeMs.step} accent="violet" lowLabel="short work" highLabel="slow work" onChange={setServiceTimeMs} />
              <LabRange label="Required fanout width" value={fanoutWidth} output={`${fanoutWidth} branches`} min={data.limits.fanoutWidth.min} max={data.limits.fanoutWidth.max} step={data.limits.fanoutWidth.step} accent="amber" lowLabel="one dependency" highLabel="twelve dependencies" onChange={setFanoutWidth} />
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Percentile to protect</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">{data.percentiles.map((option) => <LabChoice key={option} selected={percentile === option} label={`p${option}`} detail={option === 50 ? 'Typical path' : option === 95 ? 'Slow-user target' : 'Tail target'} icon={Gauge} accent={option === 99 ? 'rose' : option === 95 ? 'amber' : 'blue'} onClick={() => setPercentile(option)} />)}</div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Replay behavior</legend>
                <div className="mt-3 space-y-2">{replayChoices.map((choice) => <LabChoice key={choice.id} selected={replayMode === choice.id} label={choice.label} detail={choice.detail} icon={choice.id === 'none' ? CheckCircle2 : RefreshCw} accent={choice.id === 'hedge' ? 'amber' : choice.id === 'retry' ? 'rose' : 'emerald'} onClick={() => setReplayMode(choice.id)} />)}</div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Timeout policy</legend>
                <div className="mt-3 space-y-2">{data.timeoutPolicies.map((policy) => <LabChoice key={policy.id} selected={timeoutPolicy === policy.id} label={`${policy.label}: ${formatMs(serviceTimeMs * policy.multiplier)}`} detail={policy.detail} icon={Clock3} accent={policy.id === 'tight' ? 'amber' : policy.id === 'long' ? 'rose' : 'blue'} onClick={() => setTimeoutPolicy(policy.id)} />)}</div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label={`Modeled p${percentile} queue wait`} value={formatMs(model.queueDelayMs)} detail={`${Math.round(model.effectiveUtilization * 100)}% effective utilization after replay pressure.`} icon={Clock3} tone={isSaturated ? 'rose' : 'amber'} />
              <LabMetric label="Tail amplification" value={`p${model.requiredBranchPercentile.toFixed(2)}`} detail={`Each of ${fanoutWidth} required branches must be this fast to meet request p${percentile}.`} icon={GitFork} tone="violet" />
              <LabMetric label="Request success by deadline" value={formatPercent(model.requestSuccess)} detail={`${formatMs(model.timeoutMs)} ${selectedPolicy.label.toLowerCase()} deadline; independent-branch assumption.`} icon={requestAtRisk ? TriangleAlert : CheckCircle2} tone={requestAtRisk ? 'rose' : 'emerald'} />
              <LabMetric label="Extra attempted work" value={`${model.wastedWork.toFixed(2)} branch calls`} detail={replayMode === 'none' ? 'No replay is configured.' : `Expected added work from ${replayMode === 'hedge' ? 'hedges' : 'retries'} per request.`} icon={RefreshCw} tone={model.wastedWork >= 0.5 ? 'amber' : 'neutral'} />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">Why the tail changes</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The approximate queue grows nonlinearly as utilization approaches 100%. Fanout then asks every required branch to meet a stricter individual percentile.</p></div>
              <div className="grid gap-px bg-neutral-200 sm:grid-cols-3 dark:bg-neutral-800"><PathFact label="Useful service" value={formatMs(serviceTimeMs)} detail="Active work on one constrained branch." /><PathFact label="Mean queue estimate" value={formatMs(model.meanQueueMs)} detail="Before selecting the p50, p95, or p99 tail." /><PathFact label={`Selected p${percentile} branch delay`} value={formatMs(serviceTimeMs + model.queueDelayMs)} detail="Service plus the modeled queue delay." /></div>
            </section>

            <section className={`mt-5 rounded-md border p-5 ${isSaturated || requestAtRisk ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50' : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Mitigation guidance</p>
              <p className="mt-2 text-lg font-semibold">{isSaturated ? 'Queue pressure is now the dominant consequence.' : requestAtRisk ? 'The deadline and fanout combination leaves a visible failure risk.' : 'This configuration retains modeled headroom, but it still needs production evidence.'}</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{guidance}</p>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Model assumptions: arrivals and service are simplified as one queue; branch timeout outcomes are independent; retries and hedges add fixed pressure. Real systems have correlated outages, retries at multiple layers, uneven shards, queues, and cancellation behavior. Use this to choose what to measure, then replace it with trace and load-test evidence.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 bg-white p-4 dark:bg-neutral-950"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>;
}

function LabLoading({ label }: { label: string }) {
  return <div data-content-block="reference/latencies-queue-tail-consequence-lab"><div className="min-h-[620px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} /></div>;
}

function LabError({ title, detail }: { title: string; detail: string }) {
  return <div data-content-block="reference/latencies-queue-tail-consequence-lab"><div className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert"><p className="font-semibold">{title}</p><p className="mt-2 opacity-80">{detail}</p></div></div>;
}
