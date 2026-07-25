'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileClock,
  FileWarning,
  Gauge,
  Link2,
  LockKeyhole,
  MessageSquareQuote,
  Route,
  ShieldCheck,
  ShieldX,
  Siren,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type EvidenceChunk = {
  id: string;
  label: string;
  tokens: number;
  ageHours: number;
  score: number;
  supports: string[];
  hasInjection: boolean;
  conflictGroup?: string;
};

type AnswerScenario = {
  id: string;
  label: string;
  detail: string;
  query: string;
  totalClaims: number;
  outputTokens: number;
  retrievalLatencyMs: number;
  freshnessSlaHours: number;
  chunks: EvidenceChunk[];
};

type CitationPolicy = {
  id: string;
  label: string;
  detail: string;
  coverageMultiplier: number;
  tokenOverhead: number;
  latencyMs: number;
};

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  quarantineInjection: boolean;
  latencyMs: number;
};

type Fallback = {
  id: string;
  label: string;
  detail: string;
};

type AnswerGateData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    contextBudgetTokens: number;
    maxSourceAgeHours: number;
    citationPolicyId: string;
    evidencePolicyId: string;
    fallbackId: string;
  };
  controls: {
    contextBudgetTokens: { min: number; max: number; step: number };
    maxSourceAgeHours: { min: number; max: number; step: number };
  };
  gates: {
    minGroundedClaimRate: number;
    minCitationCoverage: number;
    maxP95LatencyMs: number;
    maxCostUnits: number;
  };
  citationPolicies: CitationPolicy[];
  evidencePolicies: EvidencePolicy[];
  fallbacks: Fallback[];
  scenarios: AnswerScenario[];
};

type VerdictTone = 'emerald' | 'amber' | 'rose';

const BLOCK_ID = 'genai/rag-systems-foundation-answer-gate-lab';

function isAnswerGateData(value: unknown): value is AnswerGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AnswerGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.controls
      && candidate.gates
      && Array.isArray(candidate.citationPolicies)
      && candidate.citationPolicies.length > 0
      && Array.isArray(candidate.evidencePolicies)
      && candidate.evidencePolicies.length > 0
      && Array.isArray(candidate.fallbacks)
      && candidate.fallbacks.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function RagSystemsFoundationAnswerGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AnswerGateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No answer-gate model was supplied.');
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
        if (!isAnswerGateData(payload)) throw new Error('Answer-gate data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load answer-gate data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <AnswerGateWorkbench data={data} />;
}

function AnswerGateWorkbench({ data }: { data: AnswerGateData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [contextBudgetTokens, setContextBudgetTokens] = useState(data.defaults.contextBudgetTokens);
  const [maxSourceAgeHours, setMaxSourceAgeHours] = useState(data.defaults.maxSourceAgeHours);
  const [citationPolicyId, setCitationPolicyId] = useState(data.defaults.citationPolicyId);
  const [evidencePolicyId, setEvidencePolicyId] = useState(data.defaults.evidencePolicyId);
  const [fallbackId, setFallbackId] = useState(data.defaults.fallbackId);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const citationPolicy = data.citationPolicies.find((item) => item.id === citationPolicyId)
    ?? data.citationPolicies[0];
  const evidencePolicy = data.evidencePolicies.find((item) => item.id === evidencePolicyId)
    ?? data.evidencePolicies[0];
  const fallback = data.fallbacks.find((item) => item.id === fallbackId) ?? data.fallbacks[0];

  const result = useMemo(() => {
    const staleChunks = scenario.chunks.filter((chunk) => chunk.ageHours > maxSourceAgeHours);
    const ageEligible = scenario.chunks.filter((chunk) => chunk.ageHours <= maxSourceAgeHours);
    const quarantinedChunks = evidencePolicy.quarantineInjection
      ? ageEligible.filter((chunk) => chunk.hasInjection)
      : [];
    const candidates = ageEligible
      .filter((chunk) => !evidencePolicy.quarantineInjection || !chunk.hasInjection)
      .sort((left, right) => right.score - left.score);

    const packedChunks: EvidenceChunk[] = [];
    let packedTokens = 0;
    for (const chunk of candidates) {
      if (packedTokens + chunk.tokens > contextBudgetTokens) continue;
      packedChunks.push(chunk);
      packedTokens += chunk.tokens;
    }

    const supportIds = new Set(packedChunks.flatMap((chunk) => chunk.supports));
    const groundedClaimRate = clamp(supportIds.size / scenario.totalClaims, 0, 1);
    const citationCoverage = clamp(
      groundedClaimRate * citationPolicy.coverageMultiplier,
      0,
      1,
    );
    const maxPackedAgeHours = packedChunks.reduce(
      (maximum, chunk) => Math.max(maximum, chunk.ageHours),
      0,
    );
    const unsafeEvidenceExposed = packedChunks.some((chunk) => chunk.hasInjection);

    const conflictCounts = new Map<string, number>();
    for (const chunk of packedChunks) {
      if (!chunk.conflictGroup) continue;
      conflictCounts.set(chunk.conflictGroup, (conflictCounts.get(chunk.conflictGroup) ?? 0) + 1);
    }
    const conflictingGroups = [...conflictCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([group]) => group);

    const freshnessPass = packedChunks.length > 0
      && maxPackedAgeHours <= scenario.freshnessSlaHours;
    const groundingPass = groundedClaimRate >= data.gates.minGroundedClaimRate;
    const citationPass = citationCoverage >= data.gates.minCitationCoverage;
    const injectionPass = !unsafeEvidenceExposed;
    const conflictPass = conflictingGroups.length === 0;
    const p95LatencyMs = scenario.retrievalLatencyMs
      + evidencePolicy.latencyMs
      + citationPolicy.latencyMs
      + packedTokens * 0.31
      + scenario.outputTokens * 0.95;
    const costUnits = (
      packedTokens + scenario.outputTokens + citationPolicy.tokenOverhead
    ) / 1000 * 2.2;
    const latencyPass = p95LatencyMs <= data.gates.maxP95LatencyMs;
    const costPass = costUnits <= data.gates.maxCostUnits;

    const blockers = [
      !groundingPass ? `Only ${supportIds.size} of ${scenario.totalClaims} claims have packed support.` : null,
      !citationPass ? 'Claim-to-source citation coverage is below the release floor.' : null,
      !freshnessPass ? `Packed evidence exceeds the ${scenario.freshnessSlaHours}-hour freshness SLA or no evidence remains.` : null,
      !injectionPass ? 'A suspicious retrieved instruction reaches the model context.' : null,
      !conflictPass ? `Conflicting source group detected: ${conflictingGroups.join(', ')}.` : null,
      !latencyPass ? 'Modeled p95 latency exceeds the service budget.' : null,
      !costPass ? 'Modeled per-answer cost exceeds the service budget.' : null,
    ].filter((item): item is string => Boolean(item));

    const mayAnswer = blockers.length === 0;
    let verdict = 'Serve a grounded answer with claim-linked evidence';
    let detail = 'All evidence, safety, freshness, citation, latency, and cost gates pass for this planning scenario.';
    let tone: VerdictTone = 'emerald';

    if (!mayAnswer && fallback.id === 'best-effort') {
      verdict = 'Block the requested best-effort answer';
      detail = 'The selected fallback would expose a factual answer despite a failed gate. Contain the request instead.';
      tone = 'rose';
    } else if (!mayAnswer && fallback.id === 'review') {
      verdict = 'Contain and route to bounded review';
      detail = 'Preserve the trace, sources, and failed gates for a qualified reviewer; do not widen automatic exposure.';
      tone = 'amber';
    } else if (!mayAnswer) {
      verdict = 'Contain with an evidence-aware abstention';
      detail = 'Return no factual answer, name the missing or unsafe evidence condition, and retain the trace for diagnosis.';
      tone = 'amber';
    }

    return {
      blockers,
      citationCoverage,
      citationPass,
      conflictPass,
      costPass,
      costUnits,
      detail,
      freshnessPass,
      groundedClaimRate,
      groundingPass,
      injectionPass,
      latencyPass,
      maxPackedAgeHours,
      mayAnswer,
      packedChunks,
      packedTokens,
      p95LatencyMs,
      quarantinedChunks,
      staleChunks,
      tone,
      verdict,
    };
  }, [
    citationPolicy,
    contextBudgetTokens,
    data.gates,
    evidencePolicy,
    fallback.id,
    maxSourceAgeHours,
    scenario,
  ]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setContextBudgetTokens(data.defaults.contextBudgetTokens);
    setMaxSourceAgeHours(data.defaults.maxSourceAgeHours);
    setCitationPolicyId(data.defaults.citationPolicyId);
    setEvidencePolicyId(data.defaults.evidencePolicyId);
    setFallbackId(data.defaults.fallbackId);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Grounding and containment lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Retrieved evidence
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={scenarioIcon(item.id)}
                      accent={item.id === 'healthy-evidence' ? 'emerald' : item.id === 'indirect-injection' ? 'rose' : 'amber'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Evidence token budget"
                value={contextBudgetTokens}
                output={`${contextBudgetTokens.toLocaleString()} tokens`}
                min={data.controls.contextBudgetTokens.min}
                max={data.controls.contextBudgetTokens.max}
                step={data.controls.contextBudgetTokens.step}
                accent="blue"
                lowLabel="Selective"
                highLabel="More context and cost"
                onChange={setContextBudgetTokens}
              />

              <LabRange
                label="Maximum accepted source age"
                value={maxSourceAgeHours}
                output={`${maxSourceAgeHours} hours`}
                min={data.controls.maxSourceAgeHours.min}
                max={data.controls.maxSourceAgeHours.max}
                step={data.controls.maxSourceAgeHours.step}
                accent="amber"
                lowLabel="Fresh only"
                highLabel="Older evidence allowed"
                onChange={setMaxSourceAgeHours}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Evidence boundary
                </legend>
                <div className="mt-3 space-y-2">
                  {data.evidencePolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === evidencePolicy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'quarantine' ? LockKeyhole : item.id === 'delimit-only' ? FileWarning : ShieldX}
                      accent={item.id === 'quarantine' ? 'emerald' : item.id === 'delimit-only' ? 'amber' : 'rose'}
                      onClick={() => setEvidencePolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Citation contract
                </legend>
                <div className="mt-3 space-y-2">
                  {data.citationPolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === citationPolicy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'claim-links' ? Link2 : MessageSquareQuote}
                      accent={item.id === 'claim-links' ? 'blue' : item.id === 'source-list' ? 'amber' : 'rose'}
                      onClick={() => setCitationPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Failed-gate action
                </legend>
                <div className="mt-3 space-y-2">
                  {data.fallbacks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === fallback.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'best-effort' ? AlertTriangle : item.id === 'review' ? Route : ShieldCheck}
                      accent={item.id === 'best-effort' ? 'rose' : item.id === 'review' ? 'violet' : 'emerald'}
                      onClick={() => setFallbackId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[720px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Grounded claims"
                value={`${(result.groundedClaimRate * 100).toFixed(0)}%`}
                detail={`${(data.gates.minGroundedClaimRate * 100).toFixed(0)}% release floor`}
                icon={FileCheck2}
                tone={result.groundingPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Citation coverage"
                value={`${(result.citationCoverage * 100).toFixed(0)}%`}
                detail={`${(data.gates.minCitationCoverage * 100).toFixed(0)}% claim-linked floor`}
                icon={Link2}
                tone={result.citationPass ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Modeled end-to-end p95"
                value={`${result.p95LatencyMs.toFixed(0)} ms`}
                detail={`${data.gates.maxP95LatencyMs} ms service budget`}
                icon={Gauge}
                tone={result.latencyPass ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Modeled answer cost"
                value={`${result.costUnits.toFixed(2)} units`}
                detail={`${data.gates.maxCostUnits.toFixed(1)}-unit planning ceiling`}
                icon={CircleDollarSign}
                tone={result.costPass ? 'cyan' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Prompt assembly trace
                </p>
                <h4 className="mt-1 break-words text-base font-semibold text-neutral-950 dark:text-white">
                  {scenario.query}
                </h4>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  {result.packedTokens.toLocaleString()} of {contextBudgetTokens.toLocaleString()} evidence tokens packed
                </p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <EvidenceList
                  title="Packed as untrusted evidence"
                  empty="No eligible chunks fit the current policy and budget."
                  chunks={result.packedChunks}
                  icon={FileCheck2}
                  tone="accepted"
                />
                <div className="space-y-3">
                  <EvidenceList
                    title="Excluded by freshness"
                    empty="No chunks were excluded by source age."
                    chunks={result.staleChunks}
                    icon={FileClock}
                    tone="excluded"
                  />
                  <EvidenceList
                    title="Quarantined before assembly"
                    empty="No suspicious chunks were quarantined."
                    chunks={result.quarantinedChunks}
                    icon={ShieldX}
                    tone="blocked"
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2" aria-label="Answer release gates">
              <GateRow label="Grounded claim floor" passed={result.groundingPass} icon={FileCheck2} />
              <GateRow label="Claim-linked citation floor" passed={result.citationPass} icon={Link2} />
              <GateRow
                label={`Freshness SLA (${scenario.freshnessSlaHours} hours)`}
                passed={result.freshnessPass}
                icon={Clock3}
              />
              <GateRow label="No retrieved instruction exposure" passed={result.injectionPass} icon={LockKeyhole} />
              <GateRow label="No unresolved source conflict" passed={result.conflictPass} icon={FileWarning} />
              <GateRow label="Latency and cost budgets" passed={result.latencyPass && result.costPass} icon={Gauge} />
            </section>

            <div className={`rounded-md border p-5 ${verdictStyles[result.tone]}`}>
              <div className="flex items-start gap-3">
                {result.mayAnswer ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : result.tone === 'rose' ? (
                  <Siren aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Serve decision</p>
                  <h4 className="mt-1 text-lg font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">{result.detail}</p>
                  {result.blockers.length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 opacity-85">
                      {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-2 rounded-md border border-neutral-200 bg-white p-4 text-xs text-neutral-600 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              <TraceField label="Trace identity" value={`rag-demo/${scenario.id}`} />
              <TraceField label="Source snapshot" value={`${scenario.id}/published`} />
              <TraceField label="Policy versions" value={`${evidencePolicy.id} + ${citationPolicy.id}`} />
              <TraceField label="Packed source age" value={`${result.maxPackedAgeHours} hours maximum`} />
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Cost and latency coefficients are synthetic. The gate behavior is the lesson: a larger context can improve support while increasing exposure, latency, and cost; no context size overrides failed safety or freshness evidence.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function scenarioIcon(id: string): LucideIcon {
  if (id === 'healthy-evidence') return FileCheck2;
  if (id === 'stale-release-note') return FileClock;
  if (id === 'indirect-injection') return ShieldX;
  return FileWarning;
}

const verdictStyles: Record<VerdictTone, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50',
};

function EvidenceList({
  title,
  empty,
  chunks,
  icon: Icon,
  tone,
}: {
  title: string;
  empty: string;
  chunks: EvidenceChunk[];
  icon: LucideIcon;
  tone: 'accepted' | 'excluded' | 'blocked';
}) {
  const toneClasses = {
    accepted: 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
    excluded: 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300',
    blocked: 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300',
  };

  return (
    <div className={`rounded-md border bg-white p-3 dark:bg-neutral-950 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold uppercase">{title}</p>
      </div>
      {chunks.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {chunks.map((chunk) => (
            <li key={chunk.id} className="flex min-w-0 items-start justify-between gap-3 border-t border-neutral-200 pt-2 text-neutral-700 first:border-t-0 first:pt-0 dark:border-neutral-800 dark:text-neutral-200">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">{chunk.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  {chunk.tokens} tokens; age {chunk.ageHours}h
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{chunk.score.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{empty}</p>
      )}
    </div>
  );
}

function GateRow({ label, passed, icon: Icon }: { label: string; passed: boolean; icon: LucideIcon }) {
  return (
    <div className={`flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 ${passed ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      <span className="shrink-0 text-xs font-semibold uppercase">{passed ? 'Pass' : 'Block'}</span>
    </div>
  );
}

function TraceField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="mt-1 block break-words font-mono text-neutral-800 dark:text-neutral-100">{value}</span>
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 min-h-96 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">Loading the answer-gate model...</p>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-200 bg-rose-50 p-6 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
      <p className="font-semibold">Answer-gate model unavailable</p>
      <p className="mt-1 text-sm opacity-80">{detail}</p>
    </div>
  );
}
