'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Languages,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  Users,
  Workflow,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type SessionMode = 'single-turn' | 'multi-turn';
type ReviewMode = 'automated' | 'mixed';
type Severity = 'moderate' | 'high' | 'critical';

type AttackFamily = {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  requiresMultiTurn: boolean;
  requiresHumanReview: boolean;
  languageSensitive: boolean;
};

type Surface = {
  id: string;
  label: string;
  detail: string;
  deploymentLanguages: number;
  requiredFamilyIds: string[];
};

type Campaign = {
  id: string;
  label: string;
  detail: string;
  baseCases: number;
  coverageByFamily: Record<string, number>;
};

type RedTeamData = {
  defaultSurfaceId: string;
  defaultCampaignId: string;
  defaultLanguages: number;
  families: AttackFamily[];
  surfaces: Surface[];
  campaigns: Campaign[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/safety-evaluation-advanced/data/red-team-coverage.json';

const severityWeight: Record<Severity, number> = {
  moderate: 1,
  high: 2,
  critical: 3,
};

function isRedTeamData(value: unknown): value is RedTeamData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RedTeamData>;
  return typeof candidate.defaultSurfaceId === 'string'
    && typeof candidate.defaultCampaignId === 'string'
    && typeof candidate.defaultLanguages === 'number'
    && Array.isArray(candidate.families)
    && candidate.families.length > 0
    && Array.isArray(candidate.surfaces)
    && candidate.surfaces.length > 0
    && Array.isArray(candidate.campaigns)
    && candidate.campaigns.length > 0;
}

export default function SafetyEvaluationAdvancedRedTeamCoverageLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RedTeamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [surfaceId, setSurfaceId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [languages, setLanguages] = useState(2);
  const [sessionMode, setSessionMode] = useState<SessionMode>('single-turn');
  const [reviewMode, setReviewMode] = useState<ReviewMode>('automated');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isRedTeamData(payload)) throw new Error('Red-team coverage data is incomplete.');

        if (active) {
          setData(payload);
          setSurfaceId(payload.defaultSurfaceId);
          setCampaignId(payload.defaultCampaignId);
          setLanguages(payload.defaultLanguages);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load red-team coverage.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const surface = data?.surfaces.find((item) => item.id === surfaceId) ?? data?.surfaces[0];
  const campaign = data?.campaigns.find((item) => item.id === campaignId) ?? data?.campaigns[0];

  const model = useMemo(() => {
    if (!data || !surface || !campaign) return null;

    const requiredFamilies = data.families.filter((family) => surface.requiredFamilyIds.includes(family.id));
    const rows = requiredFamilies.map((family) => {
      let score = campaign.coverageByFamily[family.id] ?? 0;
      if (family.requiresMultiTurn && sessionMode === 'single-turn') score *= 0.35;
      if (family.requiresHumanReview && reviewMode === 'automated') score *= 0.65;
      if (family.languageSensitive) {
        const languageRatio = Math.min(1, languages / surface.deploymentLanguages);
        score *= 0.45 + languageRatio * 0.55;
      }
      const roundedScore = Math.round(Math.min(100, score));
      const status = roundedScore >= 70 ? 'covered' : roundedScore >= 40 ? 'shallow' : 'missing';
      return { family, score: roundedScore, status };
    });

    const totalWeight = rows.reduce((sum, row) => sum + severityWeight[row.family.severity], 0);
    const weightedCoverage = rows.reduce(
      (sum, row) => sum + row.score * severityWeight[row.family.severity],
      0,
    ) / Math.max(1, totalWeight);
    const coveredCount = rows.filter((row) => row.status === 'covered').length;
    const criticalGaps = rows.filter(
      (row) => row.family.severity === 'critical' && row.status !== 'covered',
    );
    const gaps = rows.filter((row) => row.status !== 'covered');
    const claimValid = gaps.length === 0;
    const estimatedCases = Math.round(
      campaign.baseCases
      * Math.max(1, languages / 2)
      * (sessionMode === 'multi-turn' ? 1.45 : 1)
      * (reviewMode === 'mixed' ? 1.2 : 1),
    );

    return {
      claimValid,
      coveredCount,
      criticalGaps,
      estimatedCases,
      gaps,
      rows,
      weightedCoverage,
    };
  }, [campaign, data, languages, reviewMode, sessionMode, surface]);

  function reset() {
    if (!data) return;
    setSurfaceId(data.defaultSurfaceId);
    setCampaignId(data.defaultCampaignId);
    setLanguages(data.defaultLanguages);
    setSessionMode('single-turn');
    setReviewMode('automated');
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Red-team coverage planner"
        title="Expose the attack paths your campaign does not exercise"
        description="Select the deployed surface and campaign design, then add languages, multi-turn sessions, and human review. Coverage means exercising relevant attacker paths, not merely generating many prompts."
        icon={ScanSearch}
        accent="rose"
        onReset={data ? reset : undefined}
      />

      {!data || !surface || !campaign || !model ? (
        <LearningLabBody>
          <div className="grid min-h-[420px] place-items-center text-center">
            {error ? (
              <div>
                <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
                <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Coverage data could not load</p>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Retry
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading red-team coverage...</p>
            )}
          </div>
        </LearningLabBody>
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Deployed surface
                </legend>
                <div className="mt-3 space-y-2">
                  {data.surfaces.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === surface.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'tool-agent' ? Workflow : Bot}
                      accent={item.id === 'tool-agent' ? 'rose' : 'violet'}
                      onClick={() => setSurfaceId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Campaign strategy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.campaigns.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === campaign.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ScanSearch}
                      accent={item.id === 'adaptive' ? 'emerald' : 'amber'}
                      onClick={() => setCampaignId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Languages exercised"
                value={languages}
                output={`${languages} of ${surface.deploymentLanguages}`}
                min={1}
                max={8}
                step={1}
                accent="blue"
                lowLabel="One language"
                highLabel="Eight languages"
                onChange={setLanguages}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  4. Conversation depth
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <LabChoice
                    selected={sessionMode === 'single-turn'}
                    label="Single turn"
                    detail="Independent prompts only."
                    accent="amber"
                    onClick={() => setSessionMode('single-turn')}
                  />
                  <LabChoice
                    selected={sessionMode === 'multi-turn'}
                    label="Multi-turn"
                    detail="Escalation and stateful probing."
                    accent="emerald"
                    onClick={() => setSessionMode('multi-turn')}
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  5. Review mode
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <LabChoice
                    selected={reviewMode === 'automated'}
                    label="Automated only"
                    detail="Fast, with judge blind spots."
                    icon={Bot}
                    accent="amber"
                    onClick={() => setReviewMode('automated')}
                  />
                  <LabChoice
                    selected={reviewMode === 'mixed'}
                    label="Mixed review"
                    detail="Humans adjudicate high-risk cases."
                    icon={Users}
                    accent="emerald"
                    onClick={() => setReviewMode('mixed')}
                  />
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[720px] min-w-0">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Weighted path coverage"
                value={`${model.weightedCoverage.toFixed(0)}%`}
                detail="Critical families receive more weight."
                icon={ShieldAlert}
                tone={model.claimValid ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Families covered"
                value={`${model.coveredCount}/${model.rows.length}`}
                detail="Each family needs at least 70%."
                icon={CheckCircle2}
                tone={model.coveredCount === model.rows.length ? 'cyan' : 'amber'}
              />
              <LabMetric
                label="Critical gaps"
                value={model.criticalGaps.length.toString()}
                detail="A critical gap blocks the coverage claim."
                icon={CircleAlert}
                tone={model.criticalGaps.length === 0 ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Estimated campaign cases"
                value={model.estimatedCases.toLocaleString()}
                detail="Illustrative planning volume, not a guarantee."
                icon={Languages}
                tone="neutral"
              />
            </div>

            <section
              aria-live="polite"
              className={`mt-5 rounded-md border p-5 ${model.claimValid
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'}`}
            >
              <div className="flex items-start gap-3">
                {model.claimValid ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {model.claimValid ? 'Coverage claim supported' : 'Coverage claim blocked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {model.claimValid
                      ? `The campaign exercises every declared ${surface.label.toLowerCase()} attack family`
                      : `${model.gaps.length} relevant attack paths remain shallow or missing`}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {model.claimValid
                      ? 'Retain raw prompts, outputs, judge versions, human adjudications, and mitigation links so another reviewer can reproduce the claim.'
                      : `Close these gaps before release: ${model.gaps.map((row) => row.family.label).join(', ')}. More prompts in an already covered family do not repair a missing path.`}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Attack-family coverage matrix</h4>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Scores model breadth across mutations, sessions, languages, and review. They are teaching values, not measured benchmark results.
                  </p>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Deployment: {surface.deploymentLanguages} languages
                </p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {model.rows.map((row) => (
                  <div
                    key={row.family.id}
                    className={`min-h-44 rounded-md border p-4 ${row.status === 'covered'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/25'
                      : row.status === 'shallow'
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25'
                        : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/25'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{row.family.label}</p>
                        <p className="mt-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                          {row.family.severity} severity
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {row.score}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded bg-white/80 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded ${row.status === 'covered'
                          ? 'bg-emerald-500'
                          : row.status === 'shallow'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'}`}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{row.family.detail}</p>
                    <p className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Status: {row.status === 'covered' ? 'covered' : row.status === 'shallow' ? 'shallow evidence' : 'missing path'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}
