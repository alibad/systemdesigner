'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Eye,
  EyeOff,
  Fingerprint,
  Globe2,
  LockKeyhole,
  Network,
  Route,
  Server,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Direction = {
  id: string;
  label: string;
  detail: string;
  requester: string;
  proxy: string;
  destination: string;
  purpose: string;
};

type Layer = {
  id: string;
  label: string;
  detail: string;
  kind: 'transport' | 'application';
  inspection: string;
  routing: string;
  loadSignal: string;
};

type TlsMode = {
  id: string;
  label: string;
  detail: string;
  inspectionAtProxy: boolean;
  downstream: string;
  upstream: string;
};

type IdentityPolicy = {
  id: string;
  label: string;
  detail: string;
  safe: boolean;
  result: string;
};

type RequestPathModel = {
  title: string;
  description: string;
  defaults: {
    directionId: string;
    layerId: string;
    tlsModeId: string;
    identityPolicyId: string;
  };
  directions: Direction[];
  layers: Layer[];
  tlsModes: TlsMode[];
  identityPolicies: IdentityPolicy[];
};

const BLOCK_ID = 'technology/proxies-load-balancing-request-path-lab';

function isRequestPathModel(value: unknown): value is RequestPathModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestPathModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.directionId
      && candidate.defaults.layerId
      && candidate.defaults.tlsModeId
      && candidate.defaults.identityPolicyId
      && Array.isArray(candidate.directions)
      && candidate.directions.length > 0
      && Array.isArray(candidate.layers)
      && candidate.layers.length > 0
      && Array.isArray(candidate.tlsModes)
      && candidate.tlsModes.length > 0
      && Array.isArray(candidate.identityPolicies)
      && candidate.identityPolicies.length > 0,
  );
}

export default function ProxiesLoadBalancingRequestPathLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RequestPathModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No request-path model was supplied.');
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
        if (!isRequestPathModel(payload)) {
          throw new Error('The request-path model is incomplete.');
        }
        setData(payload);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the request-path lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return <LabState title="Request-path lab unavailable" detail={error} tone="error" />;
  }
  if (!data) {
    return (
      <LabState
        title="Loading request-path lab"
        detail="Preparing proxy boundaries and TLS modes..."
      />
    );
  }
  return <RequestPathWorkbench data={data} />;
}

function RequestPathWorkbench({ data }: { data: RequestPathModel }) {
  const [directionId, setDirectionId] = useState(data.defaults.directionId);
  const [layerId, setLayerId] = useState(data.defaults.layerId);
  const [tlsModeId, setTlsModeId] = useState(data.defaults.tlsModeId);
  const [identityPolicyId, setIdentityPolicyId] = useState(data.defaults.identityPolicyId);

  const direction = data.directions.find((item) => item.id === directionId) ?? data.directions[0];
  const layer = data.layers.find((item) => item.id === layerId) ?? data.layers[0];
  const tlsMode = data.tlsModes.find((item) => item.id === tlsModeId) ?? data.tlsModes[0];
  const identityPolicy =
    data.identityPolicies.find((item) => item.id === identityPolicyId)
    ?? data.identityPolicies[0];

  const result = useMemo(() => {
    const protocolReadable = layer.kind === 'application' && tlsMode.inspectionAtProxy;
    const layerMismatch = layer.kind === 'application' && !tlsMode.inspectionAtProxy;
    const upstreamPlaintext = tlsMode.upstream === 'Plaintext';
    const routing = protocolReadable ? layer.routing : 'Addresses, ports, and connection state';
    const inspection = protocolReadable
      ? layer.inspection
      : tlsMode.inspectionAtProxy
        ? layer.inspection
        : 'Encrypted payload; no HTTP method, path, cookie, or identity header';

    let status: 'healthy' | 'caution' | 'unsafe' = 'healthy';
    let title = 'The proxy has enough context for the selected responsibility';
    let detail =
      'Routing inputs, TLS ownership, and identity authority agree. Keep the same contract in configuration, tests, and telemetry.';

    if (!identityPolicy.safe) {
      status = 'unsafe';
      title = 'An untrusted caller can assert authoritative identity';
      detail =
        'Forwarded identity is data, not proof. Strip caller-supplied identity fields and accept replacement metadata only from an authenticated or allowlisted proxy hop.';
    } else if (layerMismatch) {
      status = 'unsafe';
      title = 'L7 policy cannot inspect TLS pass-through traffic';
      detail =
        'The proxy can steer the encrypted connection with transport metadata, but it cannot apply HTTP path, method, cookie, or header policy without terminating TLS.';
    } else if (upstreamPlaintext) {
      status = 'caution';
      title = 'The proxy terminates TLS, but the upstream leg is plaintext';
      detail =
        'This can be deliberate inside a controlled boundary. Document that boundary, restrict the network path, and use re-encryption when the upstream network is not equally trusted.';
    }

    return {
      detail,
      inspection,
      layerMismatch,
      protocolReadable,
      routing,
      status,
      title,
      upstreamPlaintext,
    };
  }, [identityPolicy.safe, layer, tlsMode]);

  const reset = () => {
    setDirectionId(data.defaults.directionId);
    setLayerId(data.defaults.layerId);
    setTlsModeId(data.defaults.tlsModeId);
    setIdentityPolicyId(data.defaults.identityPolicyId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Request path and trust lab"
          title={data.title}
          description={data.description}
          icon={Waypoints}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <ChoiceGroup
                label="1. Who chose the proxy?"
                options={data.directions}
                selectedId={direction.id}
                icon={direction.id === 'forward' ? Globe2 : Server}
                accent="blue"
                onSelect={setDirectionId}
              />
              <ChoiceGroup
                label="2. Routing layer"
                options={data.layers}
                selectedId={layer.id}
                icon={layer.kind === 'transport' ? Network : Route}
                accent="violet"
                onSelect={setLayerId}
              />
              <ChoiceGroup
                label="3. TLS ownership"
                options={data.tlsModes}
                selectedId={tlsMode.id}
                icon={LockKeyhole}
                accent="cyan"
                onSelect={setTlsModeId}
              />
              <ChoiceGroup
                label="4. Client identity policy"
                options={data.identityPolicies}
                selectedId={identityPolicy.id}
                icon={Fingerprint}
                accent={identityPolicy.safe ? 'emerald' : 'rose'}
                onSelect={setIdentityPolicyId}
              />
            </div>
          )}
        >
          <div className="space-y-5" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Routing input"
                value={result.protocolReadable ? 'HTTP-aware' : 'Transport-only'}
                detail={result.routing}
                icon={Route}
                tone={result.layerMismatch ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Proxy visibility"
                value={result.protocolReadable ? 'Decrypted' : 'Opaque'}
                detail={result.inspection}
                icon={result.protocolReadable ? Eye : EyeOff}
                tone={result.layerMismatch ? 'rose' : 'violet'}
              />
              <LabMetric
                label="Identity authority"
                value={identityPolicy.safe ? 'Bounded' : 'Forgeable'}
                detail={identityPolicy.result}
                icon={identityPolicy.safe ? ShieldCheck : CircleAlert}
                tone={identityPolicy.safe ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Active request path
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {direction.purpose}
                  </p>
                </div>
                <span className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {layer.label} / {tlsMode.label}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <PathNode icon={Globe2} label={direction.requester} detail="Supplies the request and untrusted metadata." />
                <PathArrow label="Trust boundary" />
                <PathNode
                  icon={Waypoints}
                  label={direction.proxy}
                  detail={`${layer.inspection}. ${identityPolicy.result}`}
                  active
                />
                <PathArrow label={tlsMode.upstream} />
                <PathNode
                  icon={Server}
                  label={direction.destination}
                  detail={`Receives the routed connection or request over ${tlsMode.upstream.toLowerCase()}.`}
                />
              </div>
            </section>

            <section className={statusClasses[result.status]}>
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Boundary review</p>
                  <p className="mt-1 text-base font-semibold">{result.title}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">{result.detail}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <BoundaryFact
                label="Downstream TLS leg"
                value={tlsMode.downstream}
                detail="The side facing the requester."
              />
              <BoundaryFact
                label="Upstream TLS leg"
                value={tlsMode.upstream}
                detail={
                  result.upstreamPlaintext
                    ? 'Encryption ends at the proxy.'
                    : 'The proxy preserves or creates an encrypted upstream leg.'
                }
              />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ChoiceGroup<T extends { id: string; label: string; detail: string }>({
  label,
  options,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  options: T[];
  selectedId: string;
  icon: LucideIcon;
  accent: 'blue' | 'violet' | 'cyan' | 'emerald' | 'rose';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={option.id === selectedId}
            label={option.label}
            detail={option.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function PathNode({
  icon: Icon,
  label,
  detail,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div
      className={`min-h-32 rounded-md border p-4 ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-50'
          : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50'
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function PathArrow({ label }: { label: string }) {
  return (
    <div className="flex min-w-20 items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400">
      <ArrowDown aria-hidden="true" className="h-5 w-5 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 md:block" />
      <span className="text-center text-[11px] font-semibold uppercase md:[writing-mode:vertical-rl]">
        {label}
      </span>
    </div>
  );
}

function BoundaryFact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LabState({
  title,
  detail,
  tone = 'loading',
}: {
  title: string;
  detail: string;
  tone?: 'loading' | 'error';
}) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            className={`flex min-h-48 items-start gap-3 rounded-md border p-5 ${
              tone === 'error'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100'
            }`}
            role={tone === 'error' ? 'alert' : 'status'}
          >
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm opacity-75">{detail}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const statusClasses = {
  healthy:
    'border-l-4 border-emerald-500 bg-emerald-50 px-4 py-4 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50',
  caution:
    'border-l-4 border-amber-500 bg-amber-50 px-4 py-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50',
  unsafe:
    'border-l-4 border-rose-500 bg-rose-50 px-4 py-4 text-rose-950 dark:bg-rose-950/30 dark:text-rose-50',
};
