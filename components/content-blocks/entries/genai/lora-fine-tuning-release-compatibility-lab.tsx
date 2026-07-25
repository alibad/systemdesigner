'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  FileWarning,
  GitCompareArrows,
  PackageCheck,
  ServerCog,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type DeploymentMode = {
  id: string;
  label: string;
  detail: string;
  requiresLoadedBase: boolean;
};

type AdapterArtifact = {
  id: string;
  label: string;
  detail: string;
  architecture: string;
  baseRevision: string;
  tokenizerDigest: string;
  templateDigest: string;
  targetModulesDigest: string;
  adapterFormat: string;
  rank: number;
  signedManifest: boolean;
  evaluationPassed: boolean;
  rollbackReady: boolean;
  mergeBaseVerified: boolean;
  mergedArtifactReady: boolean;
};

type RuntimeTarget = {
  id: string;
  label: string;
  detail: string;
  architecture: string;
  loadedBaseRevision: string | null;
  tokenizerDigest: string;
  templateDigest: string;
  supportedTargetModuleDigests: string[];
  supportedAdapterFormats: string[];
  supportsDynamicAdapters: boolean;
  supportsMergedCheckpoints: boolean;
};

type CompatibilityData = {
  blockId: string;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    adapterId: string;
    runtimeId: string;
    modeId: string;
  };
  modes: DeploymentMode[];
  adapters: AdapterArtifact[];
  runtimes: RuntimeTarget[];
};

type Gate = {
  id: string;
  label: string;
  value: string;
  requirement: string;
  passed: boolean;
};

const BLOCK_ID = 'genai/lora-fine-tuning-release-compatibility-lab';
const DEFAULT_DATA_FILE = '/api/content/genai/lora-fine-tuning/data/release-compatibility-model.json';

function isCompatibilityData(value: unknown): value is CompatibilityData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CompatibilityData>;

  return Boolean(
    data.blockId === BLOCK_ID
      && data.title
      && data.description
      && data.modelNote
      && data.defaults
      && Array.isArray(data.modes)
      && data.modes.length >= 2
      && data.modes.every((mode) => (
        typeof mode.id === 'string'
          && typeof mode.requiresLoadedBase === 'boolean'
      ))
      && Array.isArray(data.adapters)
      && data.adapters.length >= 3
      && data.adapters.every((adapter) => (
        typeof adapter.id === 'string'
          && typeof adapter.baseRevision === 'string'
          && typeof adapter.tokenizerDigest === 'string'
          && typeof adapter.templateDigest === 'string'
          && typeof adapter.targetModulesDigest === 'string'
          && typeof adapter.adapterFormat === 'string'
          && typeof adapter.rank === 'number'
          && typeof adapter.signedManifest === 'boolean'
          && typeof adapter.evaluationPassed === 'boolean'
          && typeof adapter.rollbackReady === 'boolean'
          && typeof adapter.mergeBaseVerified === 'boolean'
          && typeof adapter.mergedArtifactReady === 'boolean'
      ))
      && Array.isArray(data.runtimes)
      && data.runtimes.length >= 4
      && data.runtimes.every((runtime) => (
        typeof runtime.id === 'string'
          && (typeof runtime.loadedBaseRevision === 'string' || runtime.loadedBaseRevision === null)
          && Array.isArray(runtime.supportedTargetModuleDigests)
          && Array.isArray(runtime.supportedAdapterFormats)
          && typeof runtime.supportsDynamicAdapters === 'boolean'
          && typeof runtime.supportsMergedCheckpoints === 'boolean'
      )),
  );
}

export default function LoraFineTuningReleaseCompatibilityLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adapterId, setAdapterId] = useState('');
  const [runtimeId, setRuntimeId] = useState('');
  const [modeId, setModeId] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isCompatibilityData(payload)) throw new Error('Release compatibility data is incomplete.');

        setData(payload);
        setAdapterId(payload.defaults.adapterId);
        setRuntimeId(payload.defaults.runtimeId);
        setModeId(payload.defaults.modeId);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load release compatibility data.');
      }
    }

    void loadData();
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const adapter = data?.adapters.find((item) => item.id === adapterId) ?? data?.adapters[0];
  const runtime = data?.runtimes.find((item) => item.id === runtimeId) ?? data?.runtimes[0];
  const mode = data?.modes.find((item) => item.id === modeId) ?? data?.modes[0];

  const result = useMemo(() => {
    if (!adapter || !runtime || !mode) return null;

    const sharedGates: Gate[] = [
      {
        id: 'architecture',
        label: 'Architecture',
        value: `${adapter.architecture} -> ${runtime.architecture}`,
        requirement: 'exact architecture contract',
        passed: adapter.architecture === runtime.architecture,
      },
      {
        id: 'tokenizer',
        label: 'Tokenizer',
        value: `${adapter.tokenizerDigest} -> ${runtime.tokenizerDigest}`,
        requirement: 'exact tokenizer digest',
        passed: adapter.tokenizerDigest === runtime.tokenizerDigest,
      },
      {
        id: 'template',
        label: 'Chat template',
        value: `${adapter.templateDigest} -> ${runtime.templateDigest}`,
        requirement: 'exact template digest',
        passed: adapter.templateDigest === runtime.templateDigest,
      },
      {
        id: 'evaluation',
        label: 'Held-out evidence',
        value: adapter.evaluationPassed ? 'Passed' : 'Incomplete',
        requirement: 'task, slice, safety, and regression gates',
        passed: adapter.evaluationPassed,
      },
      {
        id: 'signature',
        label: 'Artifact integrity',
        value: adapter.signedManifest ? 'Signed' : 'Unsigned',
        requirement: 'signed manifest and verified digest',
        passed: adapter.signedManifest,
      },
      {
        id: 'rollback',
        label: 'Rollback',
        value: adapter.rollbackReady ? 'Ready' : 'Missing',
        requirement: 'immutable prior manifest',
        passed: adapter.rollbackReady,
      },
    ];

    const modeGates: Gate[] = mode.id === 'dynamic'
      ? [
          {
            id: 'dynamic-support',
            label: 'Runtime mode',
            value: runtime.supportsDynamicAdapters ? 'Dynamic supported' : 'Merged only',
            requirement: 'dynamic adapter loading',
            passed: runtime.supportsDynamicAdapters,
          },
          {
            id: 'base',
            label: 'Loaded base',
            value: `${adapter.baseRevision} -> ${runtime.loadedBaseRevision ?? 'none'}`,
            requirement: 'exact base revision',
            passed: adapter.baseRevision === runtime.loadedBaseRevision,
          },
          {
            id: 'target-modules',
            label: 'Target modules',
            value: adapter.targetModulesDigest,
            requirement: 'runtime supports the adapter projection contract',
            passed: runtime.supportedTargetModuleDigests.includes(adapter.targetModulesDigest),
          },
          {
            id: 'format',
            label: 'Adapter format',
            value: adapter.adapterFormat,
            requirement: 'runtime loader supports this format',
            passed: runtime.supportedAdapterFormats.includes(adapter.adapterFormat),
          },
        ]
      : [
          {
            id: 'merged-support',
            label: 'Runtime mode',
            value: runtime.supportsMergedCheckpoints ? 'Merged supported' : 'Dynamic only',
            requirement: 'full merged-checkpoint loading',
            passed: runtime.supportsMergedCheckpoints,
          },
          {
            id: 'merge-base',
            label: 'Merge input',
            value: adapter.mergeBaseVerified ? adapter.baseRevision : 'Unverified',
            requirement: 'merge executed against the exact base',
            passed: adapter.mergeBaseVerified,
          },
          {
            id: 'merged-artifact',
            label: 'Merged artifact',
            value: adapter.mergedArtifactReady ? 'Built and evaluated' : 'Missing',
            requirement: 'immutable merged checkpoint',
            passed: adapter.mergedArtifactReady,
          },
        ];

    const gates = [...modeGates, ...sharedGates];
    const failures = gates.filter((gate) => !gate.passed);
    const ready = failures.length === 0;
    const consequence = ready
      ? mode.id === 'dynamic'
        ? 'Release can proceed to a bounded canary. Route only to the pinned base runtime and keep the previous adapter manifest available.'
        : 'The merged checkpoint satisfies this fixture. Canary and roll back it as a complete model artifact, not as a swappable delta.'
      : `Hold release. The first failed boundary is ${failures[0]?.label.toLowerCase()}; ${failures.length} of ${gates.length} gates fail.`;

    return {
      consequence,
      failures,
      gates,
      passedCount: gates.length - failures.length,
      ready,
    };
  }, [adapter, mode, runtime]);

  function reset() {
    if (!data) return;
    setAdapterId(data.defaults.adapterId);
    setRuntimeId(data.defaults.runtimeId);
    setModeId(data.defaults.modeId);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Adapter release contract"
          title={data?.title ?? 'Treat the adapter and runtime as one release contract'}
          description={data?.description ?? 'Loading adapter and runtime manifests...'}
          icon={GitCompareArrows}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !adapter || !runtime || !mode || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Adapter artifact
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.adapters.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === adapter.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.evaluationPassed && item.signedManifest ? PackageCheck : FileWarning}
                        accent={item.id === 'support-v4' ? 'emerald' : item.id === 'support-experimental' ? 'amber' : 'violet'}
                        onClick={() => setAdapterId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Deployment mode
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {data.modes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === mode.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'dynamic' ? Boxes : PackageCheck}
                        accent={item.id === 'dynamic' ? 'cyan' : 'violet'}
                        onClick={() => setModeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Serving target
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.runtimes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === runtime.id}
                        label={item.label}
                        detail={item.detail}
                        icon={ServerCog}
                        accent={item.id === 'shared-base-v3' ? 'emerald' : item.id === 'merged-only-runtime' ? 'violet' : 'rose'}
                        onClick={() => setRuntimeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Adapter rank"
                value={`r = ${adapter.rank}`}
                detail={adapter.targetModulesDigest}
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Deployment"
                value={mode.id === 'dynamic' ? 'Dynamic' : 'Merged'}
                detail={mode.requiresLoadedBase ? 'runtime loads base plus delta' : 'runtime loads one full checkpoint'}
                icon={ServerCog}
                tone="blue"
              />
              <LabMetric
                label="Gate evidence"
                value={`${result.passedCount}/${result.gates.length}`}
                detail={`${result.failures.length} release blocker${result.failures.length === 1 ? '' : 's'}`}
                icon={ShieldCheck}
                tone={result.ready ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Decision"
                value={result.ready ? 'Canary' : 'Hold'}
                detail={result.ready ? 'bounded exposure only' : 'repair contract before exposure'}
                icon={result.ready ? CheckCircle2 : AlertTriangle}
                tone={result.ready ? 'emerald' : 'rose'}
              />
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Release path
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <PathNode
                  eyebrow="Training output"
                  title={adapter.label}
                  detail={`${adapter.baseRevision} / ${adapter.adapterFormat}`}
                  tone="violet"
                />
                <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 md:block" />
                <PathNode
                  eyebrow="Packaging boundary"
                  title={mode.label}
                  detail={mode.id === 'dynamic' ? 'Keep base and delta separate' : 'Materialize one full checkpoint'}
                  tone="cyan"
                />
                <ArrowRight aria-hidden="true" className="mx-auto hidden h-5 w-5 text-neutral-400 md:block" />
                <PathNode
                  eyebrow="Serving target"
                  title={runtime.label}
                  detail={runtime.loadedBaseRevision ?? 'No separately loaded base'}
                  tone={result.ready ? 'emerald' : 'rose'}
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Independent gates
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Compatibility is necessary, but not sufficient
                  </h4>
                </div>
                <BadgeCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-400" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.gates.map((gate) => (
                  <div
                    key={gate.id}
                    className={`rounded-md border p-4 ${
                      gate.passed
                        ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25'
                        : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {gate.passed
                        ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        : <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {gate.label}
                        </p>
                        <p className="mt-1 break-words font-mono text-xs leading-5 text-neutral-700 dark:text-neutral-200">
                          {gate.value}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          Requires {gate.requirement}.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`mt-6 rounded-md border p-5 ${
              result.ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {result.ready
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
                  <p className="mt-1 text-sm font-semibold leading-6">{result.consequence}</p>
                </div>
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {data.modelNote}
            </p>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function PathNode({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  tone: 'cyan' | 'violet' | 'emerald' | 'rose';
}) {
  const styles = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{eyebrow}</p>
      <p className="mt-1 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 break-words text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {error ? 'The compatibility model could not be loaded.' : 'Loading release contracts...'}
        </p>
        {error ? (
          <>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-white dark:text-neutral-950"
            >
              Retry
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
