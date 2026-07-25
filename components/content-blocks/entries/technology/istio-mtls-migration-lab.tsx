'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Boxes,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Fingerprint,
  GitCommitHorizontal,
  Layers3,
  LockKeyhole,
  Network,
  Route,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  Waypoints,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/istio-mtls-migration-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/istio/data/mtls-migration-model.json';

type PeerModeId = 'permissive' | 'strict';
type DataPlaneModeId = 'sidecar' | 'ambient';

type Bound = {
  min: number;
  max: number;
  step: number;
};

type PeerMode = {
  id: PeerModeId;
  label: string;
  detail: string;
};

type DataPlaneMode = {
  id: DataPlaneModeId;
  label: string;
  detail: string;
};

type MigrationModel = {
  title: string;
  description: string;
  defaults: {
    totalRps: number;
    legacyPercent: number;
    peerMode: PeerModeId;
    dataPlaneMode: DataPlaneModeId;
    requiresLayer7: boolean;
    waypointEnabled: boolean;
  };
  bounds: {
    totalRps: Bound;
    legacyPercent: Bound;
  };
  peerModes: PeerMode[];
  dataPlaneModes: DataPlaneMode[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return (
    isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step)
    && candidate.max >= candidate.min
    && candidate.step > 0
  );
}

function isPeerModeId(value: unknown): value is PeerModeId {
  return value === 'permissive' || value === 'strict';
}

function isDataPlaneModeId(value: unknown): value is DataPlaneModeId {
  return value === 'sidecar' || value === 'ambient';
}

function isMigrationModel(value: unknown): value is MigrationModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MigrationModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && isFiniteNumber(candidate.defaults?.totalRps)
      && isFiniteNumber(candidate.defaults.legacyPercent)
      && isPeerModeId(candidate.defaults.peerMode)
      && isDataPlaneModeId(candidate.defaults.dataPlaneMode)
      && typeof candidate.defaults.requiresLayer7 === 'boolean'
      && typeof candidate.defaults.waypointEnabled === 'boolean'
      && isBound(candidate.bounds?.totalRps)
      && isBound(candidate.bounds?.legacyPercent)
      && Array.isArray(candidate.peerModes)
      && candidate.peerModes.length === 2
      && candidate.peerModes.every((mode) => (
        isPeerModeId(mode.id)
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
      ))
      && Array.isArray(candidate.dataPlaneModes)
      && candidate.dataPlaneModes.length === 2
      && candidate.dataPlaneModes.every((mode) => (
        isDataPlaneModeId(mode.id)
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
      )),
  );
}

export default function IstioMtlsMigrationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<MigrationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isMigrationModel(payload)) {
          throw new Error('The mTLS migration model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the mTLS migration lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {model ? (
        <MigrationLab model={model} />
      ) : (
        <LearningLab>
          <LearningLabHeader
            eyebrow="mTLS migration lab"
            title="Load the workload coverage model"
            description="The lesson-owned traffic mix, receiving policy, and data-plane choices are loading."
            icon={Fingerprint}
            accent="cyan"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      )}
    </div>
  );
}

function MigrationLab({ model }: { model: MigrationModel }) {
  const [totalRps, setTotalRps] = useState<number>(model.defaults.totalRps);
  const [legacyPercent, setLegacyPercent] = useState<number>(
    model.defaults.legacyPercent,
  );
  const [peerModeId, setPeerModeId] = useState<PeerModeId>(model.defaults.peerMode);
  const [dataPlaneModeId, setDataPlaneModeId] = useState<DataPlaneModeId>(
    model.defaults.dataPlaneMode,
  );
  const [requiresLayer7, setRequiresLayer7] = useState(model.defaults.requiresLayer7);
  const [waypointEnabled, setWaypointEnabled] = useState(
    model.defaults.waypointEnabled,
  );

  const peerMode = model.peerModes.find((item) => item.id === peerModeId)
    ?? model.peerModes[0];
  const dataPlaneMode = model.dataPlaneModes.find(
    (item) => item.id === dataPlaneModeId,
  ) ?? model.dataPlaneModes[0];

  const result = useMemo(() => {
    const plaintextRps = Math.round((totalRps * legacyPercent) / 100);
    const mtlsRps = totalRps - plaintextRps;
    const blockedRps = peerMode.id === 'strict' ? plaintextRps : 0;
    const acceptedRps = totalRps - blockedRps;
    const layer7Ready = !requiresLayer7
      || dataPlaneMode.id === 'sidecar'
      || waypointEnabled;
    const strictReady = legacyPercent === 0 && layer7Ready;

    return {
      acceptedRps,
      blockedRps,
      layer7Ready,
      mtlsRps,
      plaintextRps,
      strictReady,
    };
  }, [
    dataPlaneMode.id,
    legacyPercent,
    peerMode.id,
    requiresLayer7,
    totalRps,
    waypointEnabled,
  ]);

  function reset() {
    setTotalRps(model.defaults.totalRps);
    setLegacyPercent(model.defaults.legacyPercent);
    setPeerModeId(model.defaults.peerMode);
    setDataPlaneModeId(model.defaults.dataPlaneMode);
    setRequiresLayer7(model.defaults.requiresLayer7);
    setWaypointEnabled(model.defaults.waypointEnabled);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="mTLS migration lab"
        title={model.title}
        description={model.description}
        icon={Fingerprint}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Data plane
              </legend>
              <div className="mt-3 grid gap-2">
                {model.dataPlaneModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === dataPlaneMode.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'sidecar' ? Boxes : CloudCog}
                    accent={item.id === 'sidecar' ? 'blue' : 'cyan'}
                    onClick={() => setDataPlaneModeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Receiving policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.peerModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === peerMode.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'strict' ? LockKeyhole : GitCommitHorizontal}
                    accent={item.id === 'strict' ? 'violet' : 'amber'}
                    onClick={() => setPeerModeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Destination traffic"
              value={totalRps}
              output={`${totalRps.toLocaleString()} req/s`}
              {...model.bounds.totalRps}
              accent="blue"
              lowLabel="quiet service"
              highLabel="busy service"
              onChange={setTotalRps}
            />
            <LabRange
              label="Legacy plaintext share"
              value={legacyPercent}
              output={`${legacyPercent}%`}
              {...model.bounds.legacyPercent}
              accent={legacyPercent === 0 ? 'emerald' : 'rose'}
              lowLabel="fully enrolled"
              highLabel="all legacy"
              onChange={setLegacyPercent}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Required policy layer
              </legend>
              <div className="mt-3 grid gap-2">
                <ToggleChoice
                  checked={requiresLayer7}
                  label="Layer 7 behavior required"
                  detail="The workload needs HTTP or gRPC routing, authorization, or telemetry."
                  icon={Route}
                  onChange={setRequiresLayer7}
                />
                {dataPlaneMode.id === 'ambient' && requiresLayer7 ? (
                  <ToggleChoice
                    checked={waypointEnabled}
                    label="Waypoint enabled"
                    detail="A waypoint adds Envoy-based Layer 7 processing for the ambient workload."
                    icon={Waypoints}
                    onChange={setWaypointEnabled}
                  />
                ) : null}
              </div>
            </fieldset>
          </div>
        )}
      >
        <MigrationResult
          dataPlaneMode={dataPlaneMode}
          legacyPercent={legacyPercent}
          peerMode={peerMode}
          requiresLayer7={requiresLayer7}
          result={result}
          totalRps={totalRps}
          waypointEnabled={waypointEnabled}
        />
      </LearningLabBody>
    </LearningLab>
  );
}

function MigrationResult({
  dataPlaneMode,
  legacyPercent,
  peerMode,
  requiresLayer7,
  result,
  totalRps,
  waypointEnabled,
}: {
  dataPlaneMode: DataPlaneMode;
  legacyPercent: number;
  peerMode: PeerMode;
  requiresLayer7: boolean;
  result: {
    acceptedRps: number;
    blockedRps: number;
    layer7Ready: boolean;
    mtlsRps: number;
    plaintextRps: number;
    strictReady: boolean;
  };
  totalRps: number;
  waypointEnabled: boolean;
}) {
  const verdict = migrationVerdict({
    legacyPercent,
    peerMode,
    result,
  });
  const VerdictIcon = verdict.icon;

  return (
    <div className="min-w-0 space-y-6" aria-live="polite">
      <section className={`rounded-md border p-5 ${verdict.tone}`}>
        <div className="flex items-start gap-3">
          <VerdictIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase opacity-70">Cutover verdict</p>
            <h4 className="mt-1 text-xl font-semibold">{verdict.title}</h4>
            <p className="mt-2 text-sm leading-6 opacity-80">{verdict.detail}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <LabMetric
          label="mTLS traffic"
          value={`${result.mtlsRps.toLocaleString()}/s`}
          detail={`${100 - legacyPercent}% from mesh-capable sources`}
          icon={ShieldCheck}
          tone="emerald"
        />
        <LabMetric
          label="Plaintext traffic"
          value={`${result.plaintextRps.toLocaleString()}/s`}
          detail={`${legacyPercent}% from legacy sources`}
          icon={Unplug}
          tone={result.plaintextRps > 0 ? 'amber' : 'neutral'}
        />
        <LabMetric
          label="Accepted"
          value={`${result.acceptedRps.toLocaleString()}/s`}
          detail={`${totalRps - result.acceptedRps} rejected by peer policy`}
          icon={CheckCircle2}
          tone={result.blockedRps === 0 ? 'blue' : 'amber'}
        />
        <LabMetric
          label="Layer 7 path"
          value={result.layer7Ready ? 'Ready' : 'Missing'}
          detail={layer7Detail({
            dataPlaneMode,
            requiresLayer7,
            waypointEnabled,
          })}
          icon={result.layer7Ready ? Layers3 : CircleAlert}
          tone={result.layer7Ready ? 'violet' : 'rose'}
        />
      </div>

      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            Modeled destination path
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {dataPlaneMode.label} data plane with {peerMode.label} receiving policy
          </p>
        </header>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(210px,0.8fr)] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2">
            <TrafficSource
              title="Mesh-capable sources"
              protocol="Istio mutual TLS"
              traffic={`${result.mtlsRps.toLocaleString()} req/s`}
              icon={Fingerprint}
              tone="emerald"
            />
            <TrafficSource
              title="Legacy sources"
              protocol="Plaintext"
              traffic={`${result.plaintextRps.toLocaleString()} req/s`}
              icon={Unplug}
              tone={result.plaintextRps > 0 ? 'amber' : 'neutral'}
            />
          </div>
          <ArrowDown
            aria-hidden="true"
            className="mx-auto h-5 w-5 text-neutral-400 lg:-rotate-90"
          />
          <div className={`rounded-md border p-5 ${result.blockedRps > 0
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50'}`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-70">
              {dataPlaneMode.id === 'sidecar' ? (
                <Boxes aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <Network aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              Enrolled destination
            </div>
            <p className="mt-2 text-lg font-semibold">
              {result.blockedRps > 0
                ? `${result.blockedRps.toLocaleString()} req/s blocked`
                : 'All modeled traffic accepted'}
            </p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {peerMode.id === 'strict'
                ? 'STRICT accepts the mutual-TLS path and rejects the plaintext path.'
                : 'PERMISSIVE accepts both paths while legacy sources are migrated.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Gate
          complete={legacyPercent === 0}
          label="Source enrollment"
          detail={legacyPercent === 0
            ? 'No modeled plaintext sources remain.'
            : `${legacyPercent}% of traffic still bypasses mutual TLS.`}
        />
        <Gate
          complete={result.layer7Ready}
          label="Required policy layer"
          detail={result.layer7Ready
            ? 'The selected data plane provides the required layer.'
            : 'Add an ambient waypoint before expecting Layer 7 behavior.'}
        />
        <Gate
          complete={result.strictReady}
          label="Strict cutover"
          detail={result.strictReady
            ? 'Traffic coverage and policy-layer checks are ready for negative testing.'
            : 'Keep migration controls in place and close the remaining gap.'}
        />
      </section>
    </div>
  );
}

function migrationVerdict({
  legacyPercent,
  peerMode,
  result,
}: {
  legacyPercent: number;
  peerMode: PeerMode;
  result: {
    blockedRps: number;
    layer7Ready: boolean;
    strictReady: boolean;
  };
}) {
  if (!result.layer7Ready) {
    return {
      title: 'The selected data plane is missing Layer 7 enforcement',
      detail: 'Base ambient mode provides the secure Layer 4 overlay. Add a waypoint before relying on HTTP or gRPC routing, authorization, or telemetry.',
      icon: CircleAlert,
      tone: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    };
  }

  if (peerMode.id === 'strict' && result.blockedRps > 0) {
    return {
      title: 'STRICT would reject remaining legacy traffic',
      detail: `${legacyPercent}% of modeled requests still arrives as plaintext. Enroll or deliberately exempt those sources before enforcing the cutover.`,
      icon: ShieldAlert,
      tone: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
    };
  }

  if (peerMode.id === 'permissive' && legacyPercent > 0) {
    return {
      title: 'PERMISSIVE preserves connectivity during migration',
      detail: 'Both mutual-TLS and plaintext paths remain open. Treat this as a temporary compatibility state and measure the callers that still need migration.',
      icon: GitCommitHorizontal,
      tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    };
  }

  if (result.strictReady && peerMode.id === 'permissive') {
    return {
      title: 'The modeled traffic is ready for a strict-policy test',
      detail: 'No plaintext share remains and the required policy layer is present. Run positive and negative requests before changing enforcement.',
      icon: ShieldCheck,
      tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    };
  }

  return {
    title: 'STRICT accepts the fully enrolled path',
    detail: 'All modeled requests arrive through Istio mutual TLS and the required policy layer is present. Continue monitoring rejected traffic and identity.',
    icon: LockKeyhole,
    tone: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
  };
}

function layer7Detail({
  dataPlaneMode,
  requiresLayer7,
  waypointEnabled,
}: {
  dataPlaneMode: DataPlaneMode;
  requiresLayer7: boolean;
  waypointEnabled: boolean;
}) {
  if (!requiresLayer7) return 'Only the secure Layer 4 overlay is required';
  if (dataPlaneMode.id === 'sidecar') return 'Destination sidecar provides Layer 7';
  if (waypointEnabled) return 'Ambient waypoint provides Layer 7';
  return 'Base ambient mode has no waypoint';
}

function ToggleChoice({
  checked,
  detail,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  detail: string;
  icon: typeof Route;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${checked
      ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-600 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-50'
      : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-cyan-600"
      />
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
      </span>
    </label>
  );
}

function TrafficSource({
  icon: Icon,
  protocol,
  title,
  tone,
  traffic,
}: {
  icon: typeof Fingerprint;
  protocol: string;
  title: string;
  tone: 'amber' | 'emerald' | 'neutral';
  traffic: string;
}) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50',
  };

  return (
    <div className={`rounded-md border p-4 ${styles[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums">{traffic}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{protocol}</p>
    </div>
  );
}

function Gate({
  complete,
  detail,
  label,
}: {
  complete: boolean;
  detail: string;
  label: string;
}) {
  return (
    <div className={`rounded-md border p-4 ${complete
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
      : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50'}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
        {complete ? (
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        ) : (
          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        )}
        {label}
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
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
    <div className="p-5 md:p-6">
      <div className={`rounded-md border p-5 ${error
        ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
        : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'}`}
      >
        <div className="flex items-start gap-3">
          {error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Fingerprint
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 animate-pulse motion-reduce:animate-none"
            />
          )}
          <div>
            <p className="font-semibold">
              {error ? 'Migration model unavailable' : 'Loading workload coverage'}
            </p>
            <p className="mt-1 text-sm leading-6 opacity-80">
              {error ?? 'Preparing the mTLS traffic paths and cutover checks.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Fingerprint aria-hidden="true" className="h-4 w-4" />
                Retry loading
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
