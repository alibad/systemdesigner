'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Database,
  Gauge,
  HardDrive,
  LoaderCircle,
  Network,
  RefreshCw,
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

type Reachability = 'none' | 'project' | 'host' | 'external';

type Workload = {
  id: string;
  label: string;
  detail: string;
  needsPersistentData: boolean;
  needsHostEditing: boolean;
  requiredReachability: Reachability;
  peakMemoryMb: number;
};

type Storage = {
  id: string;
  label: string;
  detail: string;
  survivesReplacement: boolean;
  hostCoupled: boolean;
  supportsHostEditing: boolean;
};

type NetworkMode = {
  id: string;
  label: string;
  detail: string;
  reachability: Reachability;
  sharesHostNamespace: boolean;
};

type RuntimeModel = {
  title: string;
  description: string;
  defaults: {
    workloadId: string;
    storageId: string;
    networkId: string;
    memoryLimitMb: number;
  };
  workloads: Workload[];
  storageOptions: Storage[];
  networkModes: NetworkMode[];
};

const BLOCK_ID = 'technology/docker-runtime-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/docker/data/runtime-boundaries.json';
const reachabilityRank: Record<Reachability, number> = {
  none: 0,
  project: 1,
  host: 2,
  external: 3,
};

function validRuntimeModel(value: unknown): value is RuntimeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RuntimeModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Number.isFinite(candidate.defaults.memoryLimitMb)
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length >= 2
      && Array.isArray(candidate.storageOptions)
      && candidate.storageOptions.length >= 3
      && Array.isArray(candidate.networkModes)
      && candidate.networkModes.length >= 3,
  );
}

export default function DockerRuntimeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RuntimeModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function load() {
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validRuntimeModel(payload)) throw new Error('The Docker runtime model is incomplete.');
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the runtime model.');
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!data ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Container boundary lab"
            title="Predict what survives and what becomes reachable"
            description="Loading an illustrative runtime policy model."
            icon={Box}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <RuntimeLab model={data} />
      )}
    </div>
  );
}

function RuntimeLab({ model }: { model: RuntimeModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [storageId, setStorageId] = useState(model.defaults.storageId);
  const [networkId, setNetworkId] = useState(model.defaults.networkId);
  const [memoryLimitMb, setMemoryLimitMb] = useState(model.defaults.memoryLimitMb);
  const [runAsNonRoot, setRunAsNonRoot] = useState(true);
  const [readOnlyRoot, setReadOnlyRoot] = useState(true);
  const [generation, setGeneration] = useState(1);

  const result = useMemo(() => {
    const workload = model.workloads.find((item) => item.id === workloadId) ?? model.workloads[0];
    const storage = model.storageOptions.find((item) => item.id === storageId) ?? model.storageOptions[0];
    const network = model.networkModes.find((item) => item.id === networkId) ?? model.networkModes[0];
    const warnings: string[] = [];

    if (workload.needsPersistentData && !storage.survivesReplacement) {
      warnings.push('Required application data disappears when the container is replaced.');
    }
    if (workload.needsHostEditing && !storage.supportsHostEditing) {
      warnings.push('The host cannot edit the selected source path directly.');
    }
    if (!workload.needsHostEditing && storage.hostCoupled) {
      warnings.push('This workload does not require direct host editing, but the mount couples it to one host path.');
    }
    if (reachabilityRank[network.reachability] < reachabilityRank[workload.requiredReachability]) {
      warnings.push('The service is not reachable from every required caller.');
    }
    if (reachabilityRank[network.reachability] > reachabilityRank[workload.requiredReachability]) {
      warnings.push('The service is exposed beyond its required caller scope.');
    }
    if (network.sharesHostNamespace) {
      warnings.push('Host networking removes network-namespace isolation and can create port conflicts.');
    }
    if (memoryLimitMb === 0) {
      warnings.push('No memory limit protects the host from this container.');
    } else if (memoryLimitMb < workload.peakMemoryMb) {
      warnings.push(`The ${memoryLimitMb} MB limit is below the modeled ${workload.peakMemoryMb} MB peak.`);
    }
    if (!runAsNonRoot) warnings.push('The process starts as root inside the container.');
    if (!readOnlyRoot) warnings.push('The image filesystem remains writable at runtime.');

    return {
      workload,
      storage,
      network,
      warnings,
      healthy: warnings.length === 0,
      dataState: generation === 1
        ? 'Seed data present'
        : storage.survivesReplacement
          ? 'Recovered from mount'
          : 'Lost with old container',
    };
  }, [generation, memoryLimitMb, model, networkId, readOnlyRoot, runAsNonRoot, storageId, workloadId]);

  function reset() {
    setWorkloadId(model.defaults.workloadId);
    setStorageId(model.defaults.storageId);
    setNetworkId(model.defaults.networkId);
    setMemoryLimitMb(model.defaults.memoryLimitMb);
    setRunAsNonRoot(true);
    setReadOnlyRoot(true);
    setGeneration(1);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Container boundary lab"
        title={model.title}
        description={model.description}
        icon={Box}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Workload
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workloads.map((workload) => (
                  <LabChoice
                    key={workload.id}
                    selected={workload.id === result.workload.id}
                    label={workload.label}
                    detail={workload.detail}
                    icon={workload.needsPersistentData ? Database : Box}
                    accent="violet"
                    onClick={() => {
                      setWorkloadId(workload.id);
                      setGeneration(1);
                    }}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Write location
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {model.storageOptions.map((storage) => (
                  <LabChoice
                    key={storage.id}
                    selected={storage.id === result.storage.id}
                    label={storage.label}
                    detail={storage.detail}
                    icon={HardDrive}
                    accent="cyan"
                    onClick={() => {
                      setStorageId(storage.id);
                      setGeneration(1);
                    }}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Network reach
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {model.networkModes.map((network) => (
                  <LabChoice
                    key={network.id}
                    selected={network.id === result.network.id}
                    label={network.label}
                    detail={network.detail}
                    icon={Network}
                    accent="blue"
                    onClick={() => setNetworkId(network.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}>
            <div className="flex items-start gap-3">
              {result.healthy ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Runtime verdict</p>
                <h4 className="mt-1 text-lg font-semibold">
                  {result.healthy ? 'The selected boundaries match the workload' : `${result.warnings.length} boundary decision${result.warnings.length === 1 ? '' : 's'} need attention`}
                </h4>
                {result.warnings.length ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 marker:text-current">
                    {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    Persistence, reachability, resource isolation, and process privilege are explicit.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Container" value={`Generation ${generation}`} detail="A replacement creates a new writable layer" icon={Box} tone="violet" />
            <LabMetric label="Application data" value={result.dataState} detail={result.storage.label} icon={Database} tone={generation > 1 && result.workload.needsPersistentData && !result.storage.survivesReplacement ? 'rose' : 'emerald'} />
            <LabMetric label="Reachability" value={result.network.reachability} detail={result.network.label} icon={Network} tone={reachabilityRank[result.network.reachability] > reachabilityRank[result.workload.requiredReachability] ? 'amber' : 'blue'} />
            <LabMetric label="Memory ceiling" value={memoryLimitMb === 0 ? 'Unbounded' : `${memoryLimitMb} MB`} detail={`Modeled peak: ${result.workload.peakMemoryMb} MB`} icon={Gauge} tone={memoryLimitMb === 0 || memoryLimitMb < result.workload.peakMemoryMb ? 'rose' : 'cyan'} />
          </div>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Lifecycle test</p>
                <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">Replace the running container</h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  The image remains unchanged. Docker removes the old writable layer and creates a new one; mounted storage follows its own lifecycle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGeneration((value) => value + 1)}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:bg-violet-500 dark:hover:bg-violet-400 dark:focus-visible:ring-offset-neutral-900"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Replace container
              </button>
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <LabRange
              label="Memory limit"
              value={memoryLimitMb}
              output={memoryLimitMb === 0 ? 'Unbounded' : `${memoryLimitMb} MB`}
              min={0}
              max={2048}
              step={256}
              accent="rose"
              lowLabel="No container ceiling"
              highLabel="2 GiB"
              onChange={setMemoryLimitMb}
            />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <BoundaryToggle selected={runAsNonRoot} title="Run as non-root" detail={runAsNonRoot ? 'Process starts with an unprivileged image user' : 'Process starts as root inside the container'} onClick={() => setRunAsNonRoot((value) => !value)} />
            <BoundaryToggle selected={readOnlyRoot} title="Read-only image filesystem" detail={readOnlyRoot ? 'Writes must use declared mounts or tmpfs' : 'Runtime can mutate its writable container layer'} onClick={() => setReadOnlyRoot((value) => !value)} />
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function BoundaryToggle({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-28 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        selected
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'
          : 'border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <LearningLabBody>
      <div className={`min-h-48 rounded-md border p-5 ${error ? warningClass : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'}`}>
        <div className="flex items-start gap-3">
          {error ? (
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" />
          )}
          <div>
            <p className="font-semibold">{error ? 'Runtime model unavailable' : 'Loading runtime model'}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">{error ?? 'Preparing the container replacement test.'}</p>
            {error ? (
              <button type="button" onClick={onRetry} className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </LearningLabBody>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100';
