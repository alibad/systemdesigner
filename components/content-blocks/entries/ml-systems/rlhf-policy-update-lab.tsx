'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BadgeCheck, Gauge, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import { LabChoice, LabMetric, LabRange, LearningLab, LearningLabBody, LearningLabHeader } from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE = '/api/content/ml-systems/rlhf/data/policy-update-lab.json';

type StrategyId = 'conservative' | 'standard' | 'aggressive';
type Strategy = { id: StrategyId; label: string; detail: string; updateFactor: number };
type LabData = { title: string; description: string; strategies: Strategy[]; defaults: { strategy: StrategyId; klTarget: number; rewardPressure: number; rolloutSize: number; rewardModelError: number } };

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' && typeof data.description === 'string' &&
      Array.isArray(data.strategies) && data.strategies.length === 3 && data.strategies.every((item) => ['conservative', 'standard', 'aggressive'].includes(item.id) && typeof item.updateFactor === 'number') &&
      data.defaults && typeof data.defaults.klTarget === 'number' && typeof data.defaults.rewardPressure === 'number' && typeof data.defaults.rolloutSize === 'number' && typeof data.defaults.rewardModelError === 'number',
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function RlhfPolicyUpdateLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategyId, setStrategyId] = useState<StrategyId>('standard');
  const [klTarget, setKlTarget] = useState(0.08);
  const [rewardPressure, setRewardPressure] = useState(6);
  const [rolloutSize, setRolloutSize] = useState(1024);
  const [rewardModelError, setRewardModelError] = useState(8);

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
        setStrategyId(value.defaults.strategy);
        setKlTarget(value.defaults.klTarget);
        setRewardPressure(value.defaults.rewardPressure);
        setRolloutSize(value.defaults.rolloutSize);
        setRewardModelError(value.defaults.rewardModelError);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const strategy =
      data.strategies.find((item) => item.id === strategyId) ??
      data.strategies[1] ??
      data.strategies[0];
    if (!strategy) return null;
    const rolloutFactor = Math.sqrt(rolloutSize / 512);
    const apparentGain = 2.5 + rewardPressure * 0.75 * strategy.updateFactor * rolloutFactor + rewardModelError * 0.1;
    const verifiedGain = Math.max(0, apparentGain - rewardModelError * 0.35);
    const divergence = 0.02 + strategy.updateFactor * (rewardPressure * 0.006 + rewardModelError * 0.001) * (klTarget / 0.08) * Math.pow(1024 / rolloutSize, 0.15);
    const risk = clamp((divergence / klTarget) * 42 + rewardModelError * 2 + rewardPressure * 1.4 - Math.log2(rolloutSize / 512) * 3, 0, 100);
    const relativeCompute = (rolloutSize / 512) * strategy.updateFactor * 1.8;
    const release = rewardModelError > 15 || risk >= 80 ? 'Hold and improve reward evidence' : divergence > klTarget * 1.1 || risk >= 60 ? 'Restricted canary only' : 'Staged canary is defensible';
    return { strategy, apparentGain, verifiedGain, divergence, risk, relativeCompute, release };
  }, [data, klTarget, rewardModelError, rewardPressure, rolloutSize, strategyId]);

  const reset = () => {
    if (!data) return;
    setStrategyId(data.defaults.strategy);
    setKlTarget(data.defaults.klTarget);
    setRewardPressure(data.defaults.rewardPressure);
    setRolloutSize(data.defaults.rolloutSize);
    setRewardModelError(data.defaults.rewardModelError);
  };

  if (error) return <LabError block="ml-systems/rlhf-policy-update-lab" detail={error} />;
  if (!data || !result) return <LabLoading block="ml-systems/rlhf-policy-update-lab" label="Loading policy update lab" />;

  const releaseTone = result.release === 'Staged canary is defensible' ? 'emerald' : result.release === 'Restricted canary only' ? 'amber' : 'rose';
  return (
    <div data-content-block="ml-systems/rlhf-policy-update-lab">
      <LearningLab>
        <LearningLabHeader eyebrow="Policy consequence model" title={data.title} description={data.description} icon={Gauge} accent="cyan" onReset={reset} />
        <LearningLabBody controls={<div className="space-y-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Set update strategy</legend>
            <div className="mt-3 space-y-2">{data.strategies.map((item) => <LabChoice key={item.id} selected={strategyId === item.id} label={item.label} detail={item.detail} icon={item.id === 'conservative' ? ShieldAlert : item.id === 'standard' ? Activity : Zap} accent={item.id === 'conservative' ? 'emerald' : item.id === 'standard' ? 'cyan' : 'rose'} onClick={() => setStrategyId(item.id)} />)}</div>
          </fieldset>
          <div className="space-y-6">
            <LabRange label="KL target" value={klTarget} output={klTarget.toFixed(2)} min={0.02} max={0.2} step={0.01} accent="cyan" lowLabel="Tight boundary" highLabel="Permissive boundary" onChange={setKlTarget} />
            <LabRange label="Reward pressure" value={rewardPressure} output={`${rewardPressure} / 10`} min={1} max={10} accent="violet" lowLabel="Cautious objective" highLabel="Strong proxy chase" onChange={setRewardPressure} />
            <LabRange label="Rollout size" value={rolloutSize} output={rolloutSize.toLocaleString()} min={256} max={4096} step={256} accent="emerald" lowLabel="Noisy evidence" highLabel="More expensive evidence" onChange={setRolloutSize} />
            <LabRange label="Reward-model error" value={rewardModelError} output={`${rewardModelError}%`} min={0} max={30} accent="rose" lowLabel="Validated proxy" highLabel="Unreliable proxy" onChange={setRewardModelError} />
          </div>
        </div>}>
          <div aria-live="polite">
            <div className={`rounded-md border p-4 ${releaseTone === 'emerald' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35' : releaseTone === 'amber' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}>
              <div className="flex items-start gap-3"><BadgeCheck aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${releaseTone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : releaseTone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} /><div><p className="text-sm font-semibold text-neutral-950 dark:text-white">Release recommendation: {result.release}</p><p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">This is a teaching model, not a production gate. Pair measured KL with external human and task evaluations; a target alone cannot certify safety.</p></div></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric label="Verified reward gain" value={`+${result.verifiedGain.toFixed(1)}`} detail={`Apparent proxy gain: +${result.apparentGain.toFixed(1)}`} icon={BadgeCheck} tone="emerald" />
              <LabMetric label="Expected KL" value={result.divergence.toFixed(3)} detail={`Target: ${klTarget.toFixed(2)}; measure actual token-level KL`} icon={Activity} tone={result.divergence <= klTarget ? 'cyan' : 'rose'} />
              <LabMetric label="Hacking or collapse risk" value={`${result.risk.toFixed(0)} / 100`} detail="Combines proxy error, divergence pressure, and rollout uncertainty" icon={ShieldAlert} tone={result.risk < 60 ? 'amber' : 'rose'} />
              <LabMetric label="Relative rollout compute" value={`${result.relativeCompute.toFixed(1)}x`} detail="Relative model-pass pressure, not a dollar estimate" icon={RefreshCw} tone="violet" />
            </div>
            <div className="mt-6 grid gap-4 text-sm leading-6 text-neutral-700 md:grid-cols-2 dark:text-neutral-300">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">Read the reward correctly</p><p className="mt-2">The apparent reward can rise because an inaccurate reward model is easier to satisfy. The verified gain discounts that error to make the distinction visible; production systems need real independent evidence rather than this estimate.</p></div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="font-semibold text-neutral-950 dark:text-white">Respond to the pressure</p><p className="mt-2">{result.release === 'Hold and improve reward evidence' ? 'Freeze optimization. Collect disagreement and adversarial comparisons, then revalidate the reward model on the failing slices.' : result.release === 'Restricted canary only' ? 'Reduce pressure or tighten the boundary, then canary with independent evaluators and a fast rollback path.' : 'A staged canary is possible, but keep KL, external quality, safety slices, and response distributions under active monitoring.'}</p></div>
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
