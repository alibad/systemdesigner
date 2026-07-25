'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CircleAlert,
  Compass,
  Gauge,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

interface Objective {
  id: string;
  label: string;
  detail: string;
  relevance: number;
  diversity: number;
  concentration: number;
  longTermValue: number;
  violationRate: number;
}

interface SlatePolicyData {
  title: string;
  description: string;
  defaults: {
    objectiveId: string;
    explorationPct: number;
    diversityFloor: number;
  };
  objectives: Objective[];
}

const BLOCK_ID = 'ml-systems/recommender-systems-advanced-slate-policy-lab';

function isSlatePolicyData(value: unknown): value is SlatePolicyData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SlatePolicyData>;
  return Boolean(candidate.title && candidate.description && candidate.defaults
    && Array.isArray(candidate.objectives) && candidate.objectives.length > 0);
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function RecommenderSystemsAdvancedSlatePolicyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<SlatePolicyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No slate-policy scenarios were supplied.');
      return;
    }
    const controller = new AbortController();
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSlatePolicyData(payload)) throw new Error('Slate-policy data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load slate-policy scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState title="Slate lab unavailable" detail={loadError} />;
  if (!data) return <LabState title="Loading slate lab" detail="Preparing ranking trade-offs..." />;
  return <SlatePolicyLab data={data} />;
}

function SlatePolicyLab({ data }: { data: SlatePolicyData }) {
  const [objectiveId, setObjectiveId] = useState(data.defaults.objectiveId);
  const [explorationPct, setExplorationPct] = useState(data.defaults.explorationPct);
  const [diversityFloor, setDiversityFloor] = useState(data.defaults.diversityFloor);
  const objective = data.objectives.find((item) => item.id === objectiveId) ?? data.objectives[0];

  const result = useMemo(() => {
    const exploration = explorationPct / 100;
    const diversityTarget = diversityFloor / 100;
    const relevance = Math.max(0, objective.relevance - exploration * 0.12 - Math.max(0, diversityTarget - objective.diversity) * 0.08);
    const diversity = Math.min(0.98, Math.max(objective.diversity, diversityTarget) + exploration * 0.16);
    const concentration = Math.max(0.12, objective.concentration - exploration * 0.35 - diversityTarget * 0.18);
    const longTermValue = Math.min(0.98, objective.longTermValue + exploration * 0.18 + diversityTarget * 0.08);
    const violationRate = Math.max(0, objective.violationRate - diversityTarget * 0.004);
    const healthy = diversity >= 0.55 && concentration <= 0.55 && violationRate <= 0.005;
    const verdict = healthy
      ? 'The slate preserves bounded relevance while broadening evidence'
      : violationRate > 0.005
        ? 'Policy violations block this slate'
        : 'The ranking policy concentrates exposure too aggressively';
    return { concentration, diversity, healthy, longTermValue, relevance, violationRate, verdict };
  }, [diversityFloor, explorationPct, objective]);

  const reset = () => {
    setObjectiveId(data.defaults.objectiveId);
    setExplorationPct(data.defaults.explorationPct);
    setDiversityFloor(data.defaults.diversityFloor);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Slate policy lab"
          title={data.title}
          description={data.description}
          icon={Compass}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Ranking objective
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.objectives.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={objective.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'balanced-value' ? Target : BarChart3}
                      accent={item.id === 'balanced-value' ? 'emerald' : 'violet'}
                      onClick={() => setObjectiveId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Exploration slots"
                value={explorationPct}
                output={`${explorationPct}%`}
                min={0}
                max={30}
                step={2}
                accent="cyan"
                lowLabel="Pure exploitation"
                highLabel="More uncertain items"
                onChange={setExplorationPct}
              />
              <LabRange
                label="Diversity floor"
                value={diversityFloor}
                output={`${diversityFloor}%`}
                min={20}
                max={80}
                step={5}
                accent="emerald"
                lowLabel="Similar items allowed"
                highLabel="Broader slate"
                onChange={setDiversityFloor}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.healthy ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Slate verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">{result.verdict}</h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    Exploration changes what can be learned later. Diversity and safety constraints must be logged as policy decisions so offline evaluation can reconstruct what the ranker actually proposed.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <LabMetric label="Relevance" value={percent(result.relevance)} detail="Immediate predicted utility" icon={Target} tone="blue" />
              <LabMetric label="Diversity" value={percent(result.diversity)} detail="Category and source breadth" icon={Layers3} tone={result.diversity >= 0.55 ? 'emerald' : 'amber'} />
              <LabMetric label="Top-source share" value={percent(result.concentration)} detail="Exposure concentration" icon={Users} tone={result.concentration <= 0.55 ? 'cyan' : 'rose'} />
              <LabMetric label="Long-term value" value={percent(result.longTermValue)} detail="Modeled return and satisfaction" icon={Sparkles} tone="violet" />
              <LabMetric label="Policy violations" value={percent(result.violationRate)} detail="Independent hard gate" icon={ShieldCheck} tone={result.violationRate <= 0.005 ? 'emerald' : 'rose'} />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                What must be logged
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <EvidenceCard title="Candidate evidence" detail="Source, retrieval score, eligibility, and selection probability before ranking." />
                <EvidenceCard title="Slate decisions" detail="Model score, original position, policy changes, final position, and exploration identity." />
                <EvidenceCard title="Delayed outcomes" detail="Impressions, skips, hides, completion, return behavior, and negative feedback by cohort." />
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              These scores illustrate directional trade-offs, not universal product weights. Estimate causal impact with controlled experiments and guardrail metrics rather than treating this model as an optimizer.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function EvidenceCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

function LabState({ title, detail }: { title: string; detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab><LearningLabBody><div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"><CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p></div></div></LearningLabBody></LearningLab>
    </div>
  );
}

const healthyClass = 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass = 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50';
