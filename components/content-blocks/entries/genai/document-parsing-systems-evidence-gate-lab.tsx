'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Gauge,
  ListChecks,
  LoaderCircle,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Field = {
  id: string;
  label: string;
  value: string;
  confidencePct: number;
  formatValid: boolean;
  reconciliationValid: boolean;
  correct: boolean;
  riskWeight: number;
  source: string;
};

type ReplayCase = {
  id: string;
  label: string;
  detail: string;
  documentType: string;
  fields: Field[];
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  requireFormat: boolean;
  requireReconciliation: boolean;
  blockFailedValidation: boolean;
};

type GateData = {
  title: string;
  description: string;
  defaults: {
    caseId: string;
    policyId: string;
    confidenceFloorPct: number;
  };
  policies: Policy[];
  cases: ReplayCase[];
};

type FieldDecision = 'accepted' | 'review' | 'blocked';

const BLOCK_ID = 'genai/document-parsing-systems-evidence-gate-lab';

function isGateData(value: unknown): value is GateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.caseId
      && candidate.defaults.policyId
      && typeof candidate.defaults.confidenceFloorPct === 'number'
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => (
        typeof policy.id === 'string'
        && typeof policy.label === 'string'
        && typeof policy.detail === 'string'
        && typeof policy.requireFormat === 'boolean'
        && typeof policy.requireReconciliation === 'boolean'
        && typeof policy.blockFailedValidation === 'boolean'
      ))
      && Array.isArray(candidate.cases)
      && candidate.cases.length > 0
      && candidate.cases.every((replayCase) => (
        typeof replayCase.id === 'string'
        && typeof replayCase.label === 'string'
        && typeof replayCase.detail === 'string'
        && typeof replayCase.documentType === 'string'
        && Array.isArray(replayCase.fields)
        && replayCase.fields.length > 0
        && replayCase.fields.every((field) => (
          typeof field.id === 'string'
          && typeof field.label === 'string'
          && typeof field.value === 'string'
          && typeof field.confidencePct === 'number'
          && Number.isFinite(field.confidencePct)
          && typeof field.formatValid === 'boolean'
          && typeof field.reconciliationValid === 'boolean'
          && typeof field.correct === 'boolean'
          && typeof field.riskWeight === 'number'
          && Number.isFinite(field.riskWeight)
          && typeof field.source === 'string'
        ))
      )),
  );
}

export default function DocumentParsingSystemsEvidenceGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<GateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No extraction-gate model was supplied.');
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
        if (!isGateData(payload)) throw new Error('Extraction-gate data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load extraction-gate data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <EvidenceGateLab data={data} />;
}

function decideField(field: Field, policy: Policy, confidenceFloorPct: number): FieldDecision {
  if (field.confidencePct < confidenceFloorPct) return 'review';
  const formatFails = policy.requireFormat && !field.formatValid;
  const reconciliationFails = policy.requireReconciliation && !field.reconciliationValid;
  if (formatFails || reconciliationFails) {
    return policy.blockFailedValidation ? 'blocked' : 'review';
  }
  return 'accepted';
}

function EvidenceGateLab({ data }: { data: GateData }) {
  const [caseId, setCaseId] = useState(data.defaults.caseId);
  const [policyId, setPolicyId] = useState(data.defaults.policyId);
  const [confidenceFloorPct, setConfidenceFloorPct] = useState(data.defaults.confidenceFloorPct);

  const replayCase = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const decisions = replayCase.fields.map((field) => ({
      field,
      decision: decideField(field, policy, confidenceFloorPct),
    }));
    const accepted = decisions.filter((item) => item.decision === 'accepted');
    const review = decisions.filter((item) => item.decision === 'review');
    const blocked = decisions.filter((item) => item.decision === 'blocked');
    const escaped = accepted.filter((item) => !item.field.correct);
    const escapedRisk = escaped.reduce((sum, item) => sum + item.field.riskWeight, 0);
    const totalRisk = replayCase.fields.reduce((sum, field) => sum + field.riskWeight, 0);
    const autoAcceptPct = accepted.length / replayCase.fields.length * 100;

    const state = escapedRisk > 0
      ? {
          label: 'Unsafe release: incorrect evidence escapes',
          detail: `${escaped.length} labeled error${escaped.length === 1 ? '' : 's'} would be accepted. Confidence alone cannot prove cross-field correctness.`,
          tone: 'rose' as const,
          icon: ShieldAlert,
        }
      : review.length > 0 || blocked.length > 0
        ? {
            label: 'Hold affected fields for review or correction',
            detail: 'No labeled error is auto-accepted, but the document is not complete enough for an automatic downstream action.',
            tone: 'amber' as const,
            icon: Search,
          }
        : {
            label: 'All required fields can proceed in this replay',
            detail: 'The labeled replay passes the selected policy. Production release still requires representative slice evidence and monitoring.',
            tone: 'emerald' as const,
            icon: ShieldCheck,
          };

    return {
      accepted,
      autoAcceptPct,
      blocked,
      decisions,
      escapedRisk,
      review,
      state,
      totalRisk,
    };
  }, [confidenceFloorPct, policy, replayCase]);

  function reset() {
    setCaseId(data.defaults.caseId);
    setPolicyId(data.defaults.policyId);
    setConfidenceFloorPct(data.defaults.confidenceFloorPct);
  }

  const StateIcon = result.state.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Extraction evidence gate"
          title={data.title}
          description={data.description}
          icon={ClipboardCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Labeled replay case
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.cases.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === replayCase.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'clean-invoice' ? CheckCircle2 : FileWarning}
                      accent={item.id === 'clean-invoice' ? 'emerald' : item.id === 'missing-signature' ? 'violet' : 'rose'}
                      onClick={() => setCaseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Release policy
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'reconciled' ? ListChecks : Gauge}
                      accent={item.id === 'confidence-only' ? 'rose' : item.id === 'typed' ? 'amber' : 'emerald'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Confidence floor"
                value={confidenceFloorPct}
                output={`${confidenceFloorPct}%`}
                min={50}
                max={99}
                step={1}
                accent="blue"
                lowLabel="More automation"
                highLabel="More review"
                onChange={setConfidenceFloorPct}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Auto-accepted"
                value={`${result.accepted.length} / ${replayCase.fields.length}`}
                detail={`${result.autoAcceptPct.toFixed(0)}% of extracted fields`}
                icon={CheckCircle2}
                tone={result.escapedRisk === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Needs review"
                value={`${result.review.length}`}
                detail="Low confidence or a non-blocking failed check"
                icon={Search}
                tone={result.review.length > 0 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Blocked"
                value={`${result.blocked.length}`}
                detail="Failed a declared fail-closed invariant"
                icon={Ban}
                tone={result.blocked.length > 0 ? 'violet' : 'neutral'}
              />
              <LabMetric
                label="Escaped risk"
                value={`${result.escapedRisk} / ${result.totalRisk}`}
                detail="Weighted labeled error accepted by this policy"
                icon={ShieldAlert}
                tone={result.escapedRisk === 0 ? 'emerald' : 'rose'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{replayCase.documentType}</p>
                  <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">Field-by-field evidence</h4>
                </div>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Policy: {policy.label}</p>
              </div>
              <div className="mt-4 grid gap-3">
                {result.decisions.map(({ field, decision }) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    decision={decision}
                    policy={policy}
                    confidenceFloorPct={confidenceFloorPct}
                  />
                ))}
              </div>
            </section>

            <section className={`rounded-md border p-4 ${
              result.state.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                : result.state.tone === 'rose'
                  ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                <StateIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h4 className="font-semibold">{result.state.label}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-90">{result.state.detail}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

const statusStyles: Record<FieldDecision, string> = {
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
  review: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50',
  blocked: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
};

function FieldRow({
  field,
  decision,
  policy,
  confidenceFloorPct,
}: {
  field: Field;
  decision: FieldDecision;
  policy: Policy;
  confidenceFloorPct: number;
}) {
  const escapedError = decision === 'accepted' && !field.correct;
  const Icon = escapedError ? AlertTriangle : decision === 'accepted' ? CheckCircle2 : decision === 'blocked' ? Ban : Search;
  const reason = field.confidencePct < confidenceFloorPct
    ? 'Confidence is below the selected floor.'
      : policy.requireFormat && !field.formatValid
        ? 'Typed format validation failed.'
      : policy.requireReconciliation && !field.reconciliationValid
          ? 'Cross-field reconciliation failed.'
          : escapedError
            ? 'The labeled replay says this value is wrong, but the selected policy cannot detect the failure.'
          : 'Selected checks pass.';

  return (
    <article className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h5 className="font-semibold text-neutral-950 dark:text-white">{field.label}</h5>
          <p className="mt-1 break-words text-sm font-medium text-neutral-700 dark:text-neutral-200">{field.value}</p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {field.source}
          </p>
        </div>
        <span className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold capitalize ${escapedError ? statusStyles.blocked : statusStyles[decision]}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {escapedError ? 'accepted error' : decision}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        <EvidenceCheck label="Confidence" value={`${field.confidencePct}%`} passes={field.confidencePct >= confidenceFloorPct} />
        <EvidenceCheck label="Typed format" value={field.formatValid ? 'Pass' : 'Fail'} passes={field.formatValid} />
        <EvidenceCheck label="Reconciliation" value={field.reconciliationValid ? 'Pass' : 'Fail'} passes={field.reconciliationValid} />
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{reason}</p>
    </article>
  );
}

function EvidenceCheck({ label, value, passes }: { label: string; value: string; passes: boolean }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <span className="block text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className={`mt-1 block font-semibold ${passes ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{value}</span>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading extraction-gate model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Extraction-gate lab unavailable</p>
          <p className="mt-1 opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}
