'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Braces,
  Database,
  Globe2,
  RadioTower,
  Send,
  ShieldCheck,
  TriangleAlert,
  Workflow,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Paradigm = 'rest' | 'graphql' | 'grpc' | 'webhook' | 'sse' | 'websocket';
type Workload = 'public-resource' | 'composed-view' | 'internal-command' | 'notification' | 'live-session';
interface Capability { browser: boolean; cache: boolean; clientSelection: boolean; bidirectional: boolean; asyncDelivery: boolean; generatedTypes: boolean; }
const BLOCK_ID = 'technology/api-paradigms-performance';
const paradigms: Array<{ id: Paradigm; label: string; detail: string; capabilities: Capability }> = [
  { id: 'rest', label: 'REST over HTTP', detail: 'Resource-oriented request-response with HTTP caching and broad interoperability.', capabilities: { browser: true, cache: true, clientSelection: false, bidirectional: false, asyncDelivery: false, generatedTypes: false } },
  { id: 'graphql', label: 'GraphQL', detail: 'Typed client-selected queries over a connected application schema.', capabilities: { browser: true, cache: false, clientSelection: true, bidirectional: false, asyncDelivery: false, generatedTypes: true } },
  { id: 'grpc', label: 'gRPC', detail: 'Generated service contracts and compact unary or streaming RPCs.', capabilities: { browser: false, cache: false, clientSelection: false, bidirectional: true, asyncDelivery: false, generatedTypes: true } },
  { id: 'webhook', label: 'Webhook', detail: 'Provider-initiated HTTP delivery to a consumer-owned endpoint.', capabilities: { browser: false, cache: false, clientSelection: false, bidirectional: false, asyncDelivery: true, generatedTypes: false } },
  { id: 'sse', label: 'Server-sent events', detail: 'One-way server-to-browser event stream over a long-lived HTTP response.', capabilities: { browser: true, cache: false, clientSelection: false, bidirectional: false, asyncDelivery: true, generatedTypes: false } },
  { id: 'websocket', label: 'WebSocket', detail: 'Long-lived framed full-duplex channel for interactive sessions.', capabilities: { browser: true, cache: false, clientSelection: false, bidirectional: true, asyncDelivery: true, generatedTypes: false } },
];
const workloads: Array<{ id: Workload; label: string; detail: string; recommended: Paradigm }> = [
  { id: 'public-resource', label: 'Public catalog API', detail: 'Many independent consumers read cacheable resources over standard HTTP.', recommended: 'rest' },
  { id: 'composed-view', label: 'Multi-client composed view', detail: 'Web, mobile, and partner clients need different connected projections.', recommended: 'graphql' },
  { id: 'internal-command', label: 'Internal typed command', detail: 'Known services need generated contracts, deadlines, and efficient calls.', recommended: 'grpc' },
  { id: 'notification', label: 'External event notification', detail: 'A provider must notify consumer systems after durable state changes.', recommended: 'webhook' },
  { id: 'live-session', label: 'Interactive live session', detail: 'Both client and server exchange low-latency updates continuously.', recommended: 'websocket' },
];

export default function ApiParadigmsPerformance() {
  const [workloadId, setWorkloadId] = useState<Workload>('public-resource');
  const [paradigmId, setParadigmId] = useState<Paradigm>('rest');
  const [browserRequired, setBrowserRequired] = useState(true);
  const [sharedCaching, setSharedCaching] = useState(true);
  const [clientSelection, setClientSelection] = useState(false);
  const [bidirectional, setBidirectional] = useState(false);
  const [asyncDelivery, setAsyncDelivery] = useState(false);
  const [generatedTypes, setGeneratedTypes] = useState(false);
  const workload = workloads.find((item) => item.id === workloadId) ?? workloads[0];
  const paradigm = paradigms.find((item) => item.id === paradigmId) ?? paradigms[0];

  const result = useMemo(() => {
    const requirements: Array<[keyof Capability, boolean, string]> = [
      ['browser', browserRequired, 'direct browser support'],
      ['cache', sharedCaching, 'shared HTTP caching'],
      ['clientSelection', clientSelection, 'client-selected response shape'],
      ['bidirectional', bidirectional, 'bidirectional streaming'],
      ['asyncDelivery', asyncDelivery, 'provider-initiated delivery'],
      ['generatedTypes', generatedTypes, 'generated typed clients'],
    ];
    const misses = requirements.filter(([key, required]) => required && !paradigm.capabilities[key]);
    const fit = misses.length === 0;
    return { fit, misses, recommended: workload.recommended === paradigm.id };
  }, [asyncDelivery, bidirectional, browserRequired, clientSelection, generatedTypes, paradigm, sharedCaching, workload.recommended]);

  const chooseWorkload = (id: Workload) => {
    const next = workloads.find((item) => item.id === id) ?? workloads[0];
    setWorkloadId(id);
    setParadigmId(next.recommended);
    setBrowserRequired(id === 'public-resource' || id === 'composed-view' || id === 'live-session');
    setSharedCaching(id === 'public-resource');
    setClientSelection(id === 'composed-view');
    setBidirectional(id === 'live-session');
    setAsyncDelivery(id === 'notification' || id === 'live-session');
    setGeneratedTypes(id === 'internal-command' || id === 'composed-view');
  };
  const reset = () => chooseWorkload('public-resource');

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="API contract fit lab" title="Choose the interaction contract before the protocol" description="Select a workload, compare paradigms, and change required capabilities. The goal is a defensible contract, not a universal protocol ranking." icon={Workflow} accent="blue" onReset={reset} />
        <LearningLabBody controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload</legend>
              <div className="mt-3 grid gap-2">
                {workloads.map((item) => <LabChoice key={item.id} selected={item.id === workload.id} label={item.label} detail={item.detail} icon={item.id === 'live-session' ? RadioTower : Database} accent="blue" onClick={() => chooseWorkload(item.id)} />)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Paradigm</legend>
              <div className="mt-3 grid gap-2">
                {paradigms.map((item) => <LabChoice key={item.id} selected={item.id === paradigm.id} label={item.label} detail={item.detail} icon={item.id === 'websocket' ? ArrowLeftRight : item.id === 'webhook' ? Send : Braces} accent={item.id === 'grpc' ? 'violet' : 'cyan'} onClick={() => setParadigmId(item.id)} />)}
              </div>
            </fieldset>
          </div>
        )}>
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.fit ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.fit ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Contract verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.fit ? result.recommended ? 'The paradigm matches the selected workload contract' : 'The paradigm can satisfy the declared capabilities' : `The contract is missing ${result.misses[0]?.[2] ?? 'a required capability'}`}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.fit ? 'Now specify identity, authorization, deadlines, errors, retries, versioning, observability, and overload behavior before choosing a framework.' : `Change the paradigm or relax an actual product requirement. Current gaps: ${result.misses.map((item) => item[2]).join(', ')}.`}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Capability label="Direct browser support" enabled={browserRequired} supported={paradigm.capabilities.browser} icon={Globe2} accent="blue" onClick={() => setBrowserRequired((value) => !value)} />
              <Capability label="Shared HTTP caching" enabled={sharedCaching} supported={paradigm.capabilities.cache} icon={Database} accent="emerald" onClick={() => setSharedCaching((value) => !value)} />
              <Capability label="Client-selected shape" enabled={clientSelection} supported={paradigm.capabilities.clientSelection} icon={Braces} accent="violet" onClick={() => setClientSelection((value) => !value)} />
              <Capability label="Bidirectional stream" enabled={bidirectional} supported={paradigm.capabilities.bidirectional} icon={ArrowLeftRight} accent="rose" onClick={() => setBidirectional((value) => !value)} />
              <Capability label="Provider-initiated delivery" enabled={asyncDelivery} supported={paradigm.capabilities.asyncDelivery} icon={Send} accent="amber" onClick={() => setAsyncDelivery((value) => !value)} />
              <Capability label="Generated typed clients" enabled={generatedTypes} supported={paradigm.capabilities.generatedTypes} icon={Zap} accent="cyan" onClick={() => setGeneratedTypes((value) => !value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stage title="Semantics" detail="Define operation identity, ordering, consistency, idempotency, errors, cancellation, and completion before transport details." />
              <Stage title="Envelope" detail="Bound payload, query cost, stream duration, fan-out, concurrency, retries, deadlines, and per-tenant resource use." />
              <Stage title="Evolution" detail="Version schemas and behavior additively, test old clients, publish deprecation evidence, and keep rollback compatibility." />
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function Capability({ label, enabled, supported, icon, accent, onClick }: { label: string; enabled: boolean; supported: boolean; icon: typeof Globe2; accent: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'cyan'; onClick: () => void }) {
  return <LabChoice selected={enabled} label={label} detail={!enabled ? 'Not required' : supported ? 'Supported by selected paradigm' : 'Required but not native to selected paradigm'} icon={icon} accent={supported ? accent : 'rose'} onClick={onClick} />;
}
function Stage({ title, detail }: { title: string; detail: string }) { return <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p></div>; }
const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
