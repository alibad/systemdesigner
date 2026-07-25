'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  Cable,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Code2,
  Database,
  FileText,
  KeyRound,
  LoaderCircle,
  Route,
  Server,
  ShieldCheck,
  Workflow,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Boundary = 'local' | 'remote';
type Capability = 'resources' | 'prompts' | 'tools' | 'tasks';
type Readiness = 'ready' | 'review' | 'blocked';

type Workload = {
  id: string;
  label: string;
  detail: string;
  boundary: Boundary;
  needsAuthorization: boolean;
  requiresStreaming: boolean;
  requiredCapabilities: Capability[];
  risk: string;
};

type Transport = {
  id: string;
  label: string;
  detail: string;
  boundary: Boundary;
  supportsStreaming: boolean;
  authenticationModel: string;
  path: string[];
  safeguards: string[];
};

type CapabilityProfile = {
  id: string;
  label: string;
  detail: string;
  capabilities: Capability[];
};

type TransportCapabilityData = {
  title: string;
  description: string;
  defaultWorkloadId: string;
  defaultTransportId: string;
  defaultProfileId: string;
  supportedProtocolVersion: string;
  workloads: Workload[];
  transports: Transport[];
  profiles: CapabilityProfile[];
};

const capabilityOrder: Capability[] = ['resources', 'prompts', 'tools', 'tasks'];

const capabilityMeta: Record<Capability, { label: string; icon: LucideIcon }> = {
  resources: { label: 'Resources', icon: Database },
  prompts: { label: 'Prompts', icon: Braces },
  tools: { label: 'Tools', icon: Wrench },
  tasks: { label: 'Tasks', icon: Workflow },
};

const statusStyles: Record<Readiness, string> = {
  ready:
    'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
  review:
    'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
  blocked:
    'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
};

function isCapability(value: unknown): value is Capability {
  return capabilityOrder.includes(value as Capability);
}

function isBoundary(value: unknown): value is Boundary {
  return value === 'local' || value === 'remote';
}

function isTransportCapabilityData(value: unknown): value is TransportCapabilityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TransportCapabilityData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultWorkloadId
      && candidate.defaultTransportId
      && candidate.defaultProfileId
      && candidate.supportedProtocolVersion
      && Array.isArray(candidate.workloads)
      && candidate.workloads.length > 0
      && candidate.workloads.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && isBoundary(item.boundary)
        && Array.isArray(item.requiredCapabilities)
        && item.requiredCapabilities.every(isCapability)
      ))
      && Array.isArray(candidate.transports)
      && candidate.transports.length > 0
      && candidate.transports.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && isBoundary(item.boundary)
        && Array.isArray(item.path)
        && item.path.length === 3
        && Array.isArray(item.safeguards)
      ))
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && candidate.profiles.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && Array.isArray(item.capabilities)
        && item.capabilities.every(isCapability)
      )),
  );
}

export default function ModelContextProtocolTransportCapabilityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<TransportCapabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No connection model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isTransportCapabilityData(payload)) {
          throw new Error('The connection model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the connection model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LabLoadState
        error={error}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  return <ConnectionComposer data={data} />;
}

function ConnectionComposer({ data }: { data: TransportCapabilityData }) {
  const initialWorkload = data.workloads.find((item) => item.id === data.defaultWorkloadId)
    ?? data.workloads[0];
  const initialTransport = data.transports.find((item) => item.id === data.defaultTransportId)
    ?? data.transports[0];
  const initialProfile = data.profiles.find((item) => item.id === data.defaultProfileId)
    ?? data.profiles[0];

  const [workloadId, setWorkloadId] = useState(initialWorkload.id);
  const [transportId, setTransportId] = useState(initialTransport.id);
  const [profileId, setProfileId] = useState(initialProfile.id);

  const workload = data.workloads.find((item) => item.id === workloadId) ?? data.workloads[0];
  const transport = data.transports.find((item) => item.id === transportId) ?? data.transports[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];

  const model = useMemo(() => {
    const transportFits = workload.boundary === transport.boundary;
    const streamingFits = !workload.requiresStreaming || transport.supportsStreaming;
    const missing = workload.requiredCapabilities.filter(
      (capability) => !profile.capabilities.includes(capability),
    );
    const extra = profile.capabilities.filter(
      (capability) => !workload.requiredCapabilities.includes(capability),
    );
    const ready = transportFits && streamingFits && missing.length === 0;
    const readiness: Readiness = !ready ? 'blocked' : extra.length > 0 ? 'review' : 'ready';

    const verdict = !transportFits
      ? `${transport.label} places the server at the wrong process boundary for ${workload.label.toLowerCase()}. Choose the transport that matches who owns process launch and network access.`
      : !streamingFits
        ? 'This workload needs a streaming response path that the selected transport profile does not provide.'
        : missing.length > 0
          ? `Initialization can succeed, but the session cannot perform the workload because ${missing.map((item) => capabilityMeta[item].label).join(' and ')} were not negotiated.`
          : extra.length > 0
            ? `The session can run, but ${extra.map((item) => capabilityMeta[item].label).join(' and ')} expand the protocol surface without serving this workload. Remove them unless another explicit use case needs them.`
            : `The process boundary and capability envelope fit the workload. The host must still enforce provenance, consent, authorization, and operation policy.`;

    return {
      extra,
      missing,
      readiness,
      ready,
      streamingFits,
      transportFits,
      verdict,
    };
  }, [profile, transport, workload]);

  const reset = () => {
    setWorkloadId(initialWorkload.id);
    setTransportId(initialTransport.id);
    setProfileId(initialProfile.id);
  };

  const StatusIcon = model.readiness === 'ready'
    ? CheckCircle2
    : model.readiness === 'review'
      ? CircleAlert
      : XCircle;

  return (
    <div data-content-block="technology/model-context-protocol-transport-capability-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Transport and capability composer"
          title="Build the smallest viable MCP connection"
          description="Choose a workload, place the server across the correct process boundary, and negotiate only the features the session actually needs."
          icon={Cable}
          accent="cyan"
          onReset={reset}
        />

        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Workload boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {data.workloads.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === workload.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.boundary === 'local' ? Code2 : Cloud}
                      accent={item.boundary === 'local' ? 'cyan' : 'blue'}
                      onClick={() => setWorkloadId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  2. Transport
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.transports.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === transport.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.boundary === 'local' ? Cable : Route}
                      accent={item.boundary === 'local' ? 'cyan' : 'blue'}
                      onClick={() => setTransportId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  3. Capability envelope
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'everything' ? CircleAlert : Workflow}
                      accent={item.id === 'everything' ? 'amber' : 'violet'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Connection"
                value={model.transportFits ? 'Boundary fits' : 'Boundary mismatch'}
                detail={`${workload.boundary === 'local' ? 'Local process' : 'Remote service'} workload`}
                icon={model.transportFits ? CheckCircle2 : XCircle}
                tone={model.transportFits ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Capability coverage"
                value={model.missing.length === 0 ? 'Complete' : `${model.missing.length} missing`}
                detail={`${profile.capabilities.length} feature${profile.capabilities.length === 1 ? '' : 's'} advertised`}
                icon={model.missing.length === 0 ? ShieldCheck : CircleAlert}
                tone={model.missing.length === 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Authorization model"
                value={workload.needsAuthorization ? 'Protected remote' : 'Local process'}
                detail={transport.authenticationModel}
                icon={workload.needsAuthorization ? KeyRound : Server}
                tone={workload.needsAuthorization ? 'violet' : 'cyan'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Wire path
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {transport.label}
                  </h4>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  model.transportFits
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                }`}>
                  {model.transportFits ? 'Process ownership aligned' : 'Wrong boundary'}
                </span>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-3">
                {transport.path.map((step, index) => (
                  <li key={step} className="relative rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                      {index + 1}
                    </span>
                    <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{step}</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                      {index === 0 ? 'Owns the request' : index === 1 ? 'Carries JSON-RPC' : 'Publishes capabilities'}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Negotiated feature map
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Required does not mean automatically authorized
                  </h4>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Protocol {data.supportedProtocolVersion}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {capabilityOrder.map((capability) => {
                  const meta = capabilityMeta[capability];
                  const Icon = meta.icon;
                  const required = workload.requiredCapabilities.includes(capability);
                  const enabled = profile.capabilities.includes(capability);
                  const state = required && !enabled
                    ? 'Missing'
                    : required && enabled
                      ? 'Required and negotiated'
                      : enabled
                        ? 'Negotiated but unused'
                        : 'Not negotiated';
                  const tone = required && !enabled
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : required && enabled
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : enabled
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                        : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900';

                  return (
                    <div key={capability} className={`rounded-md border p-4 ${tone}`}>
                      <Icon aria-hidden="true" className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
                      <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{meta.label}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{state}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={`rounded-md border p-5 ${statusStyles[model.readiness]}`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {model.readiness === 'ready'
                      ? 'Viable minimal connection'
                      : model.readiness === 'review'
                        ? 'Viable with excess surface'
                        : 'Connection contract blocked'}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6">{model.verdict}</p>
                  <p className="mt-3 text-xs leading-5 opacity-80">Primary risk: {workload.risk}</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FileText aria-hidden="true" className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Transport safeguards that remain after negotiation
                </h4>
              </div>
              <ul className="mt-4 grid gap-3 md:grid-cols-3">
                {transport.safeguards.map((safeguard) => (
                  <li key={safeguard} className="flex gap-3 rounded-md bg-neutral-50 p-3 text-sm leading-6 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                    <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{safeguard}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <section className="not-prose my-7 min-h-[320px] overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
        {error ? (
          <>
            <CircleAlert aria-hidden="true" className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Connection model unavailable</p>
            <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <LoaderCircle aria-hidden="true" className="h-7 w-7 text-cyan-600 motion-safe:animate-spin dark:text-cyan-400" />
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Loading connection composer...</p>
          </>
        )}
      </div>
    </section>
  );
}
