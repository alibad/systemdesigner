'use client';

import { useMemo, useState } from 'react';
import {
  Bike,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  FileSearch,
  Languages,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  TextSearch,
  X,
} from 'lucide-react';

type ScenarioId = 'street' | 'chart' | 'medical';
type EvidenceKind = 'visual' | 'ocr' | 'inference' | 'sensitive';

type Fact = {
  phrase: string;
  confidence: number;
  kind: EvidenceKind;
};

type Scenario = {
  label: string;
  useCase: string;
  context: string;
  accent: string;
  preview: string;
  facts: Fact[];
};

const scenarios: Record<ScenarioId, Scenario> = {
  street: {
    label: 'Street photo',
    useCase: 'Accessibility',
    context: 'An alt-text request for a city photograph.',
    accent: 'text-cyan-600 dark:text-cyan-300',
    preview: 'Cyclist beside a city bus',
    facts: [
      { phrase: 'A cyclist in a red jacket', confidence: 96, kind: 'visual' },
      { phrase: 'rides beside a city bus', confidence: 88, kind: 'visual' },
      { phrase: 'while commuting home', confidence: 54, kind: 'inference' },
      { phrase: 'and looks anxious', confidence: 42, kind: 'sensitive' },
    ],
  },
  chart: {
    label: 'Revenue chart',
    useCase: 'Document search',
    context: 'A chart caption used for indexing and retrieval.',
    accent: 'text-violet-600 dark:text-violet-300',
    preview: 'Quarterly revenue line chart',
    facts: [
      { phrase: 'A line chart shows quarterly revenue', confidence: 97, kind: 'visual' },
      { phrase: 'rising from $4.1M to $8.2M', confidence: 84, kind: 'ocr' },
      { phrase: 'with increases in every quarter', confidence: 91, kind: 'ocr' },
      { phrase: 'proving record-breaking performance', confidence: 48, kind: 'inference' },
    ],
  },
  medical: {
    label: 'Chest X-ray',
    useCase: 'Regulated review',
    context: 'A specialist workflow where automatic diagnosis is out of scope.',
    accent: 'text-rose-600 dark:text-rose-300',
    preview: 'Frontal chest radiograph',
    facts: [
      { phrase: 'A frontal chest X-ray', confidence: 99, kind: 'visual' },
      { phrase: 'contains a possible lower-left opacity', confidence: 73, kind: 'visual' },
      { phrase: 'showing that the patient has pneumonia', confidence: 51, kind: 'inference' },
      { phrase: 'from an adult male patient', confidence: 62, kind: 'sensitive' },
    ],
  },
};

const scenarioIds = Object.keys(scenarios) as ScenarioId[];

const evidenceLabels: Record<EvidenceKind, string> = {
  visual: 'Visual region',
  ocr: 'Verified OCR',
  inference: 'Inferred intent',
  sensitive: 'Sensitive attribute',
};

function PreviewIcon({ id }: { id: ScenarioId }) {
  if (id === 'street') return <Bike aria-hidden="true" className="h-10 w-10" />;
  if (id === 'chart') return <TextSearch aria-hidden="true" className="h-10 w-10" />;
  return <Stethoscope aria-hidden="true" className="h-10 w-10" />;
}

export default function ImageCaptioningGroundingGate() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('street');
  const [threshold, setThreshold] = useState(75);
  const [ocrVerified, setOcrVerified] = useState(true);
  const [blockInference, setBlockInference] = useState(true);

  const model = useMemo(() => {
    const scenario = scenarios[scenarioId];
    const assessed = scenario.facts.map((fact) => {
      const confidencePass = fact.confidence >= threshold;
      const sourcePass = fact.kind !== 'ocr' || ocrVerified;
      const policyPass = fact.kind !== 'sensitive' && (fact.kind !== 'inference' || !blockInference);
      const accepted = confidencePass && sourcePass && policyPass;
      const reason = !confidencePass
        ? 'Below evidence threshold'
        : !sourcePass
          ? 'OCR is not verified'
          : fact.kind === 'sensitive'
            ? 'Sensitive inference blocked'
            : fact.kind === 'inference' && blockInference
              ? 'Intent is not visible evidence'
              : 'Claim supported';
      return { ...fact, accepted, reason };
    });
    const accepted = assessed.filter((fact) => fact.accepted);
    const unsafeAccepted = accepted.some((fact) => fact.kind === 'inference' || fact.kind === 'sensitive');
    const caption = accepted.length > 0
      ? `${accepted.map((fact) => fact.phrase).join(' ')}.`
      : 'No caption released.';
    const decision = scenarioId === 'medical'
      ? 'Human review required'
      : unsafeAccepted
        ? 'Hold unsupported claim'
        : accepted.length === 0
          ? 'Return no caption'
          : 'Release filtered caption';
    const safe = decision === 'Release filtered caption';
    return { scenario, assessed, accepted, unsafeAccepted, caption, decision, safe };
  }, [blockInference, ocrVerified, scenarioId, threshold]);

  return (
    <section className="not-prose my-7 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-neutral-950 px-5 py-5 text-white dark:border-neutral-800 md:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-violet-300">
          <FileSearch aria-hidden="true" className="h-4 w-4" />
          Claim grounding lab
        </div>
        <h3 className="mt-2 text-xl font-semibold md:text-2xl">Decide which details may become facts</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Select an image type, change the evidence threshold, and test policy controls. A polished sentence is not releasable until each claim has an acceptable source.
        </p>
      </header>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-5 lg:border-b-0 lg:border-r md:p-6 dark:border-neutral-800 dark:bg-neutral-900/55">
          <fieldset>
            <legend className="text-sm font-semibold text-neutral-950 dark:text-white">Image scenario</legend>
            <div className="mt-3 space-y-2">
              {scenarioIds.map((id) => {
                const scenario = scenarios[id];
                const selected = scenarioId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setScenarioId(id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${selected
                      ? 'border-violet-500 bg-violet-50 text-violet-950 ring-1 ring-violet-500 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-50'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{scenario.label}</span>
                      <span className="text-xs opacity-70">{scenario.useCase}</span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 opacity-75">{scenario.context}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-7 block">
            <span className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-950 dark:text-white">
              <span>Minimum evidence</span>
              <output className="tabular-nums text-violet-700 dark:text-violet-300">{threshold}%</output>
            </span>
            <input
              aria-label="Minimum claim evidence threshold"
              type="range"
              min="40"
              max="95"
              step="1"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="mt-3 h-2 w-full cursor-pointer accent-violet-500"
            />
            <span className="mt-2 flex justify-between text-xs text-neutral-500"><span>Permissive</span><span>Strict</span></span>
          </label>

          <div className="mt-7 space-y-2">
            <button
              type="button"
              aria-pressed={ocrVerified}
              onClick={() => setOcrVerified((value) => !value)}
              className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left ${ocrVerified
                ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100'
                : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'}`}
            >
              <span>
                <span className="block text-sm font-semibold">OCR independently verified</span>
                <span className="mt-1 block text-xs opacity-75">Permit claims derived from extracted text.</span>
              </span>
              <ScanLine aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>

            <button
              type="button"
              aria-pressed={blockInference}
              onClick={() => setBlockInference((value) => !value)}
              className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left ${blockInference
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'}`}
            >
              <span>
                <span className="block text-sm font-semibold">Block inferred intent</span>
                <span className="mt-1 block text-xs opacity-75">Keep plausible stories out of factual captions.</span>
              </span>
              <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex min-h-48 flex-col justify-between rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white dark:border-neutral-800">
              <div className={model.scenario.accent}>
                <PreviewIcon id={scenarioId} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Observed input</p>
                <p className="mt-2 text-lg font-semibold">{model.scenario.preview}</p>
                <p className="mt-2 text-xs leading-5 text-neutral-400">{model.scenario.useCase} policy</p>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/45">
              <div className="flex items-center gap-2">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Claim evidence</p>
              </div>
              <div className="mt-4 space-y-3">
                {model.assessed.map((fact) => (
                  <div key={fact.phrase} className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5 text-neutral-950 dark:text-white">{fact.phrase}</p>
                        <p className="mt-1 text-xs text-neutral-500">{evidenceLabels[fact.kind]}: {fact.reason}</p>
                      </div>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${fact.accepted
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}
                      >
                        {fact.accepted ? <Check aria-hidden="true" className="h-4 w-4" /> : <X aria-hidden="true" className="h-4 w-4" />}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                        <div className={`h-full rounded ${fact.accepted ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${fact.confidence}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">{fact.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <Languages aria-hidden="true" className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Released wording
              </div>
              <output className="mt-3 block text-base leading-7 text-neutral-700 dark:text-neutral-200">
                {model.caption}
              </output>
              <p className="mt-3 text-xs text-neutral-500">
                {model.accepted.length} of {model.assessed.length} proposed claims retained.
              </p>
            </div>

            <div className={`rounded-lg border p-4 ${model.safe
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : model.decision === 'Human review required'
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'}`}
            >
              {model.safe
                ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="h-5 w-5 text-rose-700 dark:text-rose-300" />}
              <p className="mt-3 text-xs font-semibold uppercase text-neutral-500">Release decision</p>
              <p className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">{model.decision}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                {model.decision === 'Human review required'
                  ? 'The route is regulated. Evidence assists a specialist but cannot authorize an automatic diagnosis.'
                  : model.safe
                    ? 'Every retained phrase passes source, confidence, and policy checks.'
                    : model.unsafeAccepted
                      ? 'A plausible inference crossed the threshold but still lacks visible evidence.'
                      : 'No proposed claim has enough releasable evidence.'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Eye aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6"><strong>Grounding rule:</strong> a confidence score estimates model belief; source and policy determine whether that belief may be stated as a fact.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
