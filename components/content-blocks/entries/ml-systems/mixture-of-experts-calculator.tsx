'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  Cpu,
  Gauge,
  HardDrive,
  Network,
  TriangleAlert,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/mixture-of-experts-calculator';

const defaults = {
  tokens: 32_768,
  experts: 32,
  topK: 2,
  capacityFactor: 1.25,
  skew: 1.6,
  hiddenSize: 4_096,
  bandwidthGbps: 400,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

export default function MixtureOfExpertsCalculator() {
  const [tokens, setTokens] = useState(defaults.tokens);
  const [experts, setExperts] = useState(defaults.experts);
  const [topK, setTopK] = useState(defaults.topK);
  const [capacityFactor, setCapacityFactor] = useState(defaults.capacityFactor);
  const [skew, setSkew] = useState(defaults.skew);
  const [hiddenSize, setHiddenSize] = useState(defaults.hiddenSize);
  const [bandwidthGbps, setBandwidthGbps] = useState(defaults.bandwidthGbps);

  const result = useMemo(() => {
    const assignments = tokens * topK;
    const idealLoad = assignments / experts;
    const expertCapacity = Math.ceil(idealLoad * capacityFactor);
    const hottestLoad = idealLoad * skew;
    const overflowAssignments = Math.max(0, hottestLoad - expertCapacity);
    const overflowPct = hottestLoad === 0 ? 0 : (overflowAssignments / hottestLoad) * 100;
    const dispatchGiB = (assignments * hiddenSize * 2 * 2) / 1024 ** 3;
    const networkFloorMs = (dispatchGiB * 8 * 1_000) / bandwidthGbps;
    const expertWeightsGiB = (experts * 8 * hiddenSize ** 2 * 2) / 1024 ** 3;
    const activeExpertFraction = (topK / experts) * 100;
    const hottestWidth = Math.min(100, (hottestLoad / expertCapacity) * 100);
    const otherLoad = Math.max(0.28, (assignments - hottestLoad) / Math.max(1, experts - 1) / idealLoad);
    const bars = Array.from({ length: 8 }, (_, index) => {
      const multiplier = index === 0 ? skew : Math.max(0.28, otherLoad * (1 - index * 0.035));
      return {
        label: `E${index + 1}`,
        load: Math.round(idealLoad * multiplier),
        width: index === 0 ? hottestWidth : Math.min(100, (multiplier / capacityFactor) * 100),
        overloaded: multiplier > capacityFactor,
      };
    });

    const diagnosis = overflowPct > 5
      ? {
          title: 'The hottest expert drops or reroutes work',
          detail: 'Capacity is below the predicted hot-expert load. Raising capacity may contain the symptom, but the durable fix is better routing balance or replicated hot expertise.',
          tone: 'rose' as const,
        }
      : overflowPct > 0
        ? {
            title: 'The capacity margin is fragile',
            detail: 'A small traffic shift can overflow the hottest expert. Validate this envelope with token-level routing traces before deployment.',
            tone: 'amber' as const,
          }
        : {
            title: 'The modeled batch fits the expert envelope',
            detail: 'No overflow is predicted, but stored weights and all-to-all communication remain real costs even though expert compute is sparse.',
            tone: 'emerald' as const,
          };

    return {
      activeExpertFraction,
      bars,
      diagnosis,
      dispatchGiB,
      expertCapacity,
      expertWeightsGiB,
      idealLoad,
      networkFloorMs,
      overflowPct,
    };
  }, [bandwidthGbps, capacityFactor, experts, hiddenSize, skew, tokens, topK]);

  function reset() {
    setTokens(defaults.tokens);
    setExperts(defaults.experts);
    setTopK(defaults.topK);
    setCapacityFactor(defaults.capacityFactor);
    setSkew(defaults.skew);
    setHiddenSize(defaults.hiddenSize);
    setBandwidthGbps(defaults.bandwidthGbps);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Expert capacity lab"
          title="Can this batch fit without dropping routed tokens?"
          description="Size per-expert capacity and expose the memory and network costs that sparse activation does not remove."
          icon={Boxes}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <LabRange
                label="Tokens in batch"
                value={tokens}
                output={formatNumber(tokens)}
                min={4_096}
                max={131_072}
                step={4_096}
                accent="blue"
                lowLabel="4K"
                highLabel="131K"
                onChange={setTokens}
              />
              <LabRange
                label="Experts"
                value={experts}
                output={String(experts)}
                min={8}
                max={128}
                step={8}
                accent="violet"
                lowLabel="8"
                highLabel="128"
                onChange={(value) => {
                  setExperts(value);
                  setTopK((current) => Math.min(current, 4, value));
                }}
              />
              <LabRange
                label="Experts per token (top-K)"
                value={topK}
                output={String(topK)}
                min={1}
                max={4}
                accent="violet"
                lowLabel="Top-1"
                highLabel="Top-4"
                onChange={setTopK}
              />
              <LabRange
                label="Capacity factor"
                value={capacityFactor}
                output={`${capacityFactor.toFixed(2)}x`}
                min={1}
                max={2}
                step={0.05}
                accent="emerald"
                lowLabel="No reserve"
                highLabel="2x reserve"
                onChange={setCapacityFactor}
              />
              <LabRange
                label="Hot-expert skew"
                value={skew}
                output={`${skew.toFixed(1)}x average`}
                min={1}
                max={3}
                step={0.1}
                accent="rose"
                lowLabel="Balanced"
                highLabel="Collapsed"
                onChange={setSkew}
              />
              <LabRange
                label="Hidden width"
                value={hiddenSize}
                output={formatNumber(hiddenSize)}
                min={2_048}
                max={16_384}
                step={2_048}
                accent="cyan"
                lowLabel="2K"
                highLabel="16K"
                onChange={setHiddenSize}
              />
              <LabRange
                label="Interconnect"
                value={bandwidthGbps}
                output={`${bandwidthGbps} Gbit/s`}
                min={50}
                max={800}
                step={50}
                accent="amber"
                lowLabel="50G"
                highLabel="800G"
                onChange={setBandwidthGbps}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Capacity / expert"
              value={formatNumber(result.expertCapacity)}
              detail={`${formatNumber(result.idealLoad)} assignments at perfect balance`}
              icon={Gauge}
              tone="violet"
            />
            <LabMetric
              label="Hot overflow"
              value={`${result.overflowPct.toFixed(1)}%`}
              detail="Assignments that must drop, reroute, or wait"
              icon={TriangleAlert}
              tone={result.overflowPct === 0 ? 'emerald' : result.overflowPct <= 5 ? 'amber' : 'rose'}
            />
            <LabMetric
              label="Dispatch payload"
              value={`${result.dispatchGiB.toFixed(2)} GiB`}
              detail={`${result.networkFloorMs.toFixed(1)} ms serialization floor at line rate`}
              icon={Network}
              tone="blue"
            />
            <LabMetric
              label="Expert weights"
              value={`${result.expertWeightsGiB.toFixed(0)} GiB`}
              detail={`${result.activeExpertFraction.toFixed(1)}% of experts execute per token`}
              icon={HardDrive}
              tone="cyan"
            />
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Illustrative expert load
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  The marker is each expert&apos;s capacity. Red bars cross it.
                </p>
              </div>
              <Activity aria-hidden="true" className="h-5 w-5 shrink-0 text-violet-500" />
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
              {result.bars.map((bar) => (
                <div key={bar.label} className="min-w-0 text-center">
                  <div className="relative mx-auto flex h-32 w-full max-w-12 items-end overflow-hidden rounded-sm border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950">
                    <div className="absolute inset-x-0 top-0 border-t border-dashed border-neutral-500" />
                    <div
                      className={`w-full transition-[height] duration-300 ${bar.overloaded ? 'bg-rose-500' : 'bg-violet-500'}`}
                      style={{ height: `${Math.max(8, bar.width)}%` }}
                      title={`${bar.label}: ${formatNumber(bar.load)} assignments`}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{bar.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${
            result.diagnosis.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              : result.diagnosis.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
          }`}>
            <div className="flex items-start gap-3">
              <Cpu aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{result.diagnosis.title}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.diagnosis.detail}</p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
