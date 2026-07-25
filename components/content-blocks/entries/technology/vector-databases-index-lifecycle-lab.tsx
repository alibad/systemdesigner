'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  GitCompareArrows,
  HardDriveUpload,
  Layers3,
  LoaderCircle,
  RadioTower,
  ServerCrash,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Scenario = {
  id: string;
  label: string;
  detail: string;
  seedBacklog: number;
  demandMultiplier: number;
  requiredCoverage: number;
  risk: string;
};
type Cutover = {
  id: string;
  label: string;
  detail: string;
  writeAmplification: number;
  servesOldUntilReady: boolean;
  requiresCheckpoint: boolean;
};
type LifecycleData = {
  title: string;
  description: string;
  windowSeconds: number;
  freshnessTargetSeconds: number;
  defaults: {
    scenarioId: string;
    cutoverId: string;
    writeRps: number;
    indexRps: number;
    replicas: number;
    replicaFailure: boolean;
  };
  bounds: {
    writeRps: Bound;
    indexRps: Bound;
    replicas: Bound;
  };
  scenarios: Scenario[];
  cutovers: Cutover[];
};

const BLOCK_ID = 'technology/vector-databases-index-lifecycle-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return [candidate.min, candidate.max, candidate.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isLifecycleData(value: unknown): value is LifecycleData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LifecycleData>;
  return Boolean(
    candidate.title
      && candidate.description
      && typeof candidate.windowSeconds === 'number'
      && typeof candidate.freshnessTargetSeconds === 'number'
      && candidate.defaults?.scenarioId
      && candidate.defaults.cutoverId
      && typeof candidate.defaults.writeRps === 'number'
      && typeof candidate.defaults.indexRps === 'number'
      && typeof candidate.defaults.replicas === 'number'
      && typeof candidate.defaults.replicaFailure === 'boolean'
      && isBound(candidate.bounds?.writeRps)
      && isBound(candidate.bounds?.indexRps)
      && isBound(candidate.bounds?.replicas)
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && Array.isArray(candidate.cutovers)
      && candidate.cutovers.length > 0,
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 'Unbounded';
  if (seconds < 60) return `${seconds.toFixed(0)} sec`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

export default function VectorDatabasesIndexLifecycleLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No index-lifecycle model was supplied.');
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
        if (!isLifecycleData(payload)) throw new Error('The index-lifecycle model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lifecycle lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <LifecycleWorkbench data={data} />;
}

function LifecycleWorkbench({ data }: { data: LifecycleData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [cutoverId, setCutoverId] = useState(data.defaults.cutoverId);
  const [writeRps, setWriteRps] = useState(data.defaults.writeRps);
  const [indexRps, setIndexRps] = useState(data.defaults.indexRps);
  const [replicas, setReplicas] = useState(data.defaults.replicas);
  const [replicaFailure, setReplicaFailure] = useState(data.defaults.replicaFailure);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const cutover = data.cutovers.find((item) => item.id === cutoverId) ?? data.cutovers[0];

  const result = useMemo(() => {
    const logicalWrites = writeRps * scenario.demandMultiplier;
    const appliedDemand = logicalWrites * cutover.writeAmplification;
    const windowDemand = scenario.seedBacklog + appliedDemand * data.windowSeconds;
    const windowCapacity = indexRps * data.windowSeconds;
    const processed = Math.min(windowDemand, windowCapacity);
    const backlog = Math.max(0, windowDemand - processed);
    const coverage = windowDemand === 0 ? 100 : processed / windowDemand * 100;
    const freshnessLag = indexRps > 0 ? backlog / indexRps : Number.POSITIVE_INFINITY;
    const drainRate = indexRps - appliedDemand;
    const catchupSeconds = backlog === 0
      ? 0
      : drainRate > 0
        ? backlog / drainRate
        : Number.POSITIVE_INFINITY;
    const availableReplicas = Math.max(0, replicas - (replicaFailure ? 1 : 0));
    const quorum = Math.floor(replicas / 2) + 1;
    const hasQuorum = availableReplicas >= quorum;
    const freshnessPass = freshnessLag <= data.freshnessTargetSeconds;
    const coveragePass = coverage >= scenario.requiredCoverage;
    const checkpointReady = freshnessPass && coveragePass && backlog === 0;
    const cutoverAllowed = !cutover.requiresCheckpoint || checkpointReady;
    const cutoverSafe = checkpointReady;
    const servingProtected = cutover.servesOldUntilReady || cutoverSafe;
    const servingHealthy = availableReplicas > 0 && servingProtected;

    let verdict = 'The new generation is ready for a controlled cutover';
    let detail = 'Coverage, freshness, and replica availability satisfy the selected contract. Keep the old generation available through the rollback window.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!hasQuorum) {
      verdict = 'Replica failure removes the write quorum';
      detail = `Only ${availableReplicas} of ${replicas} replicas remain. Pause mutation acknowledgment or restore capacity before claiming durable progress.`;
      tone = 'rose';
    } else if (!cutover.requiresCheckpoint && backlog > 0) {
      verdict = 'The alias can expose an incomplete generation';
      detail = `${formatCount(backlog)} mutations remain outside the new index. An immediate flip violates the observable checkpoint boundary.`;
      tone = 'rose';
    } else if (!Number.isFinite(catchupSeconds)) {
      verdict = 'The new generation can never catch up';
      detail = `Modeled demand is ${formatCount(appliedDemand)} mutations/sec while capacity is ${formatCount(indexRps)}/sec. Add capacity, reduce write amplification, or apply backpressure.`;
      tone = 'rose';
    } else if (!checkpointReady) {
      verdict = cutover.servesOldUntilReady
        ? 'Serving is protected while the build catches up'
        : 'Cutover must remain blocked';
      detail = `${formatCount(backlog)} mutations remain, with ${formatDuration(freshnessLag)} of modeled lag. The old generation should keep serving until coverage reaches ${scenario.requiredCoverage}%.`;
      tone = freshnessLag > data.freshnessTargetSeconds * 4 ? 'rose' : 'amber';
    } else if (replicaFailure) {
      verdict = 'The cutover is fresh but serving is degraded';
      detail = `${availableReplicas} replicas remain available. Complete repair and verify placement before retiring the rollback generation.`;
      tone = 'amber';
    } else if (cutover.id === 'shadow') {
      verdict = 'Freshness passes; compare quality before the alias moves';
      detail = 'Shadow reads should now compare neighbor overlap, filter completeness, tail latency, and task quality against the serving generation.';
      tone = 'amber';
    }

    return {
      appliedDemand,
      availableReplicas,
      backlog,
      catchupSeconds,
      checkpointReady,
      coverage,
      cutoverAllowed,
      cutoverSafe,
      detail,
      freshnessLag,
      hasQuorum,
      logicalWrites,
      processed,
      quorum,
      servingHealthy,
      tone,
      verdict,
      windowDemand,
    };
  }, [cutover, data, indexRps, replicaFailure, replicas, scenario, writeRps]);

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setCutoverId(data.defaults.cutoverId);
    setWriteRps(data.defaults.writeRps);
    setIndexRps(data.defaults.indexRps);
    setReplicas(data.defaults.replicas);
    setReplicaFailure(data.defaults.replicaFailure);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Freshness and migration control room"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <ChoiceGroup
                label="1. Change scenario"
                items={data.scenarios}
                selectedId={scenario.id}
                icon={scenario.id === 'migration' ? Layers3 : scenario.id === 'deletion' ? ShieldCheck : HardDriveUpload}
                accent="violet"
                onSelect={setScenarioId}
              />
              <ChoiceGroup
                label="2. Cutover contract"
                items={data.cutovers}
                selectedId={cutover.id}
                icon={cutover.id === 'shadow' ? GitCompareArrows : RadioTower}
                accent="emerald"
                onSelect={setCutoverId}
              />
              <LabRange
                label="Accepted writes"
                value={writeRps}
                output={`${formatCount(writeRps)} / sec`}
                {...data.bounds.writeRps}
                accent="violet"
                lowLabel="Quiet"
                highLabel="Write surge"
                onChange={setWriteRps}
              />
              <LabRange
                label="Indexing capacity"
                value={indexRps}
                output={`${formatCount(indexRps)} / sec`}
                {...data.bounds.indexRps}
                accent="cyan"
                lowLabel="Constrained"
                highLabel="Catch-up capacity"
                onChange={setIndexRps}
              />
              <LabRange
                label="Replica count"
                value={replicas}
                output={`${replicas} replicas`}
                {...data.bounds.replicas}
                accent="blue"
                lowLabel="Single copy"
                highLabel="Four copies"
                onChange={setReplicas}
              />
              <FailureSwitch checked={replicaFailure} onChange={setReplicaFailure} />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Pending mutations"
                value={formatCount(result.backlog)}
                detail={`${result.coverage.toFixed(1)}% generation coverage`}
                icon={Layers3}
                tone={result.backlog === 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Freshness lag"
                value={formatDuration(result.freshnessLag)}
                detail={`${data.freshnessTargetSeconds} sec target`}
                icon={Clock3}
                tone={result.freshnessLag <= data.freshnessTargetSeconds ? 'emerald' : result.freshnessLag <= data.freshnessTargetSeconds * 4 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Catch-up time"
                value={formatDuration(result.catchupSeconds)}
                detail={`${formatCount(result.appliedDemand)} effective writes/sec`}
                icon={LoaderCircle}
                tone={Number.isFinite(result.catchupSeconds) ? result.catchupSeconds < 600 ? 'cyan' : 'amber' : 'rose'}
              />
              <LabMetric
                label="Serving replicas"
                value={`${result.availableReplicas} / ${replicas}`}
                detail={`Write quorum requires ${result.quorum}`}
                icon={Database}
                tone={result.hasQuorum ? replicaFailure ? 'amber' : 'blue' : 'rose'}
              />
            </div>

            <section className={`rounded-md border p-4 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
              : result.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'}`}>
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'rose' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`} />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{result.detail}</p>
                </div>
              </div>
            </section>

            <section aria-label="Index generation path" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Generation path</p>
              <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Trace the checkpoint before traffic moves</h4>
              <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                <FlowNode icon={HardDriveUpload} eyebrow="Source log" title={`${formatCount(result.logicalWrites)} / sec`} detail="Stable mutation IDs and versions" tone="violet" />
                <Connector />
                <FlowNode icon={Layers3} eyebrow="Index workers" title={`${formatCount(indexRps)} / sec`} detail={`${formatCount(result.processed)} applied in the window`} tone={result.appliedDemand <= indexRps ? 'cyan' : 'amber'} />
                <Connector />
                <FlowNode icon={Database} eyebrow="New generation" title={`${result.coverage.toFixed(1)}% covered`} detail={result.checkpointReady ? 'Checkpoint ready' : `${formatCount(result.backlog)} pending`} tone={result.checkpointReady ? 'emerald' : 'amber'} />
                <Connector />
                <FlowNode
                  icon={RadioTower}
                  eyebrow="Serving alias"
                  title={result.cutoverSafe ? 'May move' : result.cutoverAllowed ? 'Moves early' : 'Hold'}
                  detail={result.servingHealthy ? 'Serving path protected' : 'Serving contract at risk'}
                  tone={result.cutoverSafe && result.servingHealthy ? 'emerald' : 'rose'}
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Checkpoint coverage</p>
                  <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">Target {scenario.requiredCoverage}% before this change can retire the old generation</p>
                </div>
                <span className="shrink-0 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">{result.coverage.toFixed(1)}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${result.coverage >= scenario.requiredCoverage ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'}`}
                  style={{ width: `${Math.max(2, Math.min(100, result.coverage))}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{scenario.risk}</p>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Write amplification" value={`${cutover.writeAmplification.toFixed(1)}x`} detail="Modeled work created by the selected cutover" />
              <Fact label="Checkpoint gate" value={cutover.requiresCheckpoint ? 'Required' : 'Skipped'} detail="Whether the alias waits for observable coverage" />
              <Fact label="Old generation" value={cutover.servesOldUntilReady ? 'Remains live' : 'Not protected'} detail="Serving behavior while the new index catches up" />
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
  icon,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string; detail: string }>;
  selectedId: string;
  icon: LucideIcon;
  accent: 'violet' | 'emerald';
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
            icon={icon}
            accent={accent}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function FailureSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${checked
        ? 'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-500 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
        : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${checked ? 'bg-rose-600 text-white' : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
        {checked ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : <Check aria-hidden="true" className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-semibold">Take one replica offline</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">Challenge availability and write-quorum assumptions during the build.</span>
      </span>
    </button>
  );
}

function FlowNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  tone,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose';
}) {
  const styles = {
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    rose: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 min-h-[680px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading vector index lifecycle lab" />
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <ServerCrash aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">The vector index lifecycle lab could not load</p>
          <p className="mt-2 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
