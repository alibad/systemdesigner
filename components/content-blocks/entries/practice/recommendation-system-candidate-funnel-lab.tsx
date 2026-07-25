'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Gauge,
  Layers3,
  Search,
  Server,
  Sparkles,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type RetrievalMode = 'ann' | 'hybrid' | 'multi-source';

const retrievalModes: Array<{
  id: RetrievalMode;
  label: string;
  detail: string;
  baseRecall: number;
  baseLatency: number;
  candidateCost: number;
  capacityFactor: number;
}> = [
  {
    id: 'ann',
    label: 'ANN only',
    detail: 'Fast semantic retrieval with weaker behavior and long-tail coverage.',
    baseRecall: 72,
    baseLatency: 10,
    candidateCost: 0.008,
    capacityFactor: 1,
  },
  {
    id: 'hybrid',
    label: 'ANN + co-occurrence',
    detail: 'Balances semantic similarity with observed shopping behavior.',
    baseRecall: 78,
    baseLatency: 17,
    candidateCost: 0.011,
    capacityFactor: 0.94,
  },
  {
    id: 'multi-source',
    label: 'Multi-source fusion',
    detail: 'Adds popular, recent, editorial, and exploration candidates.',
    baseRecall: 83,
    baseLatency: 25,
    candidateCost: 0.014,
    capacityFactor: 0.86,
  },
];

const slateSize = 20;
const catalogSize = 100_000_000;

export default function RecommendationSystemCandidateFunnelLab() {
  const [modeId, setModeId] = useState<RetrievalMode>('hybrid');
  const [peakQps, setPeakQps] = useState(15_000);
  const [retrieved, setRetrieved] = useState(1_000);
  const [ranked, setRanked] = useState(100);
  const [replicas, setReplicas] = useState(60);

  const model = useMemo(() => {
    const mode = retrievalModes.find((item) => item.id === modeId) ?? retrievalModes[1];
    const retrievalMs = mode.baseLatency + retrieved * mode.candidateCost;
    const featureMs = 8 + ranked * 0.05;
    const rankingMs = 6 + ranked * 0.15;
    const policyMs = 7;
    const networkMs = 15;
    const totalMs = retrievalMs + featureMs + rankingMs + policyMs + networkMs;

    const perReplicaQps = 420 * Math.pow(100 / ranked, 0.65) * mode.capacityFactor;
    const servingCapacity = replicas * perReplicaQps;
    const utilization = (peakQps / servingCapacity) * 100;
    const recall = Math.min(
      97,
      mode.baseRecall + Math.log2(retrieved / 250) * 4 + Math.min(4, ranked / 50),
    );
    const candidateScores = peakQps * ranked;

    const passesRecall = recall >= 86;
    const passesLatency = totalMs <= 100;
    const passesCapacity = utilization <= 75;

    let verdict = 'The funnel has measurable headroom';
    let explanation =
      'Retrieval clears the recall gate while ranking and capacity remain inside the online budget.';

    if (!passesRecall) {
      verdict = 'The candidate set is too narrow';
      explanation =
        'Widen or diversify retrieval before increasing ranker complexity. A ranker cannot recover an item that never entered the pool.';
    } else if (!passesLatency) {
      verdict = 'Per-request work breaks the deadline';
      explanation =
        'Reduce candidate or ranking depth, simplify the retrieval mix, or move optional sources off the critical path.';
    } else if (!passesCapacity) {
      verdict = 'The fleet has insufficient failure headroom';
      explanation =
        'Add measured serving capacity or shed optional work. High utilization turns one replica or zone failure into a queueing incident.';
    }

    return {
      mode,
      retrievalMs,
      featureMs,
      rankingMs,
      policyMs,
      networkMs,
      totalMs,
      utilization,
      recall,
      candidateScores,
      passesRecall,
      passesLatency,
      passesCapacity,
      verdict,
      explanation,
    };
  }, [modeId, peakQps, ranked, replicas, retrieved]);

  const healthy = model.passesRecall && model.passesLatency && model.passesCapacity;

  const reset = () => {
    setModeId('hybrid');
    setPeakQps(15_000);
    setRetrieved(1_000);
    setRanked(100);
    setReplicas(60);
  };

  const controls = (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Candidate strategy
        </legend>
        <div className="mt-3 space-y-2">
          {retrievalModes.map((mode) => (
            <LabChoice
              key={mode.id}
              selected={modeId === mode.id}
              label={mode.label}
              detail={mode.detail}
              icon={mode.id === 'ann' ? Search : mode.id === 'hybrid' ? Layers3 : Sparkles}
              accent="blue"
              onClick={() => setModeId(mode.id)}
            />
          ))}
        </div>
      </fieldset>

      <LabRange
        label="Peak traffic"
        value={peakQps}
        output={`${(peakQps / 1_000).toFixed(0)}K req/s`}
        min={5_000}
        max={30_000}
        step={2_500}
        accent="cyan"
        lowLabel="Normal"
        highLabel="Launch spike"
        onChange={setPeakQps}
      />
      <LabRange
        label="Candidates retrieved"
        value={retrieved}
        output={retrieved.toLocaleString()}
        min={250}
        max={2_000}
        step={250}
        accent="blue"
        lowLabel="Narrow"
        highLabel="Broad"
        onChange={setRetrieved}
      />
      <LabRange
        label="Candidates richly ranked"
        value={ranked}
        output={ranked.toLocaleString()}
        min={50}
        max={250}
        step={25}
        accent="violet"
        lowLabel="Cheaper"
        highLabel="More precise"
        onChange={setRanked}
      />
      <LabRange
        label="Serving replicas"
        value={replicas}
        output={replicas.toLocaleString()}
        min={30}
        max={100}
        step={5}
        accent="emerald"
        lowLabel="Lean"
        highLabel="More headroom"
        onChange={setReplicas}
      />
    </div>
  );

  const stages = [
    {
      label: 'Catalog',
      value: catalogSize.toLocaleString(),
      detail: 'Eligible search universe',
      icon: Boxes,
      tone: 'border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900',
    },
    {
      label: 'Retrieved',
      value: retrieved.toLocaleString(),
      detail: `${model.mode.label} sources`,
      icon: Search,
      tone: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40',
    },
    {
      label: 'Richly ranked',
      value: ranked.toLocaleString(),
      detail: 'Fresh cross-features',
      icon: Layers3,
      tone: 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40',
    },
    {
      label: 'Final slate',
      value: slateSize.toString(),
      detail: 'Policy-safe products',
      icon: CheckCircle2,
      tone: 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40',
    },
  ];

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Candidate funnel lab"
        title="Protect recall without scoring the whole catalog"
        description="Change retrieval breadth, ranking depth, traffic, and fleet size. Watch recall, latency, and capacity fail for different reasons."
        icon={Gauge}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody controls={controls}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Modeled recall"
            value={`${model.recall.toFixed(1)}%`}
            detail="Gate: at least 86%"
            icon={Search}
            tone={model.passesRecall ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Modeled p99"
            value={`${Math.round(model.totalMs)} ms`}
            detail="Target: at most 100 ms"
            icon={Clock3}
            tone={model.passesLatency ? 'blue' : 'rose'}
          />
          <LabMetric
            label="Fleet utilization"
            value={`${model.utilization.toFixed(0)}%`}
            detail="Gate: at most 75%"
            icon={Server}
            tone={model.passesCapacity ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Ranker work"
            value={`${(model.candidateScores / 1_000_000).toFixed(2)}M/s`}
            detail="Candidate scores at peak"
            icon={Layers3}
            tone="violet"
          />
        </div>

        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div>
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Reduction funnel</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Every stage spends more work on fewer items. The final slate is still rechecked against policy.
            </p>
          </div>
          <div className="mt-4 grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div key={stage.label} className="contents">
                  <div className={`min-w-0 rounded-md border p-3 ${stage.tone}`}>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {stage.label}
                    </div>
                    <p className="mt-3 break-words text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {stage.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{stage.detail}</p>
                  </div>
                  {index < stages.length - 1 ? (
                    <div className="flex items-center justify-center text-neutral-400" aria-hidden="true">
                      <ChevronRight className="hidden h-5 w-5 md:block" />
                      <ChevronDown className="h-5 w-5 md:hidden" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">Latency allocation</p>
            <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
              {Math.max(0, 100 - Math.round(model.totalMs))} ms headroom
            </span>
          </div>
          <div className="mt-4 flex h-4 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
            {[
              ['Retrieve', model.retrievalMs, 'bg-blue-500'],
              ['Features', model.featureMs, 'bg-cyan-500'],
              ['Rank', model.rankingMs, 'bg-violet-500'],
              ['Policy', model.policyMs, 'bg-emerald-500'],
              ['Network', model.networkMs, 'bg-amber-500'],
            ].map(([label, value, color]) => (
              <span
                key={label as string}
                title={`${label}: ${Math.round(value as number)} ms`}
                className={color as string}
                style={{ width: `${Math.max(4, ((value as number) / Math.max(100, model.totalMs)) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 sm:grid-cols-5 dark:text-neutral-300">
            {[
              ['Retrieve', model.retrievalMs, 'bg-blue-500'],
              ['Features', model.featureMs, 'bg-cyan-500'],
              ['Rank', model.rankingMs, 'bg-violet-500'],
              ['Policy', model.policyMs, 'bg-emerald-500'],
              ['Network', model.networkMs, 'bg-amber-500'],
            ].map(([label, value, color]) => (
              <span key={label as string}>
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${color}`} />
                {label} <strong>{Math.round(value as number)} ms</strong>
              </span>
            ))}
          </div>
        </div>

        <div
          className={`mt-5 rounded-lg border p-5 ${
            healthy
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
          }`}
        >
          <div className="flex items-start gap-3">
            {healthy ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Design verdict</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{model.explanation}</p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
