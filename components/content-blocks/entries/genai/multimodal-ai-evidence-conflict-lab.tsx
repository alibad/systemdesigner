'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileSearch,
  GitCompareArrows,
  ScanText,
  ShieldAlert,
  UserCheck,
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

type EvidenceModality = 'vision' | 'ocr' | 'audio' | 'transcript' | 'metadata' | 'record';

type EvidenceItem = {
  id: string;
  label: string;
  modality: EvidenceModality;
  value: string;
  confidence: number;
  authority: number;
  provenance: string;
};

type ConflictScenario = {
  id: string;
  label: string;
  question: string;
  impact: 'low' | 'medium' | 'high';
  consequence: string;
  recommendedPolicyId: string;
  evidence: EvidenceItem[];
};

type ResolutionPolicy = {
  id: 'confidence' | 'authority' | 'consensus';
  label: string;
  detail: string;
};

type ConflictModel = {
  title: string;
  description: string;
  policies: ResolutionPolicy[];
  scenarios: ConflictScenario[];
};

type Candidate = {
  value: string;
  evidence: EvidenceItem[];
  averageConfidence: number;
  maximumAuthority: number;
};

const BLOCK_ID = 'genai/multimodal-ai-evidence-conflict-lab';

const evidenceIcons: Record<EvidenceModality, LucideIcon> = {
  vision: Eye,
  ocr: ScanText,
  audio: AudioLines,
  transcript: ScanText,
  metadata: FileSearch,
  record: BadgeCheck,
};

export default function MultimodalAiEvidenceConflictLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ConflictModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No evidence-conflict model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<ConflictModel>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the evidence-conflict model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <EvidenceConflictLab data={data} />;
}

function EvidenceConflictLab({ data }: { data: ConflictModel }) {
  const initialScenario = data.scenarios[0];
  const [scenarioId, setScenarioId] = useState(initialScenario?.id ?? '');
  const [policyId, setPolicyId] = useState<ResolutionPolicy['id']>((initialScenario?.recommendedPolicyId as ResolutionPolicy['id']) ?? 'consensus');
  const [threshold, setThreshold] = useState(90);

  const scenario = data.scenarios.find((candidate) => candidate.id === scenarioId) ?? initialScenario;
  const policy = data.policies.find((candidate) => candidate.id === policyId) ?? data.policies[0];

  const result = useMemo(() => {
    if (!scenario || !policy) return null;
    const grouped = new Map<string, EvidenceItem[]>();
    for (const item of scenario.evidence) {
      grouped.set(item.value, [...(grouped.get(item.value) ?? []), item]);
    }

    const candidates: Candidate[] = [...grouped.entries()].map(([value, evidence]) => ({
      value,
      evidence,
      averageConfidence: Math.round(evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length),
      maximumAuthority: Math.max(...evidence.map((item) => item.authority)),
    }));

    const ranked = [...candidates].sort((left, right) => {
      if (policy.id === 'confidence') return right.averageConfidence - left.averageConfidence;
      if (policy.id === 'authority') return right.maximumAuthority - left.maximumAuthority || right.averageConfidence - left.averageConfidence;
      return right.evidence.length - left.evidence.length || right.averageConfidence - left.averageConfidence;
    });

    const winner = ranked[0];
    const runnerUp = ranked[1];
    const disagreement = candidates.length > 1;
    const margin = runnerUp ? winner.averageConfidence - runnerUp.averageConfidence : winner.averageConfidence;
    const hasConsensus = winner.evidence.length >= 2;
    const scorePasses = winner.averageConfidence >= threshold;
    const policyRecommended = policy.id === scenario.recommendedPolicyId;

    let route = 'Auto-accept';
    let rationale = 'All available evidence agrees and the selected candidate passes the gate.';
    if (scenario.impact === 'high' && disagreement) {
      route = 'Human review required';
      rationale = 'High-impact action plus cross-modal disagreement must fail closed even when one source is highly confident.';
    } else if (policy.id === 'consensus' && !hasConsensus) {
      route = 'Collect or review evidence';
      rationale = 'The consensus policy has no value supported by at least two independent sources.';
    } else if (!scorePasses) {
      route = 'Human review required';
      rationale = `The selected candidate scores ${winner.averageConfidence}%, below the ${threshold}% release threshold.`;
    } else if (disagreement && scenario.impact === 'medium') {
      route = 'Review before action';
      rationale = 'The candidate passes the numeric gate, but a medium-impact action should not hide unresolved disagreement.';
    } else if (disagreement) {
      route = 'Accept with conflict label';
      rationale = 'The low-impact output can proceed only with provenance and the unresolved conflict made visible.';
    }

    return {
      candidates,
      winner,
      disagreement,
      margin,
      hasConsensus,
      scorePasses,
      policyRecommended,
      route,
      rationale,
    };
  }, [policy, scenario, threshold]);

  if (!scenario || !policy || !result) return <LabError detail="The evidence model has no usable scenario or policy." />;

  const chooseScenario = (nextScenario: ConflictScenario) => {
    setScenarioId(nextScenario.id);
    setPolicyId(nextScenario.recommendedPolicyId as ResolutionPolicy['id']);
  };

  const reset = () => {
    if (!initialScenario) return;
    setScenarioId(initialScenario.id);
    setPolicyId(initialScenario.recommendedPolicyId as ResolutionPolicy['id']);
    setThreshold(90);
  };

  const safeToRelease = result.route === 'Auto-accept' || result.route === 'Accept with conflict label';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cross-modal conflict lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose an evidence conflict</legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === scenario.id}
                      label={candidate.label}
                      detail={`${candidate.impact.toUpperCase()} impact - ${candidate.question}`}
                      icon={GitCompareArrows}
                      accent="violet"
                      onClick={() => chooseScenario(candidate)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose a resolution policy</legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === policy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={candidate.id === 'consensus' ? UserCheck : candidate.id === 'authority' ? BadgeCheck : CheckCircle2}
                      accent="cyan"
                      onClick={() => setPolicyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Automatic release threshold"
                value={threshold}
                output={`${threshold}%`}
                min={60}
                max={99}
                step={1}
                accent="amber"
                lowLabel="More automation"
                highLabel="More review"
                onChange={setThreshold}
              />
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Candidate values" value={String(result.candidates.length)} detail={result.disagreement ? 'The modalities disagree.' : 'The modalities agree.'} icon={GitCompareArrows} tone={result.disagreement ? 'rose' : 'emerald'} />
              <LabMetric label="Selected candidate" value={result.winner.value} detail={`${result.winner.evidence.length} source${result.winner.evidence.length === 1 ? '' : 's'}; ${result.winner.averageConfidence}% mean stated confidence.`} icon={BadgeCheck} tone="blue" />
              <LabMetric label="Confidence margin" value={`${result.margin >= 0 ? '+' : ''}${result.margin} pts`} detail="Difference from the next candidate; not a calibrated correctness probability." icon={CircleAlert} tone={result.margin >= 10 ? 'amber' : 'rose'} />
              <LabMetric label="Release route" value={result.route} detail={result.policyRecommended ? 'Policy matches the scenario default.' : 'A deliberate policy override is active.'} icon={safeToRelease ? CheckCircle2 : ShieldAlert} tone={safeToRelease ? 'emerald' : 'rose'} />
            </div>

            <section className="mt-5">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evidence under comparison</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scenario.evidence.map((item) => <EvidenceCard key={item.id} item={item} selected={result.winner.evidence.some((winnerItem) => winnerItem.id === item.id)} />)}
              </div>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${safeToRelease ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                {safeToRelease ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <ShieldAlert aria-hidden="true" className="h-4 w-4" />}
                Decision consequence
              </div>
              <p className="mt-2 text-base font-semibold">{result.route}: {result.winner.value}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{result.rationale} {scenario.consequence}</p>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Confidence values in this lab are illustrative source outputs. Production thresholds require calibration by task, slice, impact, and model version.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EvidenceCard({ item, selected }: { item: EvidenceItem; selected: boolean }) {
  const Icon = evidenceIcons[item.modality];
  return (
    <article className={`min-w-0 rounded-md border p-4 ${selected ? 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-50' : 'border-neutral-200 bg-white text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          <p className="truncate text-sm font-semibold">{item.label}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums">{item.confidence}%</span>
      </div>
      <p className="mt-3 break-words text-lg font-semibold">{item.value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${item.label} confidence ${item.confidence}%`}>
        <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${item.confidence}%` }} />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase opacity-70">Source authority {Math.round(item.authority * 100)}%</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{item.provenance}</p>
    </article>
  );
}

function LabLoading() {
  return <div data-content-block={BLOCK_ID} className="min-h-[680px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading cross-modal conflict lab" />;
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <p className="font-semibold">Cross-modal conflict lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
