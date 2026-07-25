'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  CircleX,
  FileWarning,
  Gavel,
  Layers3,
  LockKeyhole,
  MessageSquareWarning,
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

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  minimumCoverage: number;
  blockRisk: boolean;
  blockConflict: boolean;
};

type RequiredClaim = { id: string; label: string };

type EvidenceChunk = {
  id: string;
  title: string;
  source: string;
  tokens: number;
  relevance: number;
  trust: 'trusted' | 'risky';
  supports: string[];
  conflictGroup: string | null;
  excerpt: string;
};

type EvidenceScenario = {
  id: string;
  label: string;
  question: string;
  requiredClaims: RequiredClaim[];
  chunks: EvidenceChunk[];
};

type EvidenceGateData = {
  title: string;
  description: string;
  defaults: { scenarioId: string; budget: number; policyId: string };
  policies: EvidencePolicy[];
  scenarios: EvidenceScenario[];
};

const BLOCK_ID = 'genai/rag-evidence-gate-lab';

function isEvidenceGateData(value: unknown): value is EvidenceGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceGateData>;
  return Boolean(
    typeof candidate.title === 'string'
      && typeof candidate.description === 'string'
      && candidate.defaults
      && typeof candidate.defaults.scenarioId === 'string'
      && typeof candidate.defaults.budget === 'number'
      && typeof candidate.defaults.policyId === 'string'
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.detail === 'string'
        && typeof item.minimumCoverage === 'number'
        && typeof item.blockRisk === 'boolean'
        && typeof item.blockConflict === 'boolean'
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.question === 'string'
        && Array.isArray(scenario.requiredClaims)
        && scenario.requiredClaims.every((claim) => typeof claim.id === 'string' && typeof claim.label === 'string')
        && Array.isArray(scenario.chunks)
        && scenario.chunks.length > 0
        && scenario.chunks.every((chunk) => (
          typeof chunk.id === 'string'
          && typeof chunk.title === 'string'
          && typeof chunk.source === 'string'
          && typeof chunk.tokens === 'number'
          && typeof chunk.relevance === 'number'
          && ['trusted', 'risky'].includes(chunk.trust)
          && Array.isArray(chunk.supports)
          && chunk.supports.every((claim) => typeof claim === 'string')
          && (chunk.conflictGroup === null || typeof chunk.conflictGroup === 'string')
          && typeof chunk.excerpt === 'string'
        ))
      )),
  );
}

export default function RagEvidenceGateLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<EvidenceGateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No evidence scenario file was supplied.');
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
        if (!isEvidenceGateData(payload)) throw new Error('Evidence gate data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the evidence gate.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadState detail={error} />;
  if (!data) return <LoadState />;
  return <EvidenceGate data={data} />;
}

function EvidenceGate({ data }: { data: EvidenceGateData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialPolicy = data.policies.find((item) => item.id === data.defaults.policyId)
    ?? data.policies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [policyId, setPolicyId] = useState(initialPolicy.id);
  const [budget, setBudget] = useState(data.defaults.budget);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];

  const model = useMemo(() => {
    const ranked = [...scenario.chunks].sort((left, right) => right.relevance - left.relevance);
    const included: EvidenceChunk[] = [];
    const excluded: Array<EvidenceChunk & { reason: 'budget' | 'quarantine' }> = [];
    let usedTokens = 0;

    for (const chunk of ranked) {
      if (policy.blockRisk && chunk.trust === 'risky') {
        excluded.push({ ...chunk, reason: 'quarantine' });
        continue;
      }
      if (usedTokens + chunk.tokens > budget) {
        excluded.push({ ...chunk, reason: 'budget' });
        continue;
      }
      included.push(chunk);
      usedTokens += chunk.tokens;
    }

    const supported = new Set(included.flatMap((chunk) => chunk.supports));
    const missingClaims = scenario.requiredClaims.filter((claim) => !supported.has(claim.id));
    const coverage = scenario.requiredClaims.length === 0
      ? 1
      : supported.size / scenario.requiredClaims.length;
    const conflictGroups = new Map<string, number>();
    for (const chunk of included) {
      if (!chunk.conflictGroup) continue;
      conflictGroups.set(chunk.conflictGroup, (conflictGroups.get(chunk.conflictGroup) ?? 0) + 1);
    }
    const conflicts = [...conflictGroups.entries()].filter(([, count]) => count > 1).map(([group]) => group);
    const riskyIncluded = included.filter((chunk) => chunk.trust === 'risky');
    const thresholdPassed = coverage >= policy.minimumCoverage;
    const conflictBlocked = policy.blockConflict && conflicts.length > 0;
    const decision = conflictBlocked ? 'escalate' : thresholdPassed ? 'answer' : 'abstain';

    return {
      conflicts,
      coverage,
      decision,
      excluded,
      included,
      missingClaims,
      riskyIncluded,
      usedTokens,
    };
  }, [budget, policy, scenario]);

  const decisionStyle = model.decision === 'answer'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
    : model.decision === 'escalate'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50';

  function reset() {
    setScenarioId(initialScenario.id);
    setPolicyId(initialPolicy.id);
    setBudget(data.defaults.budget);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence decision lab"
          title={data.title}
          description={data.description}
          icon={Gavel}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Evidence condition
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.question}
                      icon={item.id === 'poisoned' ? ShieldAlert : BookOpenCheck}
                      accent={item.id === 'poisoned' ? 'rose' : 'blue'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Evidence token budget"
                value={budget}
                output={`${budget} tokens`}
                min={180}
                max={650}
                step={10}
                lowLabel="Tight packet"
                highLabel="Broader packet"
                accent="emerald"
                onChange={setBudget}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Answer policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === policy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'grounded' ? ShieldCheck : MessageSquareWarning}
                      accent={item.id === 'grounded' ? 'emerald' : 'amber'}
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="space-y-5">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Question</p>
              <p className="mt-2 text-base font-semibold leading-6 text-neutral-950 dark:text-white">
                “{scenario.question}”
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scenario.requiredClaims.map((claim) => {
                  const missing = model.missingClaims.some((item) => item.id === claim.id);
                  return (
                    <span key={claim.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${missing ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100' : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'}`}>
                      {missing ? <CircleX aria-hidden="true" className="h-3.5 w-3.5" /> : <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />}
                      {claim.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Claim support"
                value={`${Math.round(model.coverage * 100)}%`}
                detail={`${scenario.requiredClaims.length - model.missingClaims.length}/${scenario.requiredClaims.length} required claims`}
                icon={BookOpenCheck}
                tone={model.coverage === 1 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Context used"
                value={`${model.usedTokens}/${budget}`}
                detail="Evidence tokens"
                icon={Layers3}
                tone="blue"
              />
              <LabMetric
                label="Conflicts"
                value={String(model.conflicts.length)}
                detail="Competing source claims"
                icon={CircleAlert}
                tone={model.conflicts.length > 0 ? 'amber' : 'neutral'}
              />
              <LabMetric
                label="Risky included"
                value={String(model.riskyIncluded.length)}
                detail="Untrusted instruction paths"
                icon={LockKeyhole}
                tone={model.riskyIncluded.length > 0 ? 'rose' : 'neutral'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence packet</h4>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Relevance order, bounded by policy and tokens
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {scenario.chunks
                  .slice()
                  .sort((left, right) => right.relevance - left.relevance)
                  .map((chunk) => {
                    const included = model.included.some((item) => item.id === chunk.id);
                    const excluded = model.excluded.find((item) => item.id === chunk.id);
                    return (
                      <article key={chunk.id} className={`rounded-md border p-4 ${included ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/25' : excluded?.reason === 'quarantine' ? 'border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/25' : 'border-neutral-200 bg-neutral-50 opacity-75 dark:border-neutral-800 dark:bg-neutral-900/60'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {chunk.trust === 'risky' ? <FileWarning aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" /> : <BookOpenCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />}
                              <h5 className="font-semibold text-neutral-950 dark:text-white">{chunk.title}</h5>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{chunk.source}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${included ? 'border-emerald-300 bg-white text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100' : excluded?.reason === 'quarantine' ? 'border-rose-300 bg-white text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100' : 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}>
                            {included ? 'Included' : excluded?.reason === 'quarantine' ? 'Quarantined' : 'Over budget'}
                          </span>
                        </div>
                        <blockquote className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm leading-6 text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                          {chunk.excerpt}
                        </blockquote>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{chunk.tokens} tokens</span>
                          <span>Relevance {chunk.relevance.toFixed(2)}</span>
                          <span>{chunk.supports.length > 0 ? `Supports ${chunk.supports.length} claim${chunk.supports.length === 1 ? '' : 's'}` : 'No required claim'}</span>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>

            <div className={`flex items-start gap-3 rounded-md border p-5 ${decisionStyle}`}>
              {model.decision === 'answer' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : model.decision === 'escalate' ? <CircleAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" /> : <CircleX aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">Answer gate</p>
                <p className="mt-1 text-xl font-semibold capitalize">{model.decision}</p>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  {model.decision === 'answer'
                    ? model.riskyIncluded.length > 0
                      ? 'The selected policy allows an answer, but untrusted instructions entered context. Treat this as an unsafe best-effort outcome.'
                      : 'Every required claim has included support and no blocking conflict remains. Generate with claim-level citations.'
                    : model.decision === 'escalate'
                      ? 'Included sources disagree on a required claim. Preserve both citations and route source authority to an owner.'
                      : `Do not fill the gap from model memory. Missing: ${model.missingClaims.map((claim) => claim.label).join(', ') || 'required support'}.`}
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadState({ detail }: { detail?: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-200">
        <Layers3 aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-semibold">{detail ?? 'Loading evidence scenarios…'}</p>
      </div>
    </div>
  );
}
