'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  CopyCheck,
  GitFork,
  Network,
  RefreshCw,
  ShieldAlert,
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

type StateModel = 'ap-map' | 'cp-primitive';
type ScenarioKind = 'member-loss' | 'network-partition' | 'near-cache-delay';

interface FailureScenario {
  id: string;
  label: string;
  detail: string;
  kind: ScenarioKind;
  failedMembers: number;
  staleWindowMs: number;
}

interface FailureData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    stateModel: StateModel;
    backupCount: number;
  };
  scenarios: FailureScenario[];
}

const BLOCK_ID = 'technology/hazelcast-failure-lab';

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FailureData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults && Array.isArray(candidate.scenarios) && candidate.scenarios.length);
}

export default function HazelcastFailureLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No failure scenarios were supplied.');
      return;
    }

    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureData(payload)) throw new Error('Failure scenarios are incomplete.');
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load failure scenarios.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <State title="Failure lab unavailable" detail={error} />;
  if (!data) return <State title="Loading failure lab" detail="Preparing cluster incidents..." />;
  return <FailureLab data={data} />;
}

function FailureLab({ data }: { data: FailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [stateModel, setStateModel] = useState<StateModel>(data.defaults.stateModel);
  const [backupCount, setBackupCount] = useState(data.defaults.backupCount);
  const [splitBrainProtection, setSplitBrainProtection] = useState(true);
  const [nearCacheInvalidation, setNearCacheInvalidation] = useState(true);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    if (scenario.kind === 'member-loss') {
      const copiesSurvive = backupCount >= scenario.failedMembers;
      return {
        safe: copiesSurvive,
        title: copiesSurvive ? 'Backup partitions can be promoted to primary owners' : 'Some partitions have no surviving copy',
        detail: copiesSurvive
          ? 'The cluster still needs time and spare capacity to migrate ownership and rebuild the configured safety level.'
          : 'Availability and data safety are no longer guaranteed for partitions whose primary and every backup were lost.',
        acceptedSides: copiesSurvive ? 1 : 0,
        staleWindowMs: 0,
        duplicateTruths: 0,
      };
    }

    if (scenario.kind === 'network-partition') {
      const consistent = stateModel === 'cp-primitive' || splitBrainProtection;
      return {
        safe: consistent,
        title: stateModel === 'cp-primitive'
          ? 'The CP minority stops while the Raft majority remains authoritative'
          : splitBrainProtection
            ? 'Protected AP operations reject work below the minimum cluster size'
            : 'Both AP sub-clusters can accept conflicting mutations',
        detail: consistent
          ? 'Consistency is preserved by sacrificing availability on the side that cannot prove sufficient membership.'
          : 'A later cluster merge needs an explicit merge policy, and that policy cannot reconstruct overwritten business intent.',
        acceptedSides: consistent ? 1 : 2,
        staleWindowMs: 0,
        duplicateTruths: consistent ? 0 : 2,
      };
    }

    const staleWindowMs = nearCacheInvalidation ? Math.min(250, scenario.staleWindowMs) : scenario.staleWindowMs;
    return {
      safe: nearCacheInvalidation,
      title: nearCacheInvalidation ? 'Invalidation limits the stale near-cache window' : 'Clients can continue serving an old local copy',
      detail: nearCacheInvalidation
        ? 'Invalidation reduces stale reads, but callers still need a contract for reconnects, missed invalidations, and maximum tolerated staleness.'
        : 'A Near Cache improves latency by adding another copy; without a coherence policy, that copy can outlive the business decision it represents.',
      acceptedSides: 1,
      staleWindowMs,
      duplicateTruths: nearCacheInvalidation ? 0 : 1,
    };
  }, [backupCount, nearCacheInvalidation, scenario, splitBrainProtection, stateModel]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setStateModel(data.defaults.stateModel);
    setBackupCount(data.defaults.backupCount);
    setSplitBrainProtection(true);
    setNearCacheInvalidation(true);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Consistency boundary lab" title={data.title} description={data.description} icon={ShieldAlert} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Inject an incident</legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice key={item.id} selected={item.id === scenario.id} label={item.label} detail={item.detail} icon={item.kind === 'network-partition' ? GitFork : item.kind === 'near-cache-delay' ? RefreshCw : TriangleAlert} accent="rose" onClick={() => setScenarioId(item.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">State contract</legend>
                <div className="mt-3 grid gap-2">
                  <LabChoice selected={stateModel === 'ap-map'} label="AP distributed map" detail="Partitioned state favors continued service and resolves divergent copies by an explicit merge policy." icon={Network} accent="cyan" onClick={() => setStateModel('ap-map')} />
                  <LabChoice selected={stateModel === 'cp-primitive'} label="CP primitive" detail="A Raft-backed lock, counter, semaphore, or reference requires a valid CP majority." icon={ShieldCheck} accent="violet" onClick={() => setStateModel('cp-primitive')} />
                </div>
              </fieldset>
              <LabRange label="Map backup count" value={backupCount} output={`${backupCount}`} min={0} max={3} accent="blue" lowLabel="No copy" highLabel="Three copies" onChange={setBackupCount} />
              {scenario.kind === 'network-partition' && stateModel === 'ap-map' ? (
                <LabChoice selected={splitBrainProtection} label="Minimum-size protection" detail="Reject protected operations when observed membership falls below the configured threshold." icon={Ban} accent="emerald" onClick={() => setSplitBrainProtection((value) => !value)} />
              ) : null}
              {scenario.kind === 'near-cache-delay' ? (
                <LabChoice selected={nearCacheInvalidation} label="Near Cache invalidation" detail="Notify clients when the authoritative map entry changes and monitor missed invalidations." icon={RefreshCw} accent="emerald" onClick={() => setNearCacheInvalidation((value) => !value)} />
              ) : null}
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.safe ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.safe ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Observed outcome</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Write-capable sides" value={`${result.acceptedSides}`} detail="After the selected incident" icon={Activity} tone={result.acceptedSides <= 1 ? 'emerald' : 'rose'} />
              <LabMetric label="Conflicting truths" value={`${result.duplicateTruths}`} detail="Business outcomes requiring reconciliation" icon={CopyCheck} tone={result.duplicateTruths === 0 ? 'cyan' : 'rose'} />
              <LabMetric label="Stale window" value={result.staleWindowMs ? `${result.staleWindowMs}ms` : 'None'} detail="Modeled client-visible local-copy lag" icon={RefreshCw} tone={result.staleWindowMs > 250 ? 'amber' : 'violet'} />
              <LabMetric label="Failure posture" value={result.safe ? 'Contained' : 'Unsafe'} detail="For this declared state contract" icon={result.safe ? ShieldCheck : ShieldAlert} tone={result.safe ? 'emerald' : 'rose'} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Choose the state model" detail="Use AP structures when availability and explicit reconciliation are acceptable. Use CP primitives for decisions that must have one authoritative order." />
              <Stage title="Protect the failure boundary" detail="Separate primary and backup copies, configure minimum-size protection where needed, and budget capacity while safety is being rebuilt." />
              <Stage title="Prove recovery" detail="Test member loss, partition, reconnect, stale client copies, merge policy, and observable user outcomes before production traffic." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Stage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
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
