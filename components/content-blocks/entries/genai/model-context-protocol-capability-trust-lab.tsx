'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Cable,
  CircleAlert,
  CircleCheck,
  Database,
  Eye,
  FileQuestion,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Server,
  ShieldCheck,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type PrimitiveId = 'resources' | 'prompts' | 'tools';
type ToolRisk = 'none' | 'read' | 'write' | 'destructive';
type RowState = 'exposed' | 'gated' | 'hidden' | 'unavailable' | 'blocked';

interface Primitive {
  id: PrimitiveId;
  label: string;
  owner: string;
  detail: string;
}

interface ServerProfile {
  id: string;
  label: string;
  detail: string;
  transport: string;
  protocolVersion: string;
  trustRank: number;
  trustLabel: string;
  capabilities: PrimitiveId[];
  toolRisk: ToolRisk;
  trustSignals: string[];
  missingSignals: string[];
}

interface HostPolicy {
  id: string;
  label: string;
  detail: string;
  minimumTrustRank: number;
  exposedCapabilities: PrimitiveId[];
  maximumToolRisk: ToolRisk;
  approval: string;
}

interface CapabilityTrustData {
  title: string;
  description: string;
  supportedVersions: string[];
  defaultServerId: string;
  defaultPolicyId: string;
  primitives: Primitive[];
  servers: ServerProfile[];
  policies: HostPolicy[];
}

const BLOCK_ID = 'genai/model-context-protocol-capability-trust-lab';

const riskRank: Record<ToolRisk, number> = {
  none: 0,
  read: 1,
  write: 2,
  destructive: 3,
};

const primitiveIcons: Record<PrimitiveId, LucideIcon> = {
  resources: Database,
  prompts: Braces,
  tools: Workflow,
};

const stateStyles: Record<RowState, string> = {
  exposed: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  gated: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  hidden: 'border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
  unavailable: 'border-neutral-200 bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400',
  blocked: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
};

function isPrimitiveId(value: unknown): value is PrimitiveId {
  return value === 'resources' || value === 'prompts' || value === 'tools';
}

function isToolRisk(value: unknown): value is ToolRisk {
  return value === 'none' || value === 'read' || value === 'write' || value === 'destructive';
}

function isCapabilityTrustData(value: unknown): value is CapabilityTrustData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapabilityTrustData>;
  return Boolean(
    candidate.title
      && candidate.description
      && Array.isArray(candidate.supportedVersions)
      && candidate.supportedVersions.length > 0
      && candidate.defaultServerId
      && candidate.defaultPolicyId
      && Array.isArray(candidate.primitives)
      && candidate.primitives.length === 3
      && candidate.primitives.every((primitive) => (
        isPrimitiveId(primitive.id)
        && typeof primitive.label === 'string'
        && typeof primitive.owner === 'string'
        && typeof primitive.detail === 'string'
      ))
      && Array.isArray(candidate.servers)
      && candidate.servers.length > 0
      && candidate.servers.every((server) => (
        typeof server.id === 'string'
        && typeof server.label === 'string'
        && typeof server.transport === 'string'
        && typeof server.protocolVersion === 'string'
        && typeof server.trustRank === 'number'
        && Array.isArray(server.capabilities)
        && server.capabilities.every(isPrimitiveId)
        && isToolRisk(server.toolRisk)
        && Array.isArray(server.trustSignals)
        && Array.isArray(server.missingSignals)
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.minimumTrustRank === 'number'
        && Array.isArray(policy.exposedCapabilities)
        && policy.exposedCapabilities.every(isPrimitiveId)
        && isToolRisk(policy.maximumToolRisk)
      )),
  );
}

export default function ModelContextProtocolCapabilityTrustLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapabilityTrustData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No capability and trust model was supplied.');
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
        if (!isCapabilityTrustData(payload)) {
          throw new Error('Capability and trust data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LabError detail={error} />;
  if (!data) return <LabLoading />;
  return <CapabilityTrustLab data={data} />;
}

function CapabilityTrustLab({ data }: { data: CapabilityTrustData }) {
  const initialServer = data.servers.find((item) => item.id === data.defaultServerId)
    ?? data.servers[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaultPolicyId)
    ?? data.policies[0];
  const [serverId, setServerId] = useState(initialServer.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);

  const server = data.servers.find((item) => item.id === serverId) ?? data.servers[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const model = useMemo(() => {
    const versionAccepted = data.supportedVersions.includes(server.protocolVersion);
    const trustAccepted = server.trustRank >= policy.minimumTrustRank;
    const ready = versionAccepted && trustAccepted;

    const rows = data.primitives.map((primitive) => {
      const advertised = server.capabilities.includes(primitive.id);
      const policyExposes = policy.exposedCapabilities.includes(primitive.id);
      let state: RowState = 'exposed';
      let consequence = 'Available through the host policy for this session.';

      if (!versionAccepted || !trustAccepted) {
        state = 'blocked';
        consequence = !versionAccepted
          ? 'The client disconnects because no supported protocol revision was negotiated.'
          : 'The server does not meet the minimum provenance required by this host policy.';
      } else if (!advertised) {
        state = 'unavailable';
        consequence = 'The server did not advertise this capability.';
      } else if (!policyExposes) {
        state = 'hidden';
        consequence = 'The host understands the capability but keeps it away from the model.';
      } else if (primitive.id === 'tools') {
        const exceedsRisk = riskRank[server.toolRisk] > riskRank[policy.maximumToolRisk];
        state = 'gated';
        consequence = exceedsRisk
          ? `The host risk limit is ${policy.maximumToolRisk}; ${server.toolRisk} tools stay blocked.`
          : `${policy.approval}. Capability support alone does not execute the tool.`;
      }

      return { ...primitive, advertised, consequence, state };
    });

    const modelVisible = rows.filter((row) => row.state === 'exposed' || row.state === 'gated');
    const toolRow = rows.find((row) => row.id === 'tools');

    return {
      modelVisible,
      ready,
      rows,
      toolAuthority: toolRow?.state === 'gated' ? policy.approval : 'No tool authority',
      trustAccepted,
      versionAccepted,
    };
  }, [data.primitives, data.supportedVersions, policy, server]);

  function reset() {
    setServerId(initialServer.id);
    setPolicyId(initialPolicy.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capability and trust lab"
          title={data.title}
          description={data.description}
          icon={Cable}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Server connection
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.servers.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === server.id}
                      label={item.label}
                      detail={`${item.transport} · ${item.trustLabel}`}
                      icon={Server}
                      accent={item.trustRank === 0 ? 'rose' : item.transport === 'stdio' ? 'cyan' : 'blue'}
                      onClick={() => setServerId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Host exposure policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ShieldCheck}
                      accent={item.id === 'inspect-only' ? 'blue' : item.id === 'bounded-assist' ? 'violet' : 'amber'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Session state"
                value={model.ready ? 'Ready' : 'Blocked'}
                detail={model.ready ? 'Handshake plus host trust policy passed' : 'Normal operations must not begin'}
                icon={model.ready ? CircleCheck : XCircle}
                tone={model.ready ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Negotiated version"
                value={server.protocolVersion}
                detail={model.versionAccepted ? 'Supported by this client' : 'No compatible revision'}
                icon={Braces}
                tone={model.versionAccepted ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Model-visible"
                value={`${model.modelVisible.length} / ${data.primitives.length}`}
                detail="Host exposure, not server advertisement"
                icon={Eye}
                tone={model.modelVisible.length > 0 ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Tool authority"
                value={model.toolAuthority}
                detail={`Server tool risk: ${server.toolRisk}`}
                icon={LockKeyhole}
                tone={model.toolAuthority === 'No tool authority' ? 'neutral' : 'amber'}
              />
            </div>

            <HandshakeTrace
              versionAccepted={model.versionAccepted}
              trustAccepted={model.trustAccepted}
              ready={model.ready}
              server={server}
            />

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Capability overlay
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    Advertisement, exposure, and execution are separate states
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {policy.label}
                </span>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {model.rows.map((row) => {
                  const Icon = primitiveIcons[row.id];
                  return (
                    <article key={row.id} className={`min-w-0 rounded-md border p-4 ${stateStyles[row.state]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                          <h5 className="font-semibold">{row.label}</h5>
                        </div>
                        <span className="shrink-0 rounded border border-current px-2 py-1 text-[11px] font-semibold uppercase">
                          {row.state}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium opacity-75">{row.owner}</p>
                      <p className="mt-3 text-sm leading-6">{row.consequence}</p>
                      <p className="mt-3 text-xs leading-5 opacity-75">
                        Server advertised: {row.advertised ? 'yes' : 'no'}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <SignalList
                title="Evidence available to the host"
                items={server.trustSignals}
                icon={BadgeCheck}
                tone="positive"
              />
              <SignalList
                title="What the handshake does not prove"
                items={server.missingSignals}
                icon={FileQuestion}
                tone="caution"
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function HandshakeTrace({
  ready,
  server,
  trustAccepted,
  versionAccepted,
}: {
  ready: boolean;
  server: ServerProfile;
  trustAccepted: boolean;
  versionAccepted: boolean;
}) {
  const steps = [
    { label: 'Initialize', detail: 'Client proposes version and capabilities', status: 'sent' },
    {
      label: 'Version',
      detail: versionAccepted ? `${server.protocolVersion} accepted` : `${server.protocolVersion} rejected`,
      status: versionAccepted ? 'pass' : 'fail',
    },
    {
      label: 'Host trust',
      detail: trustAccepted ? `${server.trustLabel} meets policy` : `${server.trustLabel} is below policy`,
      status: trustAccepted ? 'pass' : 'fail',
    },
    {
      label: 'Operations',
      detail: ready ? 'Send initialized; apply exposure policy' : 'Disconnect before normal requests',
      status: ready ? 'pass' : 'fail',
    },
  ];

  return (
    <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Connection trace
      </p>
      <ol className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
        {steps.map((step, index) => (
          <li key={step.label} className="contents">
            <div className={`rounded-md border p-3 ${step.status === 'fail'
              ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              : step.status === 'pass'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                : 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                {step.status === 'fail'
                  ? <XCircle aria-hidden="true" className="h-4 w-4" />
                  : step.status === 'pass'
                    ? <CircleCheck aria-hidden="true" className="h-4 w-4" />
                    : <KeyRound aria-hidden="true" className="h-4 w-4" />}
                {step.label}
              </div>
              <p className="mt-2 text-sm font-medium leading-5">{step.detail}</p>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight aria-hidden="true" className="hidden h-5 w-5 self-center text-neutral-400 md:block" />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SignalList({
  icon: Icon,
  items,
  title,
  tone,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
  tone: 'positive' | 'caution';
}) {
  return (
    <section className={`rounded-md border p-4 ${tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
      : 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20'}`}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className={`h-4 w-4 ${tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
        {title}
      </h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="status" className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading capability and trust model...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div role="alert" className="flex min-h-48 items-center justify-center gap-3 text-sm text-rose-700 dark:text-rose-300">
            <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span>{detail}</span>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
