'use client';

import { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CheckCircle2,
  CircleAlert,
  Compass,
  Layers3,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ObjectiveId = 'conversion' | 'revenue' | 'discovery';

type Candidate = {
  id: string;
  name: string;
  category: string;
  relevance: number;
  purchaseProbability: number;
  margin: number;
  isNew: boolean;
  eligible: boolean;
  note: string;
};

const objectives: Array<{
  id: ObjectiveId;
  label: string;
  detail: string;
  relevanceWeight: number;
  purchaseWeight: number;
  marginWeight: number;
  noveltyWeight: number;
}> = [
  {
    id: 'conversion',
    label: 'Conversion first',
    detail: 'Favor products with high relevance and purchase probability.',
    relevanceWeight: 0.45,
    purchaseWeight: 0.45,
    marginWeight: 0.1,
    noveltyWeight: 0,
  },
  {
    id: 'revenue',
    label: 'Contribution margin',
    detail: 'Balance purchase probability with expected economic value.',
    relevanceWeight: 0.3,
    purchaseWeight: 0.35,
    marginWeight: 0.35,
    noveltyWeight: 0,
  },
  {
    id: 'discovery',
    label: 'Long-term discovery',
    detail: 'Keep relevance while creating measured exposure for new items.',
    relevanceWeight: 0.35,
    purchaseWeight: 0.2,
    marginWeight: 0.1,
    noveltyWeight: 0.35,
  },
];

const candidates: Candidate[] = [
  {
    id: 'trail-shoe', name: 'Trail running shoe', category: 'Footwear',
    relevance: 0.96, purchaseProbability: 0.15, margin: 34,
    isNew: false, eligible: true,
    note: 'Strong fit for the current running session.',
  },
  {
    id: 'clearance-boot', name: 'Clearance hiking boot', category: 'Footwear',
    relevance: 0.93, purchaseProbability: 0.19, margin: 60,
    isNew: false, eligible: false,
    note: 'High model score, but the last available size is out of stock.',
  },
  {
    id: 'performance-sock', name: 'Performance sock', category: 'Footwear',
    relevance: 0.88, purchaseProbability: 0.12, margin: 12,
    isNew: false, eligible: true,
    note: 'Frequent co-purchase with trail shoes.',
  },
  {
    id: 'rain-shell', name: 'Packable rain shell', category: 'Outerwear',
    relevance: 0.84, purchaseProbability: 0.09, margin: 49,
    isNew: false, eligible: true,
    note: 'Relevant to the season and recent searches.',
  },
  {
    id: 'running-vest', name: 'New running vest', category: 'Apparel',
    relevance: 0.77, purchaseProbability: 0.07, margin: 42,
    isNew: true, eligible: true,
    note: 'A new item with sparse interaction history.',
  },
  {
    id: 'bottle', name: 'Insulated bottle', category: 'Accessories',
    relevance: 0.78, purchaseProbability: 0.1, margin: 19,
    isNew: false, eligible: true,
    note: 'Broadly popular but less specific to the session.',
  },
  {
    id: 'repair-kit', name: 'Compact repair kit', category: 'Accessories',
    relevance: 0.7, purchaseProbability: 0.06, margin: 24,
    isNew: true, eligible: true,
    note: 'New long-tail inventory that needs controlled exposure.',
  },
  {
    id: 'energy-gel', name: 'Plant-based energy gel', category: 'Nutrition',
    relevance: 0.73, purchaseProbability: 0.13, margin: 8,
    isNew: true, eligible: true,
    note: 'Lower margin, but useful category variety.',
  },
];

const maxMargin = Math.max(...candidates.map((candidate) => candidate.margin));
const maxPurchaseProbability = Math.max(
  ...candidates.map((candidate) => candidate.purchaseProbability),
);

export default function RecommendationSystemSlatePolicyLab() {
  const [objectiveId, setObjectiveId] = useState<ObjectiveId>('conversion');
  const [explorationShare, setExplorationShare] = useState(10);
  const [categoryCap, setCategoryCap] = useState(2);
  const [eligibilityGate, setEligibilityGate] = useState(true);

  const model = useMemo(() => {
    const objective = objectives.find((item) => item.id === objectiveId) ?? objectives[0];
    const scored = candidates
      .map((candidate) => {
        const novelty = candidate.isNew ? 1 : 0;
        const normalizedPurchase = candidate.purchaseProbability / maxPurchaseProbability;
        const normalizedMargin = candidate.margin / maxMargin;
        const explorationBoost = novelty * (explorationShare / 100) * 0.8;
        const score =
          candidate.relevance * objective.relevanceWeight +
          normalizedPurchase * objective.purchaseWeight +
          normalizedMargin * objective.marginWeight +
          novelty * objective.noveltyWeight +
          explorationBoost;
        return { ...candidate, score };
      })
      .sort((a, b) => b.score - a.score);

    const categoryCounts = new Map<string, number>();
    const slate: typeof scored = [];

    for (const candidate of scored) {
      if (eligibilityGate && !candidate.eligible) continue;
      const currentCount = categoryCounts.get(candidate.category) ?? 0;
      if (currentCount >= categoryCap) continue;
      slate.push(candidate);
      categoryCounts.set(candidate.category, currentCount + 1);
      if (slate.length === 5) break;
    }

    const expectedPurchases = slate.reduce(
      (sum, candidate) => sum + candidate.purchaseProbability,
      0,
    );
    const expectedMargin = slate.reduce(
      (sum, candidate) => sum + candidate.purchaseProbability * candidate.margin,
      0,
    );
    const categoryCount = new Set(slate.map((candidate) => candidate.category)).size;
    const newItemCount = slate.filter((candidate) => candidate.isNew).length;
    const hasIneligible = slate.some((candidate) => !candidate.eligible);

    let verdict = 'The slate balances value and discovery';
    let explanation =
      'Hard eligibility is preserved, category concentration is bounded, and the chosen objective remains visible in the result.';
    let tone: 'healthy' | 'warning' | 'danger' = 'healthy';

    if (hasIneligible) {
      verdict = 'The release invariant is broken';
      explanation =
        'A high-scoring out-of-stock item reached the slate. Hard eligibility must run independently of model score and fallback behavior.';
      tone = 'danger';
    } else if (categoryCount < 3) {
      verdict = 'The slate is too concentrated';
      explanation =
        'One category occupies too much attention. Tighten the category cap or add stronger candidate sources before changing ranker weights.';
      tone = 'warning';
    } else if (explorationShare >= 15 && newItemCount === 0) {
      verdict = 'The exploration budget has no effect';
      explanation =
        'The policy promises discovery but the slate exposes no new inventory. Check source coverage, score calibration, and policy ordering.';
      tone = 'warning';
    }

    return {
      objective,
      slate,
      expectedPurchases,
      expectedMargin,
      categoryCount,
      newItemCount,
      verdict,
      explanation,
      tone,
    };
  }, [categoryCap, eligibilityGate, explorationShare, objectiveId]);

  const reset = () => {
    setObjectiveId('conversion');
    setExplorationShare(10);
    setCategoryCap(2);
    setEligibilityGate(true);
  };

  const controls = (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Ranking objective
        </legend>
        <div className="mt-3 space-y-2">
          {objectives.map((objective) => (
            <LabChoice
              key={objective.id}
              selected={objectiveId === objective.id}
              label={objective.label}
              detail={objective.detail}
              icon={
                objective.id === 'conversion'
                  ? Target
                  : objective.id === 'revenue'
                    ? BadgeDollarSign
                    : Compass
              }
              accent="violet"
              onClick={() => setObjectiveId(objective.id)}
            />
          ))}
        </div>
      </fieldset>

      <LabRange
        label="Exploration allocation"
        value={explorationShare}
        output={`${explorationShare}%`}
        min={0}
        max={30}
        step={5}
        accent="amber"
        lowLabel="Exploit"
        highLabel="Discover"
        onChange={setExplorationShare}
      />
      <LabRange
        label="Maximum per category"
        value={categoryCap}
        output={categoryCap.toString()}
        min={1}
        max={4}
        step={1}
        accent="emerald"
        lowLabel="Diverse"
        highLabel="Concentrated"
        onChange={setCategoryCap}
      />

      <button
        type="button"
        role="switch"
        aria-checked={eligibilityGate}
        onClick={() => setEligibilityGate((current) => !current)}
        className={`w-full rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          eligibilityGate
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
            : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
        }`}
      >
        <span className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">
              Eligibility gate {eligibilityGate ? 'enforced' : 'bypassed'}
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-80">
              Challenge the design by allowing model score to outrank inventory policy.
            </span>
          </span>
        </span>
      </button>
    </div>
  );

  const verdictTone =
    model.tone === 'healthy'
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
      : model.tone === 'warning'
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Slate policy lab"
        title="Turn model scores into a defensible product slate"
        description="Change the objective, exploration allocation, and category cap. Then bypass eligibility to see why hard policy cannot be another score weight."
        icon={ShoppingBag}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody controls={controls}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Expected purchases"
            value={model.expectedPurchases.toFixed(2)}
            detail="Sum of calibrated probabilities"
            icon={Target}
            tone="blue"
          />
          <LabMetric
            label="Expected margin"
            value={`$${model.expectedMargin.toFixed(2)}`}
            detail="Probability-weighted slate value"
            icon={BadgeDollarSign}
            tone="violet"
          />
          <LabMetric
            label="Category coverage"
            value={`${model.categoryCount}/5`}
            detail="Unique categories in five slots"
            icon={Layers3}
            tone={model.categoryCount >= 3 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="New items exposed"
            value={model.newItemCount.toString()}
            detail={`${explorationShare}% exploration allocation`}
            icon={Sparkles}
            tone="amber"
          />
        </div>

        <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Homepage slate</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Outdoor runner session · {model.objective.label} · highest eligible score first
              </p>
            </div>
            <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Five release slots
            </span>
          </div>

          <ol className="mt-4 grid gap-3 xl:grid-cols-5">
            {model.slate.map((candidate, index) => (
              <li
                key={candidate.id}
                className={`min-w-0 rounded-md border bg-white p-3 dark:bg-neutral-950 ${
                  candidate.eligible
                    ? 'border-neutral-200 dark:border-neutral-800'
                    : 'border-rose-400 ring-1 ring-rose-400 dark:border-rose-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                    {(candidate.score * 100).toFixed(0)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-neutral-950 dark:text-white">
                  {candidate.name}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{candidate.category}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className={candidate.eligible ? 'h-full bg-violet-500' : 'h-full bg-rose-500'}
                    style={{ width: `${Math.min(100, candidate.score * 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {candidate.isNew ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      New
                    </span>
                  ) : null}
                  {!candidate.eligible ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-200">
                      Out of stock
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                      Eligible
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{candidate.note}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
            <Target aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            <p className="mt-3 text-xs font-semibold uppercase text-blue-950 dark:text-blue-100">Objective</p>
            <p className="mt-1 text-sm leading-6 text-blue-900 dark:text-blue-200">{model.objective.label}</p>
          </div>
          <div className="rounded-md border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
            <Sparkles aria-hidden="true" className="h-5 w-5 text-violet-600 dark:text-violet-300" />
            <p className="mt-3 text-xs font-semibold uppercase text-violet-950 dark:text-violet-100">Soft policy</p>
            <p className="mt-1 text-sm leading-6 text-violet-900 dark:text-violet-200">
              {categoryCap} per category · {explorationShare}% exploration
            </p>
          </div>
          <div
            className={`rounded-md border p-4 ${
              eligibilityGate
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
            }`}
          >
            <PackageCheck
              aria-hidden="true"
              className={`h-5 w-5 ${
                eligibilityGate
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-300'
              }`}
            />
            <p className="mt-3 text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-200">Hard policy</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {eligibilityGate ? 'Inventory enforced after scoring' : 'Inventory bypassed'}
            </p>
          </div>
        </div>

        <div className={`mt-5 rounded-lg border p-5 ${verdictTone}`}>
          <div className="flex items-start gap-3">
            {model.tone === 'healthy' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  model.tone === 'warning'
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-rose-600 dark:text-rose-300'
                }`}
              />
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Slate verdict</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{model.explanation}</p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
