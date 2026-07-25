'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileClock,
  FileDiff,
  FileSearch,
  Fingerprint,
  History,
  Link2,
  Link2Off,
  LoaderCircle,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
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

interface EvidenceBundle {
  id: string;
  label: string;
  detail: string;
  traceabilityPct: number;
  links: string[];
}

interface RecoveryAction {
  id: string;
  label: string;
  detail: string;
  restores: string;
}

interface ExtractionSnapshot {
  version: string;
  field: string;
  value: string;
  sourceHash: string;
  processor: string;
}

interface RecoveryIncident {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  requiredLinks: string[];
  criticalLinks: string[];
  recommendedActionId: string;
  dangerousActionIds: string[];
  accepted: ExtractionSnapshot;
  candidate: ExtractionSnapshot;
  safeConsequence: string;
  wrongConsequence: string;
  recoveryTarget: string;
}

interface ProvenanceRecoveryData {
  title: string;
  description: string;
  defaults: { incidentId: string; bundleId: string; actionId: string };
  linkLabels: Record<string, string>;
  bundles: EvidenceBundle[];
  actions: RecoveryAction[];
  incidents: RecoveryIncident[];
}

type Judgment = 'supported' | 'incomplete' | 'dangerous';

const BLOCK_ID = 'genai/production-document-extraction-provenance-recovery-lab';

const isNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

function isSnapshot(value: unknown): value is ExtractionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ExtractionSnapshot>;
  return Boolean(
    candidate.version
      && candidate.field
      && candidate.value
      && candidate.sourceHash
      && candidate.processor,
  );
}

function isProvenanceRecoveryData(value: unknown): value is ProvenanceRecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ProvenanceRecoveryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults?.bundleId
      && candidate.defaults?.actionId
      && candidate.linkLabels
      && Array.isArray(candidate.bundles)
      && candidate.bundles.length > 0
      && candidate.bundles.every((bundle) => (
        typeof bundle.id === 'string'
        && typeof bundle.label === 'string'
        && typeof bundle.detail === 'string'
        && isNumber(bundle.traceabilityPct)
        && Array.isArray(bundle.links)
        && bundle.links.every((link) => typeof link === 'string')
      ))
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && candidate.actions.every((action) => (
        typeof action.id === 'string'
        && typeof action.label === 'string'
        && typeof action.detail === 'string'
        && typeof action.restores === 'string'
      ))
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((incident) => (
        typeof incident.id === 'string'
        && typeof incident.label === 'string'
        && typeof incident.detail === 'string'
        && typeof incident.symptom === 'string'
        && Array.isArray(incident.requiredLinks)
        && incident.requiredLinks.length > 0
        && Array.isArray(incident.criticalLinks)
        && typeof incident.recommendedActionId === 'string'
        && Array.isArray(incident.dangerousActionIds)
        && isSnapshot(incident.accepted)
        && isSnapshot(incident.candidate)
        && typeof incident.safeConsequence === 'string'
        && typeof incident.wrongConsequence === 'string'
        && typeof incident.recoveryTarget === 'string'
      )),
  );
}

export default function ProductionDocumentExtractionProvenanceRecoveryLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ProvenanceRecoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No provenance and recovery model was supplied.');
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
        if (!isProvenanceRecoveryData(payload)) throw new Error('Recovery data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the recovery lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ProvenanceRecoveryLab data={data} />;
}

function ProvenanceRecoveryLab({ data }: { data: ProvenanceRecoveryData }) {
  const initialIncident = data.incidents.find((item) => item.id === data.defaults.incidentId)
    ?? data.incidents[0];
  const initialBundle = data.bundles.find((item) => item.id === data.defaults.bundleId)
    ?? data.bundles[0];
  const initialAction = data.actions.find((item) => item.id === data.defaults.actionId)
    ?? data.actions[0];
  const [incidentId, setIncidentId] = useState(initialIncident.id);
  const [bundleId, setBundleId] = useState(initialBundle.id);
  const [actionId, setActionId] = useState(initialAction.id);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];
  const bundle = data.bundles.find((item) => item.id === bundleId) ?? data.bundles[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];

  const result = useMemo(() => {
    const present = incident.requiredLinks.filter((link) => bundle.links.includes(link));
    const missing = incident.requiredLinks.filter((link) => !bundle.links.includes(link));
    const missingCritical = missing.filter((link) => incident.criticalLinks.includes(link));
    const coveragePct = Math.round(present.length / incident.requiredLinks.length * 100);
    const sourceMatches = incident.accepted.sourceHash === incident.candidate.sourceHash;
    const valueChanged = incident.accepted.value !== incident.candidate.value;
    const actionMatches = action.id === incident.recommendedActionId;
    const dangerous = incident.dangerousActionIds.includes(action.id);
    const evidenceReady = missingCritical.length === 0;

    const judgment: Judgment = dangerous
      ? 'dangerous'
      : actionMatches && evidenceReady
        ? 'supported'
        : 'incomplete';
    const recoverability = evidenceReady
      ? missing.length === 0 ? 'Reproducible' : 'Bounded gaps'
      : bundle.id === 'output-only' ? 'Unexplained' : 'Blocked';
    const recommended = data.actions.find((item) => item.id === incident.recommendedActionId)
      ?? data.actions[0];

    return {
      actionMatches,
      coveragePct,
      evidenceReady,
      judgment,
      missing,
      missingCritical,
      present,
      recommended,
      recoverability,
      sourceMatches,
      valueChanged,
    };
  }, [action.id, bundle, data.actions, incident]);

  function reset() {
    setIncidentId(initialIncident.id);
    setBundleId(initialBundle.id);
    setActionId(initialAction.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Provenance and recovery ledger"
          title={data.title}
          description={data.description}
          icon={History}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Production incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === incident.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'ambiguous-promotion' ? Clock3 : item.id === 'source-replaced' ? Fingerprint : FileDiff}
                      accent={item.id === 'source-replaced' ? 'rose' : item.id === 'review-dispute' ? 'blue' : 'amber'}
                      onClick={() => setIncidentId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Surviving evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.bundles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === bundle.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'output-only' ? Link2Off : Link2}
                      accent={item.id === 'complete-ledger' ? 'emerald' : item.id === 'anchored-versioned' ? 'violet' : 'rose'}
                      onClick={() => setBundleId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Recovery action
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {data.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === action.id}
                      label={item.label}
                      detail={item.detail}
                      icon={actionIcon(item.id)}
                      accent={item.id === 'overwrite-retry' ? 'rose' : item.id === 'quarantine-source' ? 'amber' : 'blue'}
                      onClick={() => setActionId(item.id)}
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
                label="Required evidence"
                value={`${result.coveragePct}%`}
                detail={`${result.present.length} of ${incident.requiredLinks.length} links present`}
                icon={Link2}
                tone={result.coveragePct === 100 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Critical gaps"
                value={result.missingCritical.length.toString()}
                detail={result.evidenceReady ? 'Recovery boundary is identifiable' : 'Causal reconstruction is blocked'}
                icon={result.evidenceReady ? ShieldCheck : ShieldAlert}
                tone={result.evidenceReady ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Source identity"
                value={result.sourceMatches ? 'Same bytes' : 'Mismatch'}
                detail={result.sourceMatches ? incident.accepted.sourceHash : 'Accepted and candidate hashes differ'}
                icon={Fingerprint}
                tone={result.sourceMatches ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Recoverability"
                value={result.recoverability}
                detail={`Traceability envelope: ${bundle.traceabilityPct}%`}
                icon={FileSearch}
                tone={result.judgment === 'supported' ? 'emerald' : result.judgment === 'dangerous' ? 'rose' : 'amber'}
              />
            </div>

            <section className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
              <header className="border-b border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Incident record</p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">{incident.symptom}</h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{incident.recoveryTarget}</p>
                  </div>
                  <span className="w-fit rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                    {incident.id}
                  </span>
                </div>
              </header>

              <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr]">
                <SnapshotCard label="Accepted history" snapshot={incident.accepted} icon={History} tone="accepted" />
                <div aria-hidden="true" className="flex h-10 items-center justify-center border-y border-neutral-200 text-neutral-400 md:h-auto md:w-12 md:border-x md:border-y-0 dark:border-neutral-800">
                  <ArrowDown className="h-5 w-5 md:hidden" />
                  <ArrowRight className="hidden h-5 w-5 md:block" />
                </div>
                <SnapshotCard label="Replay candidate" snapshot={incident.candidate} icon={FileClock} tone={result.valueChanged ? 'changed' : 'candidate'} />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence chain</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">Can the system explain this candidate?</h4>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{bundle.label}</p>
              </div>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {incident.requiredLinks.map((link, index) => {
                  const present = bundle.links.includes(link);
                  const critical = incident.criticalLinks.includes(link);
                  return (
                    <li
                      key={link}
                      className={`relative min-h-24 rounded-md border p-3 ${present
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                        : critical
                          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                          : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase opacity-70">Link {index + 1}</span>
                        {present
                          ? <Link2 aria-label="Present" className="h-4 w-4 shrink-0" />
                          : <Link2Off aria-label="Missing" className="h-4 w-4 shrink-0" />}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{data.linkLabels[link] ?? link}</p>
                      <p className="mt-1 text-xs leading-5 opacity-80">
                        {present ? 'Available for reconstruction' : critical ? 'Missing critical link' : 'Missing supporting link'}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${result.judgment === 'supported'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50'
              : result.judgment === 'dangerous'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-50'}`}
            >
              <div className="flex items-start gap-3">
                {result.judgment === 'supported'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : result.judgment === 'dangerous'
                    ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <h4 className="font-semibold">
                    {result.judgment === 'supported'
                      ? 'The action is supported by the surviving evidence'
                      : result.judgment === 'dangerous'
                        ? 'This action destroys or confuses the evidence needed for recovery'
                        : result.actionMatches
                          ? 'The response is right, but critical evidence is missing'
                          : `The evidence supports a different response: ${result.recommended.label}`}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {result.judgment === 'supported'
                      ? incident.safeConsequence
                      : result.judgment === 'dangerous'
                        ? incident.wrongConsequence
                        : result.evidenceReady
                          ? `${action.restores} Recommended: ${result.recommended.label}.`
                          : `Missing: ${result.missingCritical.map((link) => data.linkLabels[link] ?? link).join(', ')}. Establish those links before committing recovery.`}
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

function SnapshotCard({
  label,
  snapshot,
  icon: Icon,
  tone,
}: {
  label: string;
  snapshot: ExtractionSnapshot;
  icon: LucideIcon;
  tone: 'accepted' | 'candidate' | 'changed';
}) {
  const styles = tone === 'accepted'
    ? 'bg-blue-50/70 dark:bg-blue-950/20'
    : tone === 'changed'
      ? 'bg-amber-50/80 dark:bg-amber-950/20'
      : 'bg-neutral-50 dark:bg-neutral-900';

  return (
    <article className={`min-w-0 p-5 ${styles}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <p className="truncate text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">{label}</p>
        </div>
        <span className="shrink-0 rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
          {snapshot.version}
        </span>
      </div>
      <p className="mt-5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{snapshot.field}</p>
      <p className="mt-1 break-words text-xl font-semibold text-neutral-950 dark:text-white">{snapshot.value}</p>
      <dl className="mt-4 space-y-2 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <dt className="text-neutral-500 dark:text-neutral-400">Source</dt>
          <dd className="break-all font-mono text-neutral-800 dark:text-neutral-200">{snapshot.sourceHash}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <dt className="text-neutral-500 dark:text-neutral-400">Processor</dt>
          <dd className="break-words text-right font-medium text-neutral-800 dark:text-neutral-200">{snapshot.processor}</dd>
        </div>
      </dl>
    </article>
  );
}

function actionIcon(id: string): LucideIcon {
  if (id === 'overwrite-retry') return Ban;
  if (id === 'replay-diff') return FileDiff;
  if (id === 'review-from-anchor') return ScanSearch;
  if (id === 'quarantine-source') return ShieldAlert;
  return RotateCcw;
}

function LoadState() {
  return (
    <LearningLab>
      <LearningLabBody>
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
          Loading recovery ledger...
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
