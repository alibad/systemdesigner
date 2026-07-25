'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  Link2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Candidate = {
  id: string;
  title: string;
  source: string;
  ageHours: number;
  lexical: number;
  authority: number;
  freshness: number;
  relevanceGrade: number;
  eligible: boolean;
  policyReason?: string;
};

type RankingScenario = {
  id: string;
  label: string;
  intent: string;
  description: string;
  candidates: Candidate[];
};

type RankingData = {
  scenarios: RankingScenario[];
};

type Weights = {
  lexical: number;
  authority: number;
  freshness: number;
};

const defaultWeights: Weights = {
  lexical: 50,
  authority: 35,
  freshness: 15,
};

function isCandidate(value: unknown): value is Candidate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Candidate>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.ageHours === 'number' &&
    typeof candidate.lexical === 'number' &&
    typeof candidate.authority === 'number' &&
    typeof candidate.freshness === 'number' &&
    typeof candidate.relevanceGrade === 'number' &&
    typeof candidate.eligible === 'boolean' &&
    (candidate.policyReason === undefined || typeof candidate.policyReason === 'string')
  );
}

function isRankingData(value: unknown): value is RankingData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RankingData>;
  return (
    Array.isArray(data.scenarios) &&
    data.scenarios.length > 0 &&
    data.scenarios.every((scenario) =>
      Boolean(
        scenario &&
          typeof scenario.id === 'string' &&
          typeof scenario.label === 'string' &&
          typeof scenario.intent === 'string' &&
          typeof scenario.description === 'string' &&
          Array.isArray(scenario.candidates) &&
          scenario.candidates.length > 0 &&
          scenario.candidates.every(isCandidate),
      ),
    )
  );
}

function discountedGain(grades: number[]) {
  return grades.reduce(
    (total, grade, index) => total + (2 ** grade - 1) / Math.log2(index + 2),
    0,
  );
}

function ageLabel(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  if (hours < 24 * 365) return `${Math.round(hours / 24)} d`;
  return `${Math.round(hours / (24 * 365))} y`;
}

export default function SearchEngineRankingPolicyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RankingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [policyEnforced, setPolicyEnforced] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!dataFile) {
        setError('Ranking scenario data is missing.');
        return;
      }

      try {
        setError(null);
        const response = await fetch(dataFile, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
        const value: unknown = await response.json();
        if (!isRankingData(value)) throw new Error('Ranking scenario data has an invalid shape.');
        setData(value);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Ranking scenario data could not be loaded.');
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [dataFile]);

  const activeScenario = data?.scenarios.find((scenario) => scenario.id === selectedScenarioId)
    ?? data?.scenarios[0]
    ?? null;

  const model = useMemo(() => {
    if (!activeScenario) {
      return {
        ranked: [],
        filteredCount: 0,
        policyViolations: 0,
        ndcg: 0,
      };
    }

    const totalWeight = weights.lexical + weights.authority + weights.freshness || 1;
    const scored = activeScenario.candidates.map((candidate) => ({
      ...candidate,
      score:
        (candidate.lexical * weights.lexical +
          candidate.authority * weights.authority +
          candidate.freshness * weights.freshness) /
        totalWeight,
    }));
    const ranked = scored
      .filter((candidate) => !policyEnforced || candidate.eligible)
      .sort((left, right) => right.score - left.score);
    const rankedGrades = ranked.map((candidate) => candidate.eligible ? candidate.relevanceGrade : 0);
    const idealGrades = activeScenario.candidates
      .map((candidate) => candidate.eligible ? candidate.relevanceGrade : 0)
      .sort((left, right) => right - left);
    const idealGain = discountedGain(idealGrades);

    return {
      ranked,
      filteredCount: scored.length - ranked.length,
      policyViolations: ranked.filter((candidate) => !candidate.eligible).length,
      ndcg: idealGain === 0 ? 0 : discountedGain(rankedGrades) / idealGain,
    };
  }, [activeScenario, policyEnforced, weights]);

  const reset = () => {
    setSelectedScenarioId(data?.scenarios[0]?.id ?? '');
    setWeights(defaultWeights);
    setPolicyEnforced(true);
  };

  if (error) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Ranking and policy lab"
          title="Ranking scenarios are unavailable"
          description="The lesson keeps ranking inputs in a co-located data file so the model is inspectable and replaceable."
          icon={SlidersHorizontal}
          accent="rose"
        />
        <LearningLabBody>
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50" role="alert">
            {error}
          </div>
        </LearningLabBody>
      </LearningLab>
    );
  }

  if (!data || !activeScenario) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Ranking and policy lab"
          title="Loading ranking scenarios"
          description="Preparing query intents, candidates, relevance judgments, and policy state."
          icon={SlidersHorizontal}
          accent="violet"
        />
        <LearningLabBody>
          <div className="h-28 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" aria-label="Loading ranking scenarios" />
        </LearningLabBody>
      </LearningLab>
    );
  }

  const releaseReady = model.policyViolations === 0;
  const topCandidate = model.ranked[0];

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Ranking and policy lab"
        title="Tune relevance without weakening eligibility"
        description="Choose a query intent and rebalance lexical match, source authority, and freshness. Policy remains a separate hard gate because a high score cannot make an unsafe document eligible."
        icon={SlidersHorizontal}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Query intent
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((scenario) => (
                  <LabChoice
                    key={scenario.id}
                    selected={activeScenario.id === scenario.id}
                    label={scenario.label}
                    detail={scenario.intent}
                    icon={FileSearch}
                    accent="violet"
                    onClick={() => setSelectedScenarioId(scenario.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Lexical match weight"
              value={weights.lexical}
              output={weights.lexical.toString()}
              min={0}
              max={100}
              step={5}
              accent="cyan"
              lowLabel="Ignore"
              highLabel="Dominant"
              onChange={(value) => setWeights((current) => ({ ...current, lexical: value }))}
            />
            <LabRange
              label="Authority weight"
              value={weights.authority}
              output={weights.authority.toString()}
              min={0}
              max={100}
              step={5}
              accent="blue"
              lowLabel="Ignore"
              highLabel="Dominant"
              onChange={(value) => setWeights((current) => ({ ...current, authority: value }))}
            />
            <LabRange
              label="Freshness weight"
              value={weights.freshness}
              output={weights.freshness.toString()}
              min={0}
              max={100}
              step={5}
              accent="emerald"
              lowLabel="Evergreen"
              highLabel="Breaking"
              onChange={(value) => setWeights((current) => ({ ...current, freshness: value }))}
            />

            <button
              type="button"
              aria-pressed={policyEnforced}
              onClick={() => setPolicyEnforced((current) => !current)}
              className={`flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                policyEnforced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">
                  Policy gate {policyEnforced ? 'enforced' : 'disabled'}
                </span>
                <span className="mt-1 block text-xs leading-5 opacity-80">
                  {policyEnforced
                    ? 'Blocked candidates leave the eligible set before ranking.'
                    : 'Unsafe candidates can now compete on soft scores.'}
                </span>
              </span>
              <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
            </button>
          </div>
        )}
      >
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            {activeScenario.intent}
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {activeScenario.description}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Offline nDCG"
            value={`${Math.round(model.ndcg * 100)}%`}
            detail="Compared with graded relevance judgments"
            icon={Activity}
            tone={model.ndcg >= 0.9 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Top result age"
            value={topCandidate ? ageLabel(topCandidate.ageHours) : 'n/a'}
            detail="Fresh is useful only when intent needs it"
            icon={Clock3}
            tone="cyan"
          />
          <LabMetric
            label="Policy removals"
            value={model.filteredCount.toString()}
            detail="Candidates excluded before release"
            icon={ShieldCheck}
            tone={policyEnforced ? 'blue' : 'neutral'}
          />
          <LabMetric
            label="Violations served"
            value={model.policyViolations.toString()}
            detail="The release target is zero"
            icon={CircleAlert}
            tone={releaseReady ? 'emerald' : 'rose'}
          />
        </div>

        <ol className="mt-5 space-y-3" aria-label="Ranked search candidates">
          {model.ranked.map((candidate, index) => (
            <li
              key={candidate.id}
              className={`flex min-w-0 items-start gap-3 rounded-md border p-3 sm:p-4 ${
                candidate.eligible
                  ? index === 0
                    ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
                    : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-950 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold text-neutral-950 dark:text-white">
                  {candidate.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                    {candidate.source}
                  </span>
                  <span>{ageLabel(candidate.ageHours)} old</span>
                  <span>grade {candidate.relevanceGrade}/3</span>
                </span>
                {!candidate.eligible ? (
                  <span className="mt-2 block text-xs font-semibold text-rose-700 dark:text-rose-300">
                    Policy violation: {candidate.policyReason}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {candidate.score.toFixed(0)}
                </span>
                <span className="block text-xs text-neutral-500">score</span>
              </span>
            </li>
          ))}
        </ol>

        <div
          className={`mt-5 rounded-md border p-4 ${
            releaseReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {releaseReady ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {releaseReady ? 'The ranked slate respects the hard gate' : 'Block this ranking configuration from release'}
              </p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                {releaseReady
                  ? 'Soft weights can change result order, while eligibility remains an independently testable invariant.'
                  : 'A candidate with strong lexical or freshness signals has crossed a policy boundary. Re-enable the gate; do not repair this with another score weight.'}
              </p>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
