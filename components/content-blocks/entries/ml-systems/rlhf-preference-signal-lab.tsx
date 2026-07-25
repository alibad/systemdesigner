'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BrainCircuit, ShieldAlert, UsersRound } from 'lucide-react';
import { LabChoice, LabMetric, LabRange, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE = '/api/content/ml-systems/rlhf/data/preference-signal-lab.json';

type CapacityId = 'small' | 'balanced' | 'large';
type Capacity = { id: CapacityId; label: string; detail: string; confidenceOffset: number; gapOffset: number; riskOffset: number };
type LabData = {
  title: string;
  description: string;
  capacityOptions: Capacity[];
  defaults: { agreement: number; pairCount: number; noise: number; sliceCoverage: number; capacity: CapacityId };
  readiness: { minimumConfidence: number; maximumGap: number; maximumSliceRisk: number };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' && typeof data.description === 'string' &&
      Array.isArray(data.capacityOptions) && data.capacityOptions.length === 3 &&
      data.capacityOptions.every((item) => ['small', 'balanced', 'large'].includes(item.id) && typeof item.confidenceOffset === 'number' && typeof item.gapOffset === 'number' && typeof item.riskOffset === 'number') &&
      data.defaults && typeof data.defaults.agreement === 'number' && typeof data.defaults.pairCount === 'number' && typeof data.defaults.noise === 'number' && typeof data.defaults.sliceCoverage === 'number' &&
      data.readiness && typeof data.readiness.minimumConfidence === 'number' && typeof data.readiness.maximumGap === 'number' && typeof data.readiness.maximumSliceRisk === 'number',
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function RlhfPreferenceSignalLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState(84);
  const [pairCount, setPairCount] = useState(8000);
  const [noise, setNoise] = useState(8);
  const [sliceCoverage, setSliceCoverage] = useState(82);
  const [capacityId, setCapacityId] = useState<CapacityId>('balanced');

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
        setAgreement(value.defaults.agreement);
        setPairCount(value.defaults.pairCount);
        setNoise(value.defaults.noise);
        setSliceCoverage(value.defaults.sliceCoverage);
        setCapacityId(value.defaults.capacity);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const capacity =
      data.capacityOptions.find((item) => item.id === capacityId) ??
      data.capacityOptions[1] ??
      data.capacityOptions[0];
    if (!capacity) return null;
    const largeModelDataPenalty = capacity.id === 'large' && pairCount < 6000 ? 6 : 0;
    const confidence = clamp(agreement * 0.43 + Math.log10(pairCount) * 10 + sliceCoverage * 0.18 - noise * 0.7 + capacity.confidenceOffset, 0, 100);
    const generalizationGap = clamp(45 - agreement * 0.28 - sliceCoverage * 0.15 + noise * 0.55 + capacity.gapOffset + largeModelDataPenalty, 2, 45);
    const sliceRisk = clamp(100 - sliceCoverage * 0.65 - agreement * 0.25 + noise * 0.8 + capacity.riskOffset, 2, 98);
    const ready = confidence >= data.readiness.minimumConfidence && generalizationGap <= data.readiness.maximumGap && sliceRisk <= data.readiness.maximumSliceRisk;
    const blockers = [
      confidence < data.readiness.minimumConfidence ? 'confidence' : null,
      generalizationGap > data.readiness.maximumGap ? 'generalization gap' : null,
      sliceRisk > data.readiness.maximumSliceRisk ? 'slice risk' : null,
    ].filter(Boolean);
    return { capacity, confidence, generalizationGap, sliceRisk, ready, blockers };
  }, [agreement, capacityId, data, noise, pairCount, sliceCoverage]);

  const reset = () => {
    if (!data) return;
    setAgreement(data.defaults.agreement);
    setPairCount(data.defaults.pairCount);
    setNoise(data.defaults.noise);
    setSliceCoverage(data.defaults.sliceCoverage);
    setCapacityId(data.defaults.capacity);
  };

  if (error) return <LabError block="ml-systems/rlhf-preference-signal-lab" detail={error} />;
  if (!data || !result) return <LabLoading block="ml-systems/rlhf-preference-signal-lab" label="Loading preference signal lab" />;

  return (
    <div data-content-block="ml-systems/rlhf-preference-signal-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Reward-model evidence" title={data.title} description={data.description} icon={UsersRound} accent="violet" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose reward-model capacity</legend>
            <div className="mt-3 space-y-2">
              {data.capacityOptions.map((item) => <LabChoice key={item.id} selected={capacityId === item.id} label={item.label} detail={item.detail} icon={BrainCircuit} accent={item.id === 'small' ? 'cyan' : item.id === 'balanced' ? 'violet' : 'amber'} onClick={() => setCapacityId(item.id)} />)}
            </div>
          </fieldset>
          <div className="space-y-6">
            <LabRange label="Annotator agreement" value={agreement} output={`${agreement}%`} min={50} max={98} accent="violet" lowLabel="Ambiguous rubric" highLabel="Consistent rubric" onChange={setAgreement} />
            <LabRange label="Preference pairs" value={pairCount} output={pairCount.toLocaleString()} min={500} max={20000} step={500} accent="cyan" lowLabel="Sparse evidence" highLabel="More comparisons" onChange={setPairCount} />
            <LabRange label="Noise or bias" value={noise} output={`${noise}%`} min={0} max={35} accent="rose" lowLabel="Clean signal" highLabel="Systematic artifact" onChange={setNoise} />
            <LabRange label="Important-slice coverage" value={sliceCoverage} output={`${sliceCoverage}%`} min={20} max={100} accent="emerald" lowLabel="Blind spots" highLabel="Representative slices" onChange={setSliceCoverage} />
          </div>
        </div>}>
          <div aria-live="polite">
            <div className={`rounded-md border p-4 ${result.ready ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35'}`}>
              <div className="flex items-start gap-3">
                {result.ready ? <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
                <div>
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">{result.ready ? 'Ready for a bounded policy experiment' : 'Do not use this reward model as the policy objective yet'}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.ready ? 'The lab thresholds are met. Start with constrained updates and keep independent evaluation active.' : `Improve ${result.blockers.join(', ')} before optimization. More PPO pressure would amplify this evidence gap.`}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <LabMetric label="Confidence" value={`${result.confidence.toFixed(0)} / 100`} detail={`Need at least ${data.readiness.minimumConfidence}; evidence strength, not a probability`} icon={BadgeCheck} tone={result.confidence >= data.readiness.minimumConfidence ? 'emerald' : 'amber'} />
              <LabMetric label="Generalization gap" value={`${result.generalizationGap.toFixed(1)} pts`} detail={`Need at most ${data.readiness.maximumGap}; expected held-out and slice gap`} icon={BrainCircuit} tone={result.generalizationGap <= data.readiness.maximumGap ? 'emerald' : 'rose'} />
              <LabMetric label="Slice risk" value={`${result.sliceRisk.toFixed(0)} / 100`} detail={`Need at most ${data.readiness.maximumSliceRisk}; uncovered or inconsistent groups`} icon={ShieldAlert} tone={result.sliceRisk <= data.readiness.maximumSliceRisk ? 'emerald' : 'rose'} />
            </div>
            <div className="mt-6 grid gap-4 text-sm leading-6 text-neutral-700 md:grid-cols-2 dark:text-neutral-300">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">What the capacity choice changes</p><p className="mt-2">{result.capacity.id === 'small' ? 'A smaller model may miss rubric nuance even with clean labels. Improve modeling only after checking that the labels are meaningful.' : result.capacity.id === 'large' ? 'A larger model can learn subtleties, but sparse pairs make shortcut memorization more likely. Add diverse comparisons before increasing update pressure.' : 'Balanced capacity is not automatically safe. The held-out and slice evidence still decides whether its scores are fit for optimization.'}</p></div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">What to change next</p><p className="mt-2">{result.sliceRisk > data.readiness.maximumSliceRisk ? 'Target prompt and user slices that are absent, disputed, or high impact. Do not hide them in an overall average.' : result.generalizationGap > data.readiness.maximumGap ? 'Hold out complete prompts and search for style shortcuts or response distributions the reward model ranks incorrectly.' : result.confidence < data.readiness.minimumConfidence ? 'Clarify the rubric, calibrate annotators, and collect more independently reviewed comparisons.' : 'Proceed only to a small, reversible policy experiment with fresh evaluation prompts.'}</p></div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading({ block, label }: { block: string; label: string }) {
  return <div data-content-block={block} className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label={label} />;
}

function LabError({ block, detail }: { block: string; detail: string }) {
  return <div data-content-block={block} className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">{detail}</div>;
}
