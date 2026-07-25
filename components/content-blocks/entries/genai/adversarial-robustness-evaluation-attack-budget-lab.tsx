'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type AttackFamily = {
  id: string;
  label: string;
  detail: string;
  maximumAttackSuccessPct: number;
  queryScale: number;
  editSensitivity: number;
  baselineValidityPenalty: number;
  validityPenaltyPerExtraEditPct: number;
};

type CurveData = {
  cleanAccuracyPct: number;
  seedCases: number;
  releaseFloorPct: number;
  minimumSemanticValidityPct: number;
  defaultAttackId: string;
  defaultQueryBudget: number;
  defaultEditLimitPct: number;
  queryBudgetMin: number;
  queryBudgetMax: number;
  queryBudgetStep: number;
  editLimitMinPct: number;
  editLimitMaxPct: number;
  curveBudgets: number[];
  attackFamilies: AttackFamily[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/adversarial-robustness-evaluation/data/attack-budget-curves.json';

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function evaluatePoint(
  data: CurveData,
  attack: AttackFamily,
  queryBudget: number,
  editLimitPct: number,
) {
  const queryCoverage = 1 - Math.exp(-queryBudget / attack.queryScale);
  const perturbationPressure = Math.min(1.28, 0.7 + editLimitPct * attack.editSensitivity);
  const attackSuccessPct = clamp(
    attack.maximumAttackSuccessPct * queryCoverage * perturbationPressure,
    0,
    attack.maximumAttackSuccessPct,
  );
  const semanticValidityPct = clamp(
    99
      - attack.baselineValidityPenalty
      - Math.max(0, editLimitPct - 8) * attack.validityPenaltyPerExtraEditPct,
    55,
    99,
  );
  const robustAccuracyPct = data.cleanAccuracyPct * (1 - attackSuccessPct / 100);
  const validFailures = Math.round(
    data.seedCases
      * (data.cleanAccuracyPct / 100)
      * (semanticValidityPct / 100)
      * (attackSuccessPct / 100),
  );

  return { attackSuccessPct, robustAccuracyPct, semanticValidityPct, validFailures };
}

function isCurveData(value: unknown): value is CurveData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CurveData>;
  return Array.isArray(candidate.attackFamilies)
    && candidate.attackFamilies.length > 0
    && Array.isArray(candidate.curveBudgets)
    && candidate.curveBudgets.length > 1
    && typeof candidate.cleanAccuracyPct === 'number'
    && typeof candidate.queryBudgetMax === 'number';
}

export default function AdversarialRobustnessEvaluationAttackBudgetLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CurveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [attackId, setAttackId] = useState('');
  const [queryBudget, setQueryBudget] = useState(100);
  const [editLimitPct, setEditLimitPct] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const payload = (await response.json()) as unknown;
        if (!isCurveData(payload)) throw new Error('Attack curve data is incomplete.');

        if (active) {
          setData(payload);
          setAttackId(payload.defaultAttackId);
          setQueryBudget(payload.defaultQueryBudget);
          setEditLimitPct(payload.defaultEditLimitPct);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load attack data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const attack = data?.attackFamilies.find((item) => item.id === attackId)
    ?? data?.attackFamilies[0];

  const model = useMemo(() => {
    if (!data || !attack) return null;

    const selected = evaluatePoint(data, attack, queryBudget, editLimitPct);
    const curve = data.curveBudgets.map((budget) => ({
      budget,
      ...evaluatePoint(data, attack, budget, editLimitPct),
    }));
    const validityPass = selected.semanticValidityPct >= data.minimumSemanticValidityPct;
    const robustnessPass = selected.robustAccuracyPct >= data.releaseFloorPct;
    const releasePass = validityPass && robustnessPass;

    let verdict = 'This declared gate passes';
    let explanation =
      'The selected budget still leaves robust accuracy above the floor, and the perturbations remain valid enough to support the claim.';

    if (!validityPass) {
      verdict = 'Reject the test before judging the model';
      explanation =
        'Too many candidates may have changed meaning or the expected label. A low score from invalid attacks is not evidence of a model weakness.';
    } else if (!robustnessPass) {
      verdict = 'Hold release at this attack budget';
      explanation =
        'The stronger search finds enough valid failures to push robust accuracy below the predeclared floor. A smaller budget would overstate robustness.';
    }

    return { curve, explanation, releasePass, robustnessPass, selected, validityPass, verdict };
  }, [attack, data, editLimitPct, queryBudget]);

  function reset() {
    if (!data) return;
    setAttackId(data.defaultAttackId);
    setQueryBudget(data.defaultQueryBudget);
    setEditLimitPct(data.defaultEditLimitPct);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Attack-budget robustness curve"
        title="Measure robustness as the attacker spends more effort"
        description="Choose an attack family, query cap, and edit limit. The curve separates clean quality, valid attack success, and robust accuracy instead of compressing them into one score."
        icon={FlaskConical}
        accent="cyan"
        onReset={data ? reset : undefined}
      />

      {!data || !attack || !model ? (
        <div className="flex min-h-[520px] items-center justify-center p-6">
          {error ? (
            <div className="max-w-md text-center">
              <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                Attack curve data could not be loaded
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : (
            <div className="text-center" role="status">
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-cyan-500 motion-reduce:animate-none" />
              <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                Loading the attack model...
              </p>
            </div>
          )}
        </div>
      ) : (
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Attack family
                </legend>
                <div className="mt-3 space-y-2">
                  {data.attackFamilies.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={attack.id === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={Gauge}
                      accent="cyan"
                      onClick={() => setAttackId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Queries per seed"
                value={queryBudget}
                output={queryBudget.toLocaleString()}
                min={data.queryBudgetMin}
                max={data.queryBudgetMax}
                step={data.queryBudgetStep}
                accent="blue"
                lowLabel="Shallow search"
                highLabel="Persistent search"
                onChange={setQueryBudget}
              />

              <LabRange
                label="Maximum tokens edited"
                value={editLimitPct}
                output={`${editLimitPct}%`}
                min={data.editLimitMinPct}
                max={data.editLimitMaxPct}
                accent="amber"
                lowLabel="Tight validity"
                highLabel="Broader search"
                onChange={setEditLimitPct}
              />
            </div>
          )}
        >
          <div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Clean accuracy"
                value={`${data.cleanAccuracyPct.toFixed(1)}%`}
                detail="Quality before the attack."
                icon={CheckCircle2}
                tone="neutral"
              />
              <LabMetric
                label="Valid attack success"
                value={`${model.selected.attackSuccessPct.toFixed(1)}%`}
                detail="Failures among valid attack cases."
                icon={CircleAlert}
                tone="rose"
              />
              <LabMetric
                label="Robust accuracy"
                value={`${model.selected.robustAccuracyPct.toFixed(1)}%`}
                detail={`Release floor: ${data.releaseFloorPct}%`}
                icon={ShieldCheck}
                tone={model.robustnessPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Semantic validity"
                value={`${model.selected.semanticValidityPct.toFixed(1)}%`}
                detail={`Evidence floor: ${data.minimumSemanticValidityPct}%`}
                icon={Activity}
                tone={model.validityPass ? 'blue' : 'amber'}
              />
            </div>

            <RobustnessCurve
              budgets={data.curveBudgets}
              points={model.curve.map((point) => point.robustAccuracyPct)}
              releaseFloor={data.releaseFloorPct}
              selectedBudget={queryBudget}
              selectedAccuracy={model.selected.robustAccuracyPct}
            />

            <section aria-live="polite" className={`mt-5 rounded-md border p-4 ${
              model.releasePass
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
            }`}>
              <div className="flex items-start gap-3">
                {model.releasePass ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{model.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-90">{model.explanation}</p>
                  <p className="mt-2 text-xs leading-5 opacity-75">
                    In this teaching model, about {model.selected.validFailures} of {data.seedCases.toLocaleString()} seed cases become valid observed failures. The values illustrate relationships; they are not benchmark results for a real model.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      )}
    </LearningLab>
  );
}

function RobustnessCurve({
  budgets,
  points,
  releaseFloor,
  selectedBudget,
  selectedAccuracy,
}: {
  budgets: number[];
  points: number[];
  releaseFloor: number;
  selectedBudget: number;
  selectedAccuracy: number;
}) {
  const left = 52;
  const right = 574;
  const top = 20;
  const bottom = 220;
  const minimumBudget = budgets[0];
  const maximumBudget = budgets[budgets.length - 1];
  const xForBudget = (budget: number) => left
    + (Math.log(budget / minimumBudget) / Math.log(maximumBudget / minimumBudget)) * (right - left);
  const yForAccuracy = (accuracy: number) => bottom - (accuracy / 100) * (bottom - top);
  const linePoints = budgets
    .map((budget, index) => `${xForBudget(budget)},${yForAccuracy(points[index])}`)
    .join(' ');
  const selectedX = xForBudget(clamp(selectedBudget, minimumBudget, maximumBudget));
  const selectedY = yForAccuracy(selectedAccuracy);

  return (
    <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">Robustness versus query budget</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          The horizontal axis is logarithmic. A release claim must name the budget and attack family represented by the selected point.
        </p>
      </div>
      <div className="overflow-x-auto p-3">
        <svg
          viewBox="0 0 600 260"
          className="h-64 min-w-[560px] w-full text-neutral-500"
          role="img"
          aria-label={`Robust accuracy is ${selectedAccuracy.toFixed(1)} percent at ${selectedBudget} queries per seed. The release floor is ${releaseFloor} percent.`}
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={yForAccuracy(tick)}
                y2={yForAccuracy(tick)}
                className="stroke-neutral-200 dark:stroke-neutral-800"
                strokeWidth="1"
              />
              <text x="42" y={yForAccuracy(tick) + 4} textAnchor="end" className="fill-neutral-500 text-[11px]">
                {tick}%
              </text>
            </g>
          ))}
          <line
            x1={left}
            x2={right}
            y1={yForAccuracy(releaseFloor)}
            y2={yForAccuracy(releaseFloor)}
            className="stroke-amber-500"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
          <text x={right - 4} y={yForAccuracy(releaseFloor) - 7} textAnchor="end" className="fill-amber-700 text-[11px] font-semibold dark:fill-amber-300">
            Release floor
          </text>
          <polyline
            points={linePoints}
            fill="none"
            className="stroke-cyan-600 dark:stroke-cyan-300"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {budgets.map((budget, index) => (
            <g key={budget}>
              <circle
                cx={xForBudget(budget)}
                cy={yForAccuracy(points[index])}
                r="4"
                className="fill-white stroke-cyan-700 dark:fill-neutral-950 dark:stroke-cyan-300"
                strokeWidth="2"
              />
              <text x={xForBudget(budget)} y="242" textAnchor="middle" className="fill-neutral-500 text-[10px]">
                {budget >= 1000 ? `${budget / 1000}K` : budget}
              </text>
            </g>
          ))}
          <line
            x1={selectedX}
            x2={selectedX}
            y1={selectedY}
            y2={bottom}
            className="stroke-blue-500"
            strokeDasharray="3 4"
            strokeWidth="2"
          />
          <circle cx={selectedX} cy={selectedY} r="7" className="fill-blue-600 stroke-white dark:fill-blue-400 dark:stroke-neutral-950" strokeWidth="3" />
          <text x={(left + right) / 2} y="258" textAnchor="middle" className="fill-neutral-600 text-[11px] font-semibold dark:fill-neutral-300">
            Queries per seed
          </text>
        </svg>
      </div>
    </section>
  );
}
