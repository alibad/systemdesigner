'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Database,
  Layers3,
  LoaderCircle,
  Scale,
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

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/demonstration-data/data/curation-programs.json';
const BLOCK_ID = 'ml-systems/demonstration-data-calculator';

type Task = {
  id: string;
  label: string;
  detail: string;
  risk: 'standard' | 'elevated' | 'high';
  reviewMinutes: number;
  minimumExpertAudit: number;
  minimumEvidenceScore: number;
  minimumCoverageScore: number;
  edgeCaseShare: number;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  expertShare: number;
  crowdShare: number;
  syntheticShare: number;
  acceptanceRate: number;
  screeningMinutes: number;
  coverageBase: number;
};

type LabData = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    taskId: string;
    strategyId: string;
    targetExamples: number;
    expertAuditPercent: number;
  };
  tasks: Task[];
  strategies: Strategy[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    data.title
      && data.description
      && data.notice
      && data.defaults?.taskId
      && data.defaults.strategyId
      && isFiniteNumber(data.defaults.targetExamples)
      && isFiniteNumber(data.defaults.expertAuditPercent)
      && Array.isArray(data.tasks)
      && data.tasks.length >= 3
      && data.tasks.every((task) => (
        task.id
          && task.label
          && isFiniteNumber(task.reviewMinutes)
          && isFiniteNumber(task.minimumExpertAudit)
          && isFiniteNumber(task.edgeCaseShare)
      ))
      && Array.isArray(data.strategies)
      && data.strategies.length >= 3
      && data.strategies.every((strategy) => (
        strategy.id
          && strategy.label
          && isFiniteNumber(strategy.expertShare)
          && isFiniteNumber(strategy.crowdShare)
          && isFiniteNumber(strategy.syntheticShare)
          && strategy.expertShare + strategy.crowdShare + strategy.syntheticShare === 100
          && strategy.acceptanceRate > 0
          && strategy.acceptanceRate <= 1
      )),
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatHours(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k h` : `${Math.round(value).toLocaleString()} h`;
}

export default function DemonstrationDataCalculator({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState('customer-support');
  const [strategyId, setStrategyId] = useState('balanced');
  const [targetExamples, setTargetExamples] = useState(12000);
  const [expertAuditPercent, setExpertAuditPercent] = useState(35);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Curation-planning data is incomplete.');
        setData(payload);
        setTaskId(payload.defaults.taskId);
        setStrategyId(payload.defaults.strategyId);
        setTargetExamples(payload.defaults.targetExamples);
        setExpertAuditPercent(payload.defaults.expertAuditPercent);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load planning data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const task = data?.tasks.find((item) => item.id === taskId) ?? data?.tasks[0];
  const strategy = data?.strategies.find((item) => item.id === strategyId) ?? data?.strategies[0];

  const model = useMemo(() => {
    if (!task || !strategy) return null;

    const candidatePool = Math.ceil(targetExamples / strategy.acceptanceRate);
    const screeningHours = (candidatePool * strategy.screeningMinutes) / 60;
    const expertReviewHours = (
      candidatePool
      * (expertAuditPercent / 100)
      * task.reviewMinutes
    ) / 60;
    const totalReviewHours = screeningHours + expertReviewHours;
    const evidenceScore = clamp(
      50
        + strategy.expertShare * 0.2
        + expertAuditPercent * 0.25
        + strategy.acceptanceRate * 20,
    );
    const coverageScore = clamp(
      strategy.coverageBase
        + Math.log10(Math.max(1, targetExamples / 1000)) * 4
        + expertAuditPercent * 0.05,
    );
    const edgeCaseQuota = Math.ceil(targetExamples * (task.edgeCaseShare / 100));
    const auditGap = Math.max(0, task.minimumExpertAudit - expertAuditPercent);
    const evidenceGap = Math.max(0, task.minimumEvidenceScore - evidenceScore);
    const coverageGap = Math.max(0, task.minimumCoverageScore - coverageScore);
    const ready = auditGap === 0 && evidenceGap === 0 && coverageGap === 0;

    const recommendation = ready
      ? 'The plan clears its modeled evidence and coverage thresholds. Validate the assumptions with a pilot before scaling collection.'
      : auditGap > 0
        ? `Raise expert audit by at least ${auditGap} points for this risk level, or narrow the behavior the dataset is allowed to teach.`
        : coverageGap >= evidenceGap
          ? 'The plan is broad in volume but thin in required slices. Add targeted edge cases instead of collecting more average examples.'
          : 'The evidence chain is too weak for promotion. Increase expert review or use a more controlled source mix.';

    return {
      candidatePool,
      coverageScore,
      edgeCaseQuota,
      evidenceScore,
      ready,
      recommendation,
      totalReviewHours,
    };
  }, [expertAuditPercent, strategy, targetExamples, task]);

  function reset() {
    if (!data) return;
    setTaskId(data.defaults.taskId);
    setStrategyId(data.defaults.strategyId);
    setTargetExamples(data.defaults.targetExamples);
    setExpertAuditPercent(data.defaults.expertAuditPercent);
  }

  if (!data || !task || !strategy || !model) {
    return <LoadState error={error} />;
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Curation portfolio planner"
          title={data.title}
          description={data.description}
          icon={Layers3}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Behavior being taught
                </legend>
                <div className="mt-3 space-y-2">
                  {data.tasks.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === task.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.risk === 'high' ? ShieldCheck : item.risk === 'elevated' ? Scale : Target}
                      accent={item.risk === 'high' ? 'rose' : item.risk === 'elevated' ? 'amber' : 'blue'}
                      onClick={() => setTaskId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Collection portfolio
                </legend>
                <div className="mt-3 space-y-2">
                  {data.strategies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === strategy.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.syntheticShare > 50 ? Sparkles : item.expertShare > 50 ? Users : Database}
                      accent={item.syntheticShare > 50 ? 'violet' : item.expertShare > 50 ? 'emerald' : 'cyan'}
                      onClick={() => setStrategyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="3. Accepted examples"
                value={targetExamples}
                output={targetExamples.toLocaleString()}
                min={1000}
                max={50000}
                step={1000}
                accent="blue"
                lowLabel="Focused pilot"
                highLabel="Large release"
                onChange={setTargetExamples}
              />

              <LabRange
                label="4. Candidates audited by experts"
                value={expertAuditPercent}
                output={`${expertAuditPercent}%`}
                min={5}
                max={100}
                step={5}
                accent="emerald"
                lowLabel="Spot check"
                highLabel="Every candidate"
                onChange={setExpertAuditPercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Modeled program decision
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {task.label} with a {strategy.label.toLowerCase()} portfolio
                </h4>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                model.ready
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100'
              }`}>
                {model.ready ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <CircleAlert aria-hidden="true" className="h-4 w-4" />}
                {model.ready ? 'Pilot-ready plan' : 'Plan needs evidence'}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Candidate pool"
                value={model.candidatePool.toLocaleString()}
                detail={`${Math.round(strategy.acceptanceRate * 100)}% modeled acceptance rate`}
                icon={Database}
                tone="blue"
              />
              <LabMetric
                label="Review effort"
                value={formatHours(model.totalReviewHours)}
                detail="Automated screening plus expert-audit minutes"
                icon={Clock}
                tone="violet"
              />
              <LabMetric
                label="Evidence score"
                value={`${model.evidenceScore} / 100`}
                detail={`Threshold for this task: ${task.minimumEvidenceScore}`}
                icon={ShieldCheck}
                tone={model.evidenceScore >= task.minimumEvidenceScore ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Coverage score"
                value={`${model.coverageScore} / 100`}
                detail={`Threshold for this task: ${task.minimumCoverageScore}`}
                icon={Target}
                tone={model.coverageScore >= task.minimumCoverageScore ? 'emerald' : 'rose'}
              />
            </div>

            <section aria-labelledby="source-mix-title" className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 id="source-mix-title" className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Source mix and required edge cases
                </h4>
                <span className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                  {model.edgeCaseQuota.toLocaleString()} edge-case examples
                </span>
              </div>
              <div
                role="img"
                className="mt-4 flex h-5 overflow-hidden rounded-sm"
                aria-label={`Expert ${strategy.expertShare}%, crowd ${strategy.crowdShare}%, synthetic ${strategy.syntheticShare}%`}
              >
                <span className="bg-emerald-500" style={{ width: `${strategy.expertShare}%` }} />
                <span className="bg-cyan-500" style={{ width: `${strategy.crowdShare}%` }} />
                <span className="bg-violet-500" style={{ width: `${strategy.syntheticShare}%` }} />
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <SourceLabel label="Expert" value={strategy.expertShare} className="bg-emerald-500" />
                <SourceLabel label="Crowd" value={strategy.crowdShare} className="bg-cyan-500" />
                <SourceLabel label="Synthetic" value={strategy.syntheticShare} className="bg-violet-500" />
              </div>
            </section>

            <div className={`rounded-md border p-4 ${
              model.ready
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
            }`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Next decision</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{model.recommendation}</p>
            </div>
            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function SourceLabel({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      <span>{label}</span>
      <strong className="ml-auto text-neutral-950 dark:text-white">{value}%</strong>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-400" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Curation planner unavailable' : 'Loading curation planner'}
          </p>
          {error ? <p className="mt-1">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
