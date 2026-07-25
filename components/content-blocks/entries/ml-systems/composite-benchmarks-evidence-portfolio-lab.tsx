'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  CheckCircle2,
  CircleAlert,
  FileWarning,
  FlaskConical,
  Layers3,
  Network,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Square,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ContaminationPolicy = 'quarantine' | 'include-flagged';
type ContaminationRisk = 'low' | 'high';

type Capability = {
  id: string;
  label: string;
};

type Requirement = {
  capabilityId: string;
  floor: number;
};

type Decision = {
  id: string;
  label: string;
  detail: string;
  minimumIndependentClusters: number;
  requirements: Requirement[];
};

type Candidate = {
  id: string;
  label: string;
  detail: string;
  scores: Record<string, number>;
};

type EvaluationTask = {
  id: string;
  label: string;
  detail: string;
  capabilityIds: string[];
  correlationCluster: string;
  contaminationRisk: ContaminationRisk;
};

type EvidenceData = {
  kind: 'composite-evidence-portfolio';
  blockId: string;
  teachingDataNotice: string;
  defaultDecisionId: string;
  defaultCandidateId: string;
  defaultContaminationPolicy: ContaminationPolicy;
  defaultSelectedTaskIds: string[];
  capabilities: Capability[];
  decisions: Decision[];
  candidates: Candidate[];
  tasks: EvaluationTask[];
};

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/composite-benchmarks/data/evidence-portfolio-model.json';

function isNumberRecord(value: unknown): value is Record<string, number> {
  return Boolean(value)
    && typeof value === 'object'
    && Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    );
}

function isEvidenceData(value: unknown): value is EvidenceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceData>;
  return candidate.kind === 'composite-evidence-portfolio'
    && typeof candidate.blockId === 'string'
    && typeof candidate.teachingDataNotice === 'string'
    && typeof candidate.defaultDecisionId === 'string'
    && typeof candidate.defaultCandidateId === 'string'
    && (
      candidate.defaultContaminationPolicy === 'quarantine'
      || candidate.defaultContaminationPolicy === 'include-flagged'
    )
    && Array.isArray(candidate.defaultSelectedTaskIds)
    && Array.isArray(candidate.capabilities)
    && candidate.capabilities.length > 0
    && Array.isArray(candidate.decisions)
    && candidate.decisions.length > 0
    && candidate.decisions.every((item) => Array.isArray(item.requirements))
    && Array.isArray(candidate.candidates)
    && candidate.candidates.length >= 2
    && candidate.candidates.every((item) => isNumberRecord(item.scores))
    && Array.isArray(candidate.tasks)
    && candidate.tasks.length >= 3
    && candidate.tasks.every(
      (item) => item.contaminationRisk === 'low' || item.contaminationRisk === 'high',
    );
}

function mean(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export default function CompositeBenchmarksEvidencePortfolioLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [decisionId, setDecisionId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [contaminationPolicy, setContaminationPolicy] =
    useState<ContaminationPolicy>('quarantine');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isEvidenceData(payload)) throw new Error('Evidence portfolio is incomplete.');
        if (active) {
          setData(payload);
          setDecisionId(payload.defaultDecisionId);
          setCandidateId(payload.defaultCandidateId);
          setContaminationPolicy(payload.defaultContaminationPolicy);
          setSelectedTaskIds([...payload.defaultSelectedTaskIds]);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load evidence-portfolio data.',
          );
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const decision = data?.decisions.find((item) => item.id === decisionId)
    ?? data?.decisions[0];
  const candidate = data?.candidates.find((item) => item.id === candidateId)
    ?? data?.candidates[0];

  const model = useMemo(() => {
    if (!data || !decision || !candidate) return null;
    const selectedTasks = data.tasks.filter((task) => selectedTaskIds.includes(task.id));
    const quarantinedTasks = contaminationPolicy === 'quarantine'
      ? selectedTasks.filter((task) => task.contaminationRisk === 'high')
      : [];
    const activeTasks = selectedTasks.filter(
      (task) => !quarantinedTasks.some((quarantined) => quarantined.id === task.id),
    );
    const flaggedIncluded = activeTasks.filter(
      (task) => task.contaminationRisk === 'high',
    );
    const independentClusters = new Set(
      activeTasks.map((task) => task.correlationCluster),
    );
    const redundancyCount = activeTasks.length - independentClusters.size;

    const requirements = decision.requirements.map((requirement) => {
      const capability = data.capabilities.find(
        (item) => item.id === requirement.capabilityId,
      );
      const evidenceTasks = activeTasks.filter((task) =>
        task.capabilityIds.includes(requirement.capabilityId),
      );
      const scores = evidenceTasks.map((task) => candidate.scores[task.id] ?? 0);
      const conservativeScore = scores.length > 0 ? Math.min(...scores) : null;
      return {
        ...requirement,
        capabilityLabel: capability?.label ?? requirement.capabilityId,
        conservativeScore,
        evidenceTasks,
        passes: conservativeScore !== null && conservativeScore >= requirement.floor,
      };
    });

    const missingRequirements = requirements.filter(
      (requirement) => requirement.evidenceTasks.length === 0,
    );
    const failedRequirements = requirements.filter(
      (requirement) => (
        requirement.conservativeScore !== null
        && requirement.conservativeScore < requirement.floor
      ),
    );
    const coveragePass = missingRequirements.length === 0;
    const floorsPass = failedRequirements.length === 0;
    const diversityPass =
      independentClusters.size >= decision.minimumIndependentClusters;
    const integrityPass = flaggedIncluded.length === 0;

    const headlineRanking = data.candidates
      .map((item) => ({
        ...item,
        score: mean(activeTasks.map((task) => item.scores[task.id] ?? 0)),
      }))
      .sort((left, right) => right.score - left.score);

    let state: 'pass' | 'hold' | 'block';
    let title: string;
    let explanation: string;
    if (activeTasks.length === 0) {
      state = 'block';
      title = 'No usable evidence';
      explanation = 'Select at least one evaluation task. A release score cannot be inferred from an empty or fully quarantined portfolio.';
    } else if (!coveragePass) {
      state = 'block';
      title = 'Required capabilities are untested';
      explanation = `Add independent evidence for ${missingRequirements.map((item) => item.capabilityLabel).join(', ')}. A strong average cannot substitute for missing release requirements.`;
    } else if (!floorsPass) {
      state = 'block';
      title = 'A hard capability floor failed';
      explanation = `${failedRequirements.map((item) => `${item.capabilityLabel} ${item.conservativeScore?.toFixed(0)} < ${item.floor}`).join('; ')}. Unrelated strengths cannot cancel a predeclared floor.`;
    } else if (!integrityPass) {
      state = 'hold';
      title = 'Hold for clean evidence';
      explanation = `${flaggedIncluded.map((task) => task.label).join(', ')} remains in the score despite a high contamination risk. Replace or quarantine the affected evaluation before treating the result as generalization evidence.`;
    } else if (!diversityPass) {
      state = 'hold';
      title = 'Hold for independent coverage';
      explanation = `The portfolio contains ${independentClusters.size} independent signal clusters; this decision requires ${decision.minimumIndependentClusters}. Adding another task from an existing cluster does not close the gap.`;
    } else {
      state = 'pass';
      title = 'Eligible for a bounded canary';
      explanation = `${candidate.label} has usable evidence for every required capability, clears each declared floor, and reaches the minimum independent-cluster count. Product monitoring and rollback criteria still apply.`;
    }

    return {
      activeTasks,
      coveragePass,
      diversityPass,
      failedRequirements,
      flaggedIncluded,
      floorsPass,
      headlineLeader: headlineRanking[0],
      independentClusterCount: independentClusters.size,
      integrityPass,
      quarantinedTasks,
      redundancyCount,
      requirements,
      state,
      title,
      explanation,
    };
  }, [candidate, contaminationPolicy, data, decision, selectedTaskIds]);

  function toggleTask(taskId: string) {
    setSelectedTaskIds((current) => (
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    ));
  }

  function reset() {
    if (!data) return;
    setDecisionId(data.defaultDecisionId);
    setCandidateId(data.defaultCandidateId);
    setContaminationPolicy(data.defaultContaminationPolicy);
    setSelectedTaskIds([...data.defaultSelectedTaskIds]);
  }

  return (
    <div data-content-block={data?.blockId}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence portfolio lab"
          title="Build evidence for a release claim"
          description="Choose the decision, candidate, task portfolio, and contamination policy. The lab separates task count from independent coverage and a headline average from release eligibility."
          icon={Network}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !decision || !candidate || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Release decision
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.decisions.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === decision.id}
                        label={item.label}
                        detail={item.detail}
                        icon={Layers3}
                        accent={item.id === 'regulated-review' ? 'rose' : 'cyan'}
                        onClick={() => setDecisionId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Candidate
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.candidates.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === candidate.id}
                        label={item.label}
                        detail={item.detail}
                        icon={FlaskConical}
                        accent={item.id === 'harbor' ? 'emerald' : 'blue'}
                        onClick={() => setCandidateId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Contamination policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    <LabChoice
                      selected={contaminationPolicy === 'quarantine'}
                      label="Quarantine flagged tasks"
                      detail="Remove high-risk tasks from coverage and scores until clean replacements exist."
                      icon={ShieldCheck}
                      accent="emerald"
                      onClick={() => setContaminationPolicy('quarantine')}
                    />
                    <LabChoice
                      selected={contaminationPolicy === 'include-flagged'}
                      label="Include with warning"
                      detail="Keep flagged results visible, but hold the release claim on integrity."
                      icon={FileWarning}
                      accent="amber"
                      onClick={() => setContaminationPolicy('include-flagged')}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    4. Evaluation tasks
                  </legend>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                    Tasks in the same cluster may add cases without adding an independent capability signal.
                  </p>
                  <div className="mt-3 space-y-2">
                    {data.tasks.map((task) => {
                      const selected = selectedTaskIds.includes(task.id);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleTask(task.id)}
                          className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                            selected
                              ? 'border-cyan-300 bg-cyan-50 text-cyan-950 ring-1 ring-cyan-300 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-50 dark:ring-cyan-800'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-current">
                              {selected ? (
                                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                              ) : (
                                <Square aria-hidden="true" className="h-3 w-3 opacity-0" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{task.label}</span>
                                {task.contaminationRisk === 'high' ? (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    overlap risk
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 opacity-75">
                                {task.detail}
                              </span>
                              <span className="mt-1 block text-[11px] font-medium opacity-60">
                                Cluster: {task.correlationCluster}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-h-[760px] min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Selected tasks"
                  value={`${selectedTaskIds.length}`}
                  detail={`${model.activeTasks.length} usable after policy`}
                  icon={FlaskConical}
                  tone="blue"
                />
                <LabMetric
                  label="Independent clusters"
                  value={`${model.independentClusterCount}`}
                  detail={`Decision requires ${decision.minimumIndependentClusters}`}
                  icon={Network}
                  tone={model.diversityPass ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Redundant additions"
                  value={`${model.redundancyCount}`}
                  detail="Tasks beyond unique correlation clusters"
                  icon={Layers3}
                  tone={model.redundancyCount > 0 ? 'amber' : 'neutral'}
                />
                <LabMetric
                  label="Headline leader"
                  value={model.headlineLeader?.label ?? 'None'}
                  detail={model.headlineLeader ? `${model.headlineLeader.score.toFixed(1)} mean across usable tasks` : 'No usable task scores'}
                  icon={BarChart3}
                  tone="violet"
                />
              </div>

              <section className="mt-5" aria-labelledby="release-contract-title">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300"
                  />
                  <div>
                    <h4
                      id="release-contract-title"
                      className="text-base font-semibold text-neutral-950 dark:text-white"
                    >
                      Required capabilities for {decision.label.toLowerCase()}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      Each card uses the lowest selected score that covers the capability. This conservative rule prevents a strong duplicate from hiding a weak slice.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {model.requirements.map((requirement) => {
                    const covered = requirement.conservativeScore !== null;
                    const tone = requirement.passes
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30';
                    return (
                      <article
                        key={requirement.capabilityId}
                        className={`rounded-md border p-4 ${tone}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                              Required capability
                            </p>
                            <h5 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                              {requirement.capabilityLabel}
                            </h5>
                          </div>
                          {requirement.passes ? (
                            <CheckCircle2
                              aria-label="Pass"
                              className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                            />
                          ) : (
                            <ShieldX
                              aria-label="Fail"
                              className="h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                            />
                          )}
                        </div>
                        <p className="mt-3 text-2xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                          {covered ? `${requirement.conservativeScore?.toFixed(0)}%` : 'Untested'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          Floor {requirement.floor}% · {requirement.evidenceTasks.length} usable task{requirement.evidenceTasks.length === 1 ? '' : 's'}
                        </p>
                        {requirement.evidenceTasks.length > 0 ? (
                          <ul className="mt-3 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                            {requirement.evidenceTasks.map((task) => (
                              <li key={task.id}>
                                {task.label}: {candidate.scores[task.id]}%
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="mt-6" aria-labelledby="portfolio-map-title">
                <div className="flex items-start gap-3">
                  <Network
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300"
                  />
                  <div>
                    <h4
                      id="portfolio-map-title"
                      className="text-base font-semibold text-neutral-950 dark:text-white"
                    >
                      Usable evidence by correlation cluster
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      Separate clusters are not guaranteed independence, but duplicate cluster labels make known redundancy explicit.
                    </p>
                  </div>
                </div>

                {model.activeTasks.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {model.activeTasks.map((task) => (
                      <article
                        key={task.id}
                        className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h5 className="font-semibold text-neutral-950 dark:text-white">
                              {task.label}
                            </h5>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {task.correlationCluster}
                            </p>
                          </div>
                          <span className="text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
                            {candidate.scores[task.id]}%
                          </span>
                        </div>
                        <div
                          className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                          role="img"
                          aria-label={`${candidate.label} scored ${candidate.scores[task.id]} percent on ${task.label}`}
                        >
                          <div
                            className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                            style={{ width: `${candidate.scores[task.id]}%` }}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-5 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                    No usable tasks remain. Select a clean task or change the portfolio.
                  </div>
                )}

                {model.quarantinedTasks.length > 0 ? (
                  <p className="mt-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                    Quarantined: {model.quarantinedTasks.map((task) => task.label).join(', ')}. Quarantined evidence contributes neither coverage nor score.
                  </p>
                ) : null}
              </section>

              <section
                className={`mt-5 rounded-md border p-5 ${
                  model.state === 'pass'
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : model.state === 'hold'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-3">
                  {model.state === 'pass' ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                    />
                  ) : model.state === 'hold' ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
                    />
                  ) : (
                    <ShieldX
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                    />
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Release evidence decision
                    </p>
                    <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                      {model.title}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {model.explanation}
                    </p>
                  </div>
                </div>
              </section>

              <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {data.teachingDataNotice}
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
        <p className="font-semibold">
          {error ? 'The evidence portfolio could not load.' : 'Loading the evidence portfolio…'}
        </p>
        {error ? <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{error}</p> : null}
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 font-semibold text-neutral-900 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
