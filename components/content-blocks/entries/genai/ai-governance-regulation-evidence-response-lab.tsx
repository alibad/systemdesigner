'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  GitCompareArrows,
  History,
  LoaderCircle,
  Route,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ActionId = 'continue' | 'canary' | 'hold' | 'rollback';
type ScenarioMode = 'change' | 'incident';
type Tone = 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';

interface EvidenceAction {
  id: ActionId;
  label: string;
  detail: string;
}

interface EvidenceBundle {
  id: string;
  label: string;
  detail: string;
  available: string[];
  traceability: number;
}

interface EvidenceScenario {
  id: string;
  label: string;
  detail: string;
  mode: ScenarioMode;
  required: string[];
  critical: string[];
  gateScore: number;
  recommendedWithEvidence: ActionId;
  recommendedWithoutEvidence: ActionId;
  blastRadius: string;
}

interface EvidenceResponseModel {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    bundleId: string;
    actionId: ActionId;
  };
  actions: EvidenceAction[];
  bundles: EvidenceBundle[];
  scenarios: EvidenceScenario[];
}

const BLOCK_ID = 'genai/ai-governance-regulation-evidence-response-lab';

const evidenceLabels: Record<string, string> = {
  inventory: 'System identity',
  'risk-map': 'Risk and role map',
  'quality-eval': 'Quality evidence',
  'safety-eval': 'Safety evidence',
  'security-review': 'Security review',
  'oversight-drill': 'Oversight drill',
  'incident-plan': 'Incident plan',
};

function isEvidenceResponseModel(value: unknown): value is EvidenceResponseModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceResponseModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.actions)
      && candidate.actions.length > 0
      && Array.isArray(candidate.bundles)
      && candidate.bundles.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function AiGovernanceRegulationEvidenceResponseLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvidenceResponseModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No governance evidence model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEvidenceResponseModel(payload)) throw new Error('Governance evidence data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the evidence model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <EvidenceResponseLab data={data} />;
}

function EvidenceResponseLab({ data }: { data: EvidenceResponseModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [bundleId, setBundleId] = useState(data.defaults.bundleId);
  const [actionId, setActionId] = useState<ActionId>(data.defaults.actionId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const bundle = data.bundles.find((item) => item.id === bundleId) ?? data.bundles[0];
  const action = data.actions.find((item) => item.id === actionId) ?? data.actions[0];

  const result = useMemo(() => {
    const present = scenario.required.filter((item) => bundle.available.includes(item));
    const missing = scenario.required.filter((item) => !bundle.available.includes(item));
    const missingCritical = missing.filter((item) => scenario.critical.includes(item));
    const coverage = present.length / scenario.required.length;
    const evidenceScore = Math.round(coverage * 70 + bundle.traceability * 0.3);
    const sufficient = evidenceScore >= scenario.gateScore && missingCritical.length === 0;
    const recommended = sufficient
      ? scenario.recommendedWithEvidence
      : scenario.recommendedWithoutEvidence;
    const matches = actionId === recommended;
    const unsafe = actionId === 'continue' && !sufficient;
    const tone: Tone = unsafe ? 'rose' : matches ? 'emerald' : 'amber';

    let verdict = 'The response does not match the available evidence';
    if (unsafe) verdict = 'Full exposure is unsupported by the evidence chain';
    else if (matches && sufficient) verdict = 'The response is bounded and evidence-supported';
    else if (matches) verdict = scenario.mode === 'incident'
      ? 'Rollback contains harm while evidence is reconstructed'
      : 'The change remains blocked until critical evidence is repaired';

    return {
      coverage,
      evidenceScore,
      matches,
      missing,
      missingCritical,
      present,
      recommended,
      sufficient,
      tone,
      verdict,
    };
  }, [actionId, bundle, scenario]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setBundleId(data.defaults.bundleId);
    setActionId(data.defaults.actionId);
  };

  const recommendedLabel = data.actions.find((item) => item.id === result.recommended)?.label
    ?? result.recommended;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence continuity lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Material event
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.mode === 'incident' ? ShieldAlert : GitCompareArrows}
                      accent={item.mode === 'incident' ? 'rose' : 'violet'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Evidence packet
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.bundles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={bundle.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileCheck2}
                      accent={item.id === 'versioned' ? 'emerald' : item.id === 'partial' ? 'amber' : 'rose'}
                      onClick={() => setBundleId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Commit a response
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.actions.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={action.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'rollback' ? History : item.id === 'hold' ? ShieldAlert : Route}
                      accent={item.id === 'continue' ? 'blue' : item.id === 'canary' ? 'violet' : item.id === 'hold' ? 'amber' : 'rose'}
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
                label="Evidence coverage"
                value={`${Math.round(result.coverage * 100)}%`}
                detail={`${result.present.length} of ${scenario.required.length} required artifacts present`}
                icon={ClipboardCheck}
                tone={result.coverage === 1 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Decision evidence"
                value={`${result.evidenceScore} / 100`}
                detail={`Gate for this event: ${scenario.gateScore}`}
                icon={FileCheck2}
                tone={result.sufficient ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Critical gaps"
                value={result.missingCritical.length.toString()}
                detail={result.missingCritical.length === 0 ? 'No hard evidence blockers' : 'Hard blockers remain'}
                icon={result.missingCritical.length === 0 ? CheckCircle2 : XCircle}
                tone={result.missingCritical.length === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Supported response"
                value={recommendedLabel}
                detail={result.matches ? 'Matches your decision' : 'Differs from your decision'}
                icon={Route}
                tone={result.matches ? 'blue' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Evidence chain for the candidate
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    Blast radius: {scenario.blastRadius}.
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {scenario.mode}
                </span>
              </div>
              <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {scenario.required.map((item, index) => {
                  const available = bundle.available.includes(item);
                  const critical = scenario.critical.includes(item);
                  return (
                    <li
                      key={item}
                      className={`min-w-0 rounded-md border p-3 ${available
                        ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
                        : critical
                          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                          : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase opacity-70">Link {index + 1}</span>
                        {available
                          ? <CheckCircle2 aria-label="Present" className="h-4 w-4 shrink-0" />
                          : <XCircle aria-label="Missing" className="h-4 w-4 shrink-0" />}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{evidenceLabels[item] ?? item}</p>
                      <p className="mt-1 text-xs leading-5 opacity-75">
                        {available ? 'Current artifact in this packet' : critical ? 'Missing critical evidence' : 'Missing supporting evidence'}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Decision consequence</p>
                  <p className="mt-2 text-base font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    Your choice: {action.label}. Supported choice: {recommendedLabel}. The packet has {bundle.traceability}% traceability and {result.missing.length} missing required artifact{result.missing.length === 1 ? '' : 's'}.
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

function LabLoading() {
  return (
    <LearningLab>
      <LearningLabBody>
        <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading governance evidence model...
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <LearningLab>
      <LearningLabBody>
        <div role="alert" className="flex min-h-48 items-center justify-center gap-3 text-sm text-rose-700 dark:text-rose-300">
          <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>{detail}</span>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
