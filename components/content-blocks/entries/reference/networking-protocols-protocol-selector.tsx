'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Gauge,
  Globe2,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Workload = 'request-response' | 'server-updates' | 'two-way' | 'telemetry';
type Client = 'browser' | 'controlled' | 'device';
type Delivery = 'every-message' | 'freshest-state';

const workloads: Array<{ id: Workload; label: string; detail: string }> = [
  { id: 'request-response', label: 'Request and response', detail: 'A caller asks for one resource or command result.' },
  { id: 'server-updates', label: 'Server updates', detail: 'The server pushes a changing feed to a mostly passive client.' },
  { id: 'two-way', label: 'Two-way live session', detail: 'Both sides send events while the session remains open.' },
  { id: 'telemetry', label: 'Telemetry or device events', detail: 'Many constrained publishers report small messages to a broker.' },
];

const clients: Array<{ id: Client; label: string; detail: string }> = [
  { id: 'browser', label: 'Browsers or public clients', detail: 'Intermediaries, TLS, and broad compatibility matter.' },
  { id: 'controlled', label: 'Controlled services', detail: 'Both sides can share generated contracts and rollout practices.' },
  { id: 'device', label: 'Constrained devices', detail: 'Battery, bandwidth, reconnects, and broker fan-out matter.' },
];

const deliveries: Array<{ id: Delivery; label: string; detail: string }> = [
  { id: 'every-message', label: 'Each message matters', detail: 'Ordering, acknowledgement, or deduplication may be required.' },
  { id: 'freshest-state', label: 'The newest state matters', detail: 'A late position or frame can be less useful than the next one.' },
];

function chooseProtocol(workload: Workload, client: Client, delivery: Delivery) {
  if (delivery === 'freshest-state' && workload === 'two-way') {
    return {
      protocol: 'UDP with an application media or state protocol',
      transport: 'UDP',
      fit: 'Fast-changing state can skip an obsolete update instead of waiting for a reliable ordered stream to catch up.',
      failure: 'Loss is visible to the application. Sequence numbers, jitter handling, and a resync path become your responsibility.',
      operate: 'Measure loss, jitter, out-of-order drops, and resync rate. Do not use this path for irreversible commands.',
      tone: 'amber' as const,
      icon: Radio,
    };
  }

  if (workload === 'two-way') {
    return client === 'controlled'
      ? {
          protocol: 'gRPC bidirectional streaming',
          transport: 'HTTP/2 over TCP',
          fit: 'A typed, long-lived stream fits services that control both contract and deployment.',
          failure: 'A broken stream needs reconnect, deadline, and resume semantics. A reconnect can replay an event.',
          operate: 'Track open streams, stream age, resets, per-method deadlines, and duplicate-handler suppression.',
          tone: 'violet' as const,
          icon: ArrowLeftRight,
        }
      : {
          protocol: 'WebSocket over TLS',
          transport: 'TCP',
          fit: 'A browser-compatible full-duplex session avoids repeated request setup for live interaction.',
          failure: 'A proxy or mobile-network change can silently break the session. Reconnects do not restore state by themselves.',
          operate: 'Track connected clients, reconnect rate, heartbeats, backpressure, and per-connection memory.',
          tone: 'cyan' as const,
          icon: ArrowLeftRight,
        };
  }

  if (workload === 'telemetry' || client === 'device') {
    return {
      protocol: 'MQTT over TLS',
      transport: 'TCP',
      fit: 'Topic-based publish and subscribe keeps small device messages efficient and lets a broker absorb fan-out.',
      failure: 'QoS can trade duplicates and latency for delivery. A retained message is current state, not a complete history.',
      operate: 'Track broker sessions, offline queues, QoS acknowledgements, retained-message age, and reconnect storms.',
      tone: 'emerald' as const,
      icon: Cpu,
    };
  }

  if (workload === 'server-updates') {
    return {
      protocol: 'Server-Sent Events over HTTPS',
      transport: 'HTTP over TCP or QUIC',
      fit: 'A one-way event stream stays close to HTTP infrastructure when the browser mostly receives updates.',
      failure: 'Clients reconnect and may miss an interval. Event IDs and replay windows define what can be recovered.',
      operate: 'Track connected streams, reconnects, event lag, replay depth, and proxy idle-timeout resets.',
      tone: 'blue' as const,
      icon: Cloud,
    };
  }

  if (client === 'controlled') {
    return {
      protocol: 'gRPC',
      transport: 'HTTP/2 over TCP',
      fit: 'Generated contracts, multiplexed calls, and explicit deadlines fit internal service-to-service APIs.',
      failure: 'A timeout does not prove the remote service did nothing. Retry only idempotent work or use an idempotency key.',
      operate: 'Track deadline-exceeded rate, retries, connection churn, saturation, and method-level error codes.',
      tone: 'violet' as const,
      icon: Gauge,
    };
  }

  return {
    protocol: 'HTTPS with HTTP/2 or HTTP/3',
    transport: 'TCP for HTTP/2; QUIC for HTTP/3',
    fit: 'HTTPS is the broadly interoperable starting point for browser APIs, caching, authentication, and observability.',
    failure: 'A response timeout can happen after the server commits a write. HTTP status codes alone do not make retries safe.',
    operate: 'Track p50/p95/p99 latency, status families, TLS failures, connection reuse, and cache behavior.',
    tone: 'blue' as const,
    icon: Globe2,
  };
}

export default function NetworkingProtocolsProtocolSelector() {
  const [workload, setWorkload] = useState<Workload>('request-response');
  const [client, setClient] = useState<Client>('browser');
  const [delivery, setDelivery] = useState<Delivery>('every-message');

  const recommendation = useMemo(
    () => chooseProtocol(workload, client, delivery),
    [workload, client, delivery],
  );
  const Icon = recommendation.icon;

  return (
    <div data-content-block="reference/networking-protocols-protocol-selector">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Constraint-driven selector"
          title="Choose the protocol role before the product name"
          description="Pick the traffic shape, endpoint environment, and delivery contract. The recommendation names a starting application protocol and the operational consequence you still own."
          icon={Globe2}
          accent="blue"
          onReset={() => {
            setWorkload('request-response');
            setClient('browser');
            setDelivery('every-message');
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Traffic shape</legend>
                <div className="mt-3 space-y-2">
                  {workloads.map((option) => (
                    <LabChoice key={option.id} selected={workload === option.id} label={option.label} detail={option.detail} icon={ArrowLeftRight} accent="blue" onClick={() => setWorkload(option.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Endpoint environment</legend>
                <div className="mt-3 space-y-2">
                  {clients.map((option) => (
                    <LabChoice key={option.id} selected={client === option.id} label={option.label} detail={option.detail} icon={option.id === 'browser' ? Globe2 : option.id === 'device' ? Cpu : Cloud} accent="violet" onClick={() => setClient(option.id)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Delivery priority</legend>
                <div className="mt-3 space-y-2">
                  {deliveries.map((option) => (
                    <LabChoice key={option.id} selected={delivery === option.id} label={option.label} detail={option.detail} icon={option.id === 'every-message' ? ShieldCheck : Gauge} accent="amber" onClick={() => setDelivery(option.id)} />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Starting point</p>
              <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">{recommendation.protocol}</h4>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{recommendation.fit}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LabMetric label="Transport envelope" value={recommendation.transport} detail="Application and transport roles are separate decisions." icon={Gauge} tone={recommendation.tone} />
            <LabMetric label="Delivery contract" value={delivery === 'every-message' ? 'Recover or account for loss' : 'Prefer current state'} detail="The protocol does not replace product-level semantics." icon={delivery === 'every-message' ? CheckCircle2 : TriangleAlert} tone={delivery === 'every-message' ? 'emerald' : 'amber'} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-50">
              <p className="text-sm font-semibold">Failure behavior</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{recommendation.failure}</p>
            </div>
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-50">
              <p className="text-sm font-semibold">Operate it with evidence</p>
              <p className="mt-2 text-sm leading-6 opacity-85">{recommendation.operate}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
