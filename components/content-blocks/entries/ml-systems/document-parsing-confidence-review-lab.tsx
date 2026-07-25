'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Gauge,
  Search,
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

const BLOCK_ID = 'ml-systems/document-parsing-confidence-review-lab';

type Field = {
  id: string;
  label: string;
  value: string;
  confidence: number;
  formatValid: boolean;
  reconciliationValid: boolean;
  correct: boolean;
  risk: number;
};

type ReplayCase = {
  id: string;
  label: string;
  detail: string;
  fields: Field[];
};

type Policy = {
  id: string;
  label: string;
  detail: string;
  requireFormat: boolean;
  requireReconciliation: boolean;
};

type LabData = {
  title: string;
  description: string;
  defaultCaseId: string;
  defaultPolicyId: string;
  defaultConfidenceFloor: number;
  policies: Policy[];
  cases: ReplayCase[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaultCaseId === 'string'
      && typeof data.defaultPolicyId === 'string'
      && typeof data.defaultConfidenceFloor === 'number'
      && Array.isArray(data.policies)
      && data.policies.length > 0
      && Array.isArray(data.cases)
      && data.cases.length > 0,
  );
}

export default function DocumentParsingConfidenceReviewLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No confidence and review model was supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Confidence model request failed (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Confidence model data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load confidence model.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>;
  }
  if (!data) {
    return <div className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading confidence and review lab" />;
  }
  return <ConfidenceReviewLab data={data} />;
}

function ConfidenceReviewLab({ data }: { data: LabData }) {
  const [caseId, setCaseId] = useState(data.defaultCaseId);
  const [policyId, setPolicyId] = useState(data.defaultPolicyId);
  const [confidenceFloor, setConfidenceFloor] = useState(data.defaultConfidenceFloor);
  const replayCase = data.cases.find((item) => item.id === caseId) ?? data.cases[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    const decisions = replayCase.fields.map((field) => {
      const lowConfidence = field.confidence < confidenceFloor;
      const invalidFormat = policy.requireFormat && !field.formatValid;
      const conflict = policy.requireReconciliation && !field.reconciliationValid;
      return { field, route: lowConfidence || invalidFormat || conflict ? 'review' : 'accept' };
    });
    const accepted = decisions.filter((item) => item.route === 'accept');
    const review = decisions.filter((item) => item.route === 'review');
    const escaped = accepted.filter((item) => !item.field.correct);
    const escapedRisk = escaped.reduce((sum, item) => sum + item.field.risk, 0);
    const totalRisk = replayCase.fields.reduce((sum, field) => sum + field.risk, 0);
    const status = escaped.length > 0
      ? 'Unsafe auto-accept'
      : review.length > 0
        ? 'Bounded review required'
        : 'Candidate passes this replay';
    const consequence = escaped.length > 0
      ? 'An incorrect field crosses the automatic boundary. Add the missing invariant or remove decision authority.'
      : review.length > 0
        ? 'No labeled error escapes, but the selected threshold sends fields to review and consumes human capacity.'
        : 'All labeled fields pass this policy. Release still depends on representative slice and capacity evidence.';
    return { accepted, consequence, decisions, escaped, escapedRisk, review, status, totalRisk };
  }, [confidenceFloor, policy, replayCase]);

  const unsafe = result.escaped.length > 0;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Confidence and review lab" title={data.title} description={data.description} icon={ShieldCheck} accent="amber" onReset={() => { setCaseId(data.defaultCaseId); setPolicyId(data.defaultPolicyId); setConfidenceFloor(data.defaultConfidenceFloor); }} />
        <LearningLabBody controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Labeled replay case</legend>
              <div className="mt-3 grid gap-2">
                {data.cases.map((item) => <LabChoice key={item.id} selected={item.id === replayCase.id} label={item.label} detail={item.detail} icon={item.id === 'clean-invoice' ? CheckCircle2 : FileWarning} accent={item.id === 'reconciliation-conflict' ? 'rose' : 'cyan'} onClick={() => setCaseId(item.id)} />)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Release policy</legend>
              <div className="mt-3 grid gap-2">
                {data.policies.map((item) => <LabChoice key={item.id} selected={item.id === policy.id} label={item.label} detail={item.detail} icon={ShieldCheck} accent={item.id === 'confidence-only' ? 'rose' : 'emerald'} onClick={() => setPolicyId(item.id)} />)}
              </div>
            </fieldset>
            <LabRange label="3. Confidence floor" value={confidenceFloor} output={`${confidenceFloor}%`} min={50} max={99} accent="blue" lowLabel="More automation" highLabel="More review" onChange={setConfidenceFloor} />
          </div>
        )}>
          <div className="min-w-0" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric label="Auto-accepted" value={`${result.accepted.length} / ${replayCase.fields.length}`} detail="Fields allowed past this gate" icon={CheckCircle2} tone={unsafe ? 'rose' : 'emerald'} />
              <LabMetric label="Needs review" value={String(result.review.length)} detail="Low score or failed declared validation" icon={Search} tone={result.review.length > 0 ? 'amber' : 'neutral'} />
              <LabMetric label="Escaped risk" value={`${result.escapedRisk} / ${result.totalRisk}`} detail="Labeled error weight accepted automatically" icon={AlertTriangle} tone={unsafe ? 'rose' : 'blue'} />
            </div>
            <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              {result.decisions.map(({ field, route }) => (
                <div key={field.id} className="grid gap-2 border-t border-neutral-200 px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center dark:border-neutral-800">
                  <div className="min-w-0"><p className="text-sm font-semibold text-neutral-950 dark:text-white">{field.label}: {field.value}</p><p className="text-xs text-neutral-500 dark:text-neutral-400">Confidence {field.confidence}%</p></div>
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{field.reconciliationValid ? 'Rules agree' : 'Rule conflict'}</span>
                  <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold ${route === 'accept' ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'}`}>{route === 'accept' ? 'Accept' : 'Review'}</span>
                </div>
              ))}
            </div>
            <div className={`mt-5 rounded-md border p-4 ${unsafe ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'}`}>
              <div className="flex items-start gap-3"><Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-300" /><div><p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.status}</p><p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.consequence}</p></div></div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
