'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  Braces,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileQuestion,
  FileSearch,
  FileStack,
  LoaderCircle,
  Route,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type GateId =
  | 'readable'
  | 'page-complete'
  | 'critical-confidence'
  | 'structure'
  | 'source-evidence'
  | 'reconciliation';
type GateState = 'pass' | 'fail' | 'ignored';
type Outcome = 'straight-through' | 'specialist-route' | 'human-review' | 'quarantine';

interface RoutingPolicy {
  id: string;
  label: string;
  detail: string;
  routeUnknownToSpecialist: boolean;
  minimumClassifierPct: number;
  minimumCriticalFieldPct: number;
  minimumStructuralCoveragePct: number;
  minimumSourceCoveragePct: number;
  requirePageCompleteness: boolean;
  requireReconciliation: boolean;
  quarantineUnreadableBelowPct: number;
}

interface DocumentPacket {
  id: string;
  label: string;
  detail: string;
  sourceFormat: string;
  actionRisk: string;
  knownFamily: boolean;
  readablePct: number;
  pageCount: number;
  expectedPages: number;
  classifierPct: number;
  aggregateConfidencePct: number;
  criticalFieldConfidencePct: number;
  structuralCoveragePct: number;
  sourceCoveragePct: number;
  reconciles: boolean;
  groundTruthSafe: boolean;
  specialistReason: string;
  failureTruth: string;
}

interface RoutingQualityData {
  title: string;
  description: string;
  defaults: { packetId: string; policyId: string };
  gateLabels: Record<GateId, string>;
  policies: RoutingPolicy[];
  packets: DocumentPacket[];
}

interface GateResult {
  id: GateId;
  state: GateState;
  observed: string;
  requirement: string;
}

const BLOCK_ID = 'genai/production-document-extraction-routing-quality-lab';

const isNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

function isRoutingQualityData(value: unknown): value is RoutingQualityData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoutingQualityData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.packetId
      && candidate.defaults?.policyId
      && candidate.gateLabels
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && typeof policy.routeUnknownToSpecialist === 'boolean'
        && isNumber(policy.minimumClassifierPct)
        && isNumber(policy.minimumCriticalFieldPct)
        && isNumber(policy.minimumStructuralCoveragePct)
        && isNumber(policy.minimumSourceCoveragePct)
        && typeof policy.requirePageCompleteness === 'boolean'
        && typeof policy.requireReconciliation === 'boolean'
        && isNumber(policy.quarantineUnreadableBelowPct)
      ))
      && Array.isArray(candidate.packets)
      && candidate.packets.length > 0
      && candidate.packets.every((packet) => (
        typeof packet.id === 'string'
        && typeof packet.label === 'string'
        && typeof packet.detail === 'string'
        && typeof packet.sourceFormat === 'string'
        && typeof packet.actionRisk === 'string'
        && typeof packet.knownFamily === 'boolean'
        && isNumber(packet.readablePct)
        && isNumber(packet.pageCount)
        && isNumber(packet.expectedPages)
        && isNumber(packet.classifierPct)
        && isNumber(packet.aggregateConfidencePct)
        && isNumber(packet.criticalFieldConfidencePct)
        && isNumber(packet.structuralCoveragePct)
        && isNumber(packet.sourceCoveragePct)
        && typeof packet.reconciles === 'boolean'
        && typeof packet.groundTruthSafe === 'boolean'
        && typeof packet.specialistReason === 'string'
        && typeof packet.failureTruth === 'string'
      )),
  );
}

export default function ProductionDocumentExtractionRoutingQualityLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RoutingQualityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No routing and quality-gate model was supplied.');
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
        if (!isRoutingQualityData(payload)) throw new Error('Routing data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the routing lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <RoutingQualityLab data={data} />;
}

function RoutingQualityLab({ data }: { data: RoutingQualityData }) {
  const initialPacket = data.packets.find((item) => item.id === data.defaults.packetId)
    ?? data.packets[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [packetId, setPacketId] = useState(initialPacket.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);

  const packet = data.packets.find((item) => item.id === packetId) ?? data.packets[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const gates: GateResult[] = [
      {
        id: 'readable',
        state: packet.readablePct >= policy.quarantineUnreadableBelowPct ? 'pass' : 'fail',
        observed: `${packet.readablePct}% readable`,
        requirement: `At least ${policy.quarantineUnreadableBelowPct}%`,
      },
      {
        id: 'page-complete',
        state: !policy.requirePageCompleteness
          ? 'ignored'
          : packet.pageCount === packet.expectedPages ? 'pass' : 'fail',
        observed: `${packet.pageCount} of ${packet.expectedPages} pages`,
        requirement: policy.requirePageCompleteness ? 'All expected pages' : 'Not observed',
      },
      {
        id: 'critical-confidence',
        state: policy.minimumCriticalFieldPct === 0
          ? 'ignored'
          : packet.criticalFieldConfidencePct >= policy.minimumCriticalFieldPct ? 'pass' : 'fail',
        observed: `${packet.criticalFieldConfidencePct}% field confidence`,
        requirement: policy.minimumCriticalFieldPct === 0
          ? 'Not observed'
          : `At least ${policy.minimumCriticalFieldPct}%`,
      },
      {
        id: 'structure',
        state: policy.minimumStructuralCoveragePct === 0
          ? 'ignored'
          : packet.structuralCoveragePct >= policy.minimumStructuralCoveragePct ? 'pass' : 'fail',
        observed: `${packet.structuralCoveragePct}% structure`,
        requirement: policy.minimumStructuralCoveragePct === 0
          ? 'Not observed'
          : `At least ${policy.minimumStructuralCoveragePct}%`,
      },
      {
        id: 'source-evidence',
        state: policy.minimumSourceCoveragePct === 0
          ? 'ignored'
          : packet.sourceCoveragePct >= policy.minimumSourceCoveragePct ? 'pass' : 'fail',
        observed: `${packet.sourceCoveragePct}% anchored`,
        requirement: policy.minimumSourceCoveragePct === 0
          ? 'Not observed'
          : `At least ${policy.minimumSourceCoveragePct}%`,
      },
      {
        id: 'reconciliation',
        state: !policy.requireReconciliation
          ? 'ignored'
          : packet.reconciles ? 'pass' : 'fail',
        observed: packet.reconciles ? 'Rules agree' : 'Rules conflict',
        requirement: policy.requireReconciliation ? 'Must reconcile' : 'Not observed',
      },
    ];

    const unreadable = gates.some((gate) => gate.id === 'readable' && gate.state === 'fail');
    const pageIncomplete = gates.some((gate) => gate.id === 'page-complete' && gate.state === 'fail');
    const classifierUncertain = packet.classifierPct < policy.minimumClassifierPct;
    const specialist = policy.routeUnknownToSpecialist && (!packet.knownFamily || classifierUncertain);
    const failed = gates.filter((gate) => gate.state === 'fail');
    const ignored = gates.filter((gate) => gate.state === 'ignored');

    let outcome: Outcome = 'straight-through';
    if (unreadable || pageIncomplete) outcome = 'quarantine';
    else if (specialist) outcome = 'specialist-route';
    else if (failed.length > 0) outcome = 'human-review';

    const unsafeRelease = outcome === 'straight-through' && !packet.groundTruthSafe;
    const effectiveOutcome = unsafeRelease ? 'unsafe straight-through' : outcome;
    const routeLabel = specialist ? 'Bundle split and specialist' : 'General extraction';
    const tone = unsafeRelease
      ? 'rose' as const
      : outcome === 'straight-through'
        ? 'emerald' as const
        : outcome === 'quarantine'
          ? 'rose' as const
          : 'amber' as const;

    return {
      effectiveOutcome,
      failed,
      gates,
      ignored,
      outcome,
      routeLabel,
      tone,
      unsafeRelease,
    };
  }, [packet, policy]);

  function reset() {
    setPacketId(initialPacket.id);
    setPolicyId(initialPolicy.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Routing and release lab"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Intake packet
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.packets.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === packet.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'clean-invoice' ? FileCheck2 : item.id === 'mixed-bundle' ? FileStack : FileQuestion}
                      accent={item.groundTruthSafe ? 'emerald' : item.id === 'missing-page' ? 'rose' : 'amber'}
                      onClick={() => setPacketId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Operating policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'evidence-bound' ? ShieldCheck : item.id === 'confidence-routed' ? ScanLine : Braces}
                      accent={item.id === 'evidence-bound' ? 'emerald' : item.id === 'confidence-routed' ? 'blue' : 'rose'}
                      onClick={() => setPolicyId(item.id)}
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
                label="Observed by policy"
                value={`${result.gates.length - result.ignored.length} / ${result.gates.length}`}
                detail={`${result.ignored.length} gate${result.ignored.length === 1 ? '' : 's'} ignored`}
                icon={FileSearch}
                tone={result.ignored.length === 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Failed gates"
                value={result.failed.length.toString()}
                detail={result.failed.length === 0 ? 'No observed gate failed' : 'Candidate needs another path'}
                icon={result.failed.length === 0 ? CheckCircle2 : CircleAlert}
                tone={result.failed.length === 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Release outcome"
                value={result.effectiveOutcome}
                detail={result.routeLabel}
                icon={result.unsafeRelease ? AlertTriangle : result.outcome === 'straight-through' ? CheckCircle2 : Ban}
                tone={result.tone}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Packet on the intake tray</p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">{packet.label}</h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{packet.actionRisk}</p>
                </div>
                <span className="w-fit rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {packet.sourceFormat}
                </span>
              </div>

              <div className="mt-5 flex min-h-28 items-end gap-2 overflow-hidden rounded-md border border-dashed border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                {Array.from({ length: packet.expectedPages }, (_, index) => {
                  const present = index < packet.pageCount;
                  return (
                    <div
                      key={index}
                      className={`relative flex h-20 w-14 shrink-0 items-center justify-center rounded border text-xs font-semibold shadow-sm ${present
                        ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'border-rose-400 border-dashed bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200'}`}
                    >
                      {present ? `Page ${index + 1}` : `Missing ${index + 1}`}
                    </div>
                  );
                })}
                <div className="ml-auto hidden max-w-48 text-right text-xs leading-5 text-neutral-500 md:block dark:text-neutral-400">
                  Classifier {packet.classifierPct}%<br />
                  Aggregate {packet.aggregateConfidencePct}%
                </div>
              </div>
            </section>

            <section aria-label="Candidate route" className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible decision path</p>
              <ol className="mt-4 grid gap-0 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                <RouteStage icon={FileStack} label="Intake" detail={`${packet.pageCount}/${packet.expectedPages} pages`} state="active" />
                <Connector />
                <RouteStage icon={Route} label="Route" detail={result.routeLabel} state={result.outcome === 'specialist-route' ? 'warning' : 'active'} />
                <Connector />
                <RouteStage icon={Braces} label="Candidate" detail={`${packet.criticalFieldConfidencePct}% critical field`} state="active" />
                <Connector />
                <RouteStage
                  icon={result.unsafeRelease ? AlertTriangle : result.outcome === 'straight-through' ? CheckCircle2 : ShieldCheck}
                  label="Decision"
                  detail={result.effectiveOutcome}
                  state={result.unsafeRelease || result.outcome === 'quarantine' ? 'danger' : result.outcome === 'straight-through' ? 'success' : 'warning'}
                />
              </ol>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Gate board</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">What this policy can actually see</h4>
                </div>
                <span className="hidden text-xs text-neutral-500 sm:block dark:text-neutral-400">{policy.label}</span>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {result.gates.map((gate) => (
                  <GateRow key={gate.id} label={data.gateLabels[gate.id]} gate={gate} />
                ))}
              </ul>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
              : result.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <h4 className="font-semibold">
                    {result.unsafeRelease
                      ? 'The policy released a candidate that the replay labels unsafe'
                      : result.outcome === 'straight-through'
                        ? 'The packet satisfies every observed production gate'
                        : result.outcome === 'specialist-route'
                          ? 'Classification uncertainty changes the extraction route'
                          : result.outcome === 'quarantine'
                            ? 'The source boundary must be repaired before extraction'
                            : 'The candidate is inspectable, but not safe to promote'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {result.unsafeRelease
                      ? `${packet.failureTruth} The policy ignored ${result.ignored.length} evidence gate${result.ignored.length === 1 ? '' : 's'}.`
                      : result.outcome === 'specialist-route'
                        ? packet.specialistReason
                        : result.failed.length > 0
                          ? `Failed: ${result.failed.map((gate) => data.gateLabels[gate.id]).join(', ')}. ${packet.failureTruth}`
                          : packet.failureTruth}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function RouteStage({
  icon: Icon,
  label,
  detail,
  state,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  state: 'active' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    active: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    danger: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <li className={`min-h-24 min-w-0 rounded-md border p-3 ${styles[state]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 opacity-80">{detail}</p>
    </li>
  );
}

function Connector() {
  return (
    <li aria-hidden="true" className="flex h-8 items-center justify-center text-neutral-400 md:h-auto md:w-8">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </li>
  );
}

function GateRow({ label, gate }: { label: string; gate: GateResult }) {
  const style = gate.state === 'pass'
    ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-neutral-950'
    : gate.state === 'fail'
      ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/25'
      : 'border-neutral-200 bg-neutral-100 opacity-70 dark:border-neutral-800 dark:bg-neutral-900';
  const Icon = gate.state === 'pass' ? CheckCircle2 : gate.state === 'fail' ? CircleAlert : Ban;

  return (
    <li className={`rounded-md border p-3 ${style}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
            {gate.observed} / {gate.requirement}
          </p>
        </div>
      </div>
    </li>
  );
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabBody>
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading routing lab...
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabBody>
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          {detail}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
