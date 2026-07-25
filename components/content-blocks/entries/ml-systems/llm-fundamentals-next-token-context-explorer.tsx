'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  FileSearch,
  Gauge,
  GitFork,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/llm-fundamentals/data/next-token-context-explorer.json';

type EvidenceMode = {
  id: string;
  label: string;
  detail: string;
  retentionMultiplier: number;
  truthNote: string;
};
type Candidate = {
  id: string;
  token: string;
  baseLogit: number;
  evidenceLogits: Record<string, number>;
  continuation: string;
};
type LabData = {
  title: string;
  description: string;
  evidenceModes: EvidenceMode[];
  candidates: Candidate[];
  defaults: {
    evidenceMode: string;
    contextRetained: number;
    temperature: number;
    topP: number;
    decoding: 'greedy' | 'sample';
  };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.evidenceModes) &&
      data.evidenceModes.length > 0 &&
      Array.isArray(data.candidates) &&
      data.candidates.length > 1 &&
      data.defaults &&
      typeof data.defaults.temperature === 'number' &&
      typeof data.defaults.topP === 'number',
  );
}

function softmax(scores: number[]) {
  const maximum = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - maximum));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => weight / total);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

export default function LlmFundamentalsNextTokenContextExplorer({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceModeId, setEvidenceModeId] = useState('verified');
  const [contextRetained, setContextRetained] = useState(100);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [decoding, setDecoding] = useState<'greedy' | 'sample'>('greedy');

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
        setEvidenceModeId(value.defaults.evidenceMode);
        setContextRetained(value.defaults.contextRetained);
        setTemperature(value.defaults.temperature);
        setTopP(value.defaults.topP);
        setDecoding(value.defaults.decoding);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const evidence =
      data.evidenceModes.find((item) => item.id === evidenceModeId) ?? data.evidenceModes[0];
    const retention = (contextRetained / 100) * evidence.retentionMultiplier;
    const scored = data.candidates.map((candidate) => ({
      candidate,
      rawLogit: candidate.baseLogit + (candidate.evidenceLogits[evidence.id] ?? 0) * retention,
    }));
    const baseProbabilities = softmax(scored.map((item) => item.rawLogit / temperature));
    const ranked = scored
      .map((item, index) => ({ ...item, baseProbability: baseProbabilities[index] ?? 0 }))
      .sort((left, right) => right.baseProbability - left.baseProbability);

    let cumulative = 0;
    const includedIds = new Set<string>();
    for (const item of ranked) {
      includedIds.add(item.candidate.id);
      cumulative += item.baseProbability;
      if (cumulative >= topP) break;
    }
    const includedTotal = ranked
      .filter((item) => includedIds.has(item.candidate.id))
      .reduce((sum, item) => sum + item.baseProbability, 0);
    const distribution = ranked.map((item) => ({
      ...item,
      included: includedIds.has(item.candidate.id),
      probability: includedIds.has(item.candidate.id) ? item.baseProbability / includedTotal : 0,
    }));
    const entropy = -distribution.reduce(
      (sum, item) => (item.probability > 0 ? sum + item.probability * Math.log2(item.probability) : sum),
      0,
    );
    const sampleDraw = 0.68;
    let runningProbability = 0;
    const sampled = distribution.find((item) => {
      runningProbability += item.probability;
      return sampleDraw <= runningProbability;
    });
    const selected = decoding === 'greedy' ? distribution[0] : sampled ?? distribution[0];
    if (!evidence || !selected) return null;
    return {
      evidence,
      distribution,
      entropy,
      selected,
      candidateCount: includedIds.size,
      contextEvicted: contextRetained < 100 && evidence.retentionMultiplier > 0,
      sampleDraw,
    };
  }, [contextRetained, data, decoding, evidenceModeId, temperature, topP]);

  const reset = () => {
    if (!data) return;
    setEvidenceModeId(data.defaults.evidenceMode);
    setContextRetained(data.defaults.contextRetained);
    setTemperature(data.defaults.temperature);
    setTopP(data.defaults.topP);
    setDecoding(data.defaults.decoding);
  };

  if (error) return <LabError detail={error} />;
  if (!data || !result) return <LabLoading />;

  const confidenceTone = result.selected.probability >= 0.8 ? 'amber' : 'cyan';
  return (
    <div data-content-block="ml-systems/llm-fundamentals-next-token-context-explorer">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Context and decoding explorer"
          title={data.title}
          description={data.description}
          icon={Sparkles}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the evidence state
                </legend>
                <div className="mt-3 space-y-2">
                  {data.evidenceModes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={evidenceModeId === mode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={mode.id === 'verified' ? CheckCircle2 : mode.id === 'conflicting' ? AlertTriangle : CircleHelp}
                      accent={mode.id === 'verified' ? 'emerald' : mode.id === 'conflicting' ? 'rose' : 'amber'}
                      onClick={() => setEvidenceModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="space-y-6">
                <LabRange
                  label="Evidence retained in window"
                  value={contextRetained}
                  output={`${contextRetained}%`}
                  min={0}
                  max={100}
                  step={5}
                  accent="violet"
                  lowLabel="Evidence evicted"
                  highLabel="Full excerpt retained"
                  onChange={setContextRetained}
                />
                <LabRange
                  label="Temperature"
                  value={temperature}
                  output={temperature.toFixed(2)}
                  min={0.2}
                  max={1.8}
                  step={0.1}
                  accent="amber"
                  lowLabel="Concentrated"
                  highLabel="Flatter"
                  onChange={setTemperature}
                />
                <LabRange
                  label="Top-p candidate mass"
                  value={topP}
                  output={topP.toFixed(2)}
                  min={0.5}
                  max={1}
                  step={0.05}
                  accent="cyan"
                  lowLabel="Small candidate set"
                  highLabel="All candidates"
                  onChange={setTopP}
                />
              </div>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose a decoder
                </legend>
                <div className="mt-3 space-y-2">
                  <LabChoice selected={decoding === 'greedy'} label="Greedy" detail="Emit the highest-probability allowed candidate." icon={Gauge} accent="cyan" onClick={() => setDecoding('greedy')} />
                  <LabChoice selected={decoding === 'sample'} label="Seeded sample" detail="Use a fixed 0.68 draw from the allowed distribution so the changed path is reproducible." icon={GitFork} accent="violet" onClick={() => setDecoding('sample')} />
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Selected next token" value={result.selected.candidate.token} detail={decoding === 'greedy' ? 'Highest allowed probability' : `Fixed sample draw: ${result.sampleDraw.toFixed(2)}`} icon={Sparkles} tone="violet" />
              <LabMetric label="Emission probability" value={formatPercent(result.selected.probability)} detail="After temperature and top-p renormalization" icon={Gauge} tone={confidenceTone} />
              <LabMetric label="Distribution entropy" value={`${result.entropy.toFixed(2)} bits`} detail="Higher entropy means the allowed mass is less concentrated" icon={GitFork} tone="cyan" />
              <LabMetric label="Allowed candidates" value={String(result.candidateCount)} detail={`Top-p = ${topP.toFixed(2)}; excluded tokens cannot be sampled`} icon={BookOpen} tone="emerald" />
            </div>

            <section className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Candidate distribution after the controls</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">The bars show the normalized distribution after top-p filtering. Excluded candidates retain no emission probability in this decoder.</p>
              </div>
              <div className="space-y-3 p-4">
                {result.distribution.map((item) => (
                  <div key={item.candidate.id} className="min-w-0">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-neutral-900 dark:text-white">{item.candidate.token}</span>
                      <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{item.included ? formatPercent(item.probability) : 'excluded'}</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
                      <div className={`h-full transition-[width] motion-reduce:transition-none ${item.candidate.id === result.selected.candidate.id ? 'bg-violet-500' : item.included ? 'bg-cyan-500' : 'bg-neutral-300 dark:bg-neutral-700'}`} style={{ width: `${item.probability * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.35fr)] md:items-stretch">
              <PathCard label="Retained context" value={result.contextEvicted ? `${contextRetained}% of evidence` : result.evidence.label} detail={result.contextEvicted ? 'The decisive evidence signal is partially lost before scoring.' : result.evidence.detail} />
              <PathArrow />
              <PathCard label="Decoder decision" value={result.selected.candidate.token} detail={decoding === 'greedy' ? 'Greedy takes the top allowed candidate.' : 'A fixed sample draw selects from the allowed mass.'} />
              <PathArrow />
              <PathCard label="Output continuation" value="Response path" detail={result.selected.candidate.continuation} />
            </section>

            <section className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50">
              <div className="flex items-start gap-3"><FileSearch aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Confidence is not truth</p><p className="mt-1">{result.evidence.truthNote} {result.contextEvicted ? 'Truncation also weakened the source signal before decoding, so the emitted token is a property of incomplete context.' : 'The distribution describes what this toy model will continue, not whether an external fact has been checked.'}</p></div></div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p><p className="mt-2 break-words text-base font-semibold text-neutral-950 dark:text-white">{value}</p><p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p></div>;
}

function PathArrow() {
  return <div aria-hidden="true" className="hidden items-center justify-center text-neutral-400 md:flex">&rarr;</div>;
}

function LabLoading() {
  return <div data-content-block="ml-systems/llm-fundamentals-next-token-context-explorer" className="not-prose my-7 min-h-[640px] animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading next-token context explorer" />;
}

function LabError({ detail }: { detail: string }) {
  return <div data-content-block="ml-systems/llm-fundamentals-next-token-context-explorer" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{detail}</div>;
}
