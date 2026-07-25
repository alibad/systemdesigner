'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Circle,
  Microscope,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Candidate = {
  id: string;
  label: string;
  baselineScore: number;
};

type Probe = {
  id: string;
  label: string;
  question: string;
  result: string;
  interpretation: string;
  scoreChanges: Record<string, number>;
};

type DiagnosisScenario = {
  id: string;
  label: string;
  symptom: string;
  userImpact: string;
  candidates: Candidate[];
  probes: Probe[];
  confirmedCandidateId: string;
  safeAction: string;
  verification: string;
};

type DiagnosisData = {
  scenarios: DiagnosisScenario[];
};

const DEFAULT_DATA_FILE = '/api/content/fundamentals/bottleneck-analysis/data/symptom-evidence-diagnosis.json';

function clampScore(value: number) {
  return Math.min(95, Math.max(5, value));
}

function scoreTone(score: number) {
  if (score >= 70) return 'bg-rose-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-blue-500';
}

export default function BottleneckAnalysisDiagnosisLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [selectedProbeIds, setSelectedProbeIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);

      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);

        const payload = (await response.json()) as DiagnosisData;
        if (!Array.isArray(payload.scenarios) || payload.scenarios.length === 0) {
          throw new Error('Diagnosis data does not contain any incidents.');
        }

        if (active) {
          setData(payload);
          setScenarioId(payload.scenarios[0].id);
          setSelectedProbeIds([]);
        }
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load diagnosis data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];

  const model = useMemo(() => {
    if (!scenario) return null;

    const selectedProbes = scenario.probes.filter((probe) => selectedProbeIds.includes(probe.id));
    const candidates = scenario.candidates
      .map((candidate) => ({
        ...candidate,
        score: clampScore(
          candidate.baselineScore
            + selectedProbes.reduce(
              (sum, probe) => sum + (probe.scoreChanges[candidate.id] ?? 0),
              0,
            ),
        ),
      }))
      .sort((left, right) => right.score - left.score);

    const leader = candidates[0];
    const nextProbe = scenario.probes.find((probe) => !selectedProbeIds.includes(probe.id));
    const supported = selectedProbes.length >= 2
      && leader.id === scenario.confirmedCandidateId
      && leader.score >= 65;

    return { candidates, leader, nextProbe, selectedProbes, supported };
  }, [scenario, selectedProbeIds]);

  function chooseScenario(nextScenarioId: string) {
    setScenarioId(nextScenarioId);
    setSelectedProbeIds([]);
  }

  function toggleProbe(probeId: string) {
    setSelectedProbeIds((current) => current.includes(probeId)
      ? current.filter((id) => id !== probeId)
      : [...current, probeId]);
  }

  return (
    <div data-content-block="fundamentals/bottleneck-analysis-diagnosis-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Symptom-to-evidence diagnosis"
          title="Turn a plausible guess into a tested constraint"
          description="Choose an incident, then collect probes. Each observation changes the evidence score for competing causes, so the diagnosis follows measured facts instead of the loudest graph."
          icon={Search}
          accent="violet"
          onReset={data ? () => {
            setScenarioId(data.scenarios[0].id);
            setSelectedProbeIds([]);
          } : undefined}
        />

        {!data || !scenario || !model ? (
          <div className="flex min-h-[360px] items-center justify-center p-6">
            {error ? (
              <div className="max-w-md text-center">
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">Diagnosis data could not be loaded</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((current) => current + 1)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </div>
            ) : (
              <div className="text-center" role="status">
                <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-violet-500 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Loading incident evidence...</p>
              </div>
            )}
          </div>
        ) : (
          <LearningLabBody
            controls={
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. User-visible symptom</legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={scenario.id === option.id}
                        label={option.label}
                        detail={option.userImpact}
                        icon={TriangleAlert}
                        accent="violet"
                        onClick={() => chooseScenario(option.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Evidence to collect</legend>
                  <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Select a probe to reveal its observation. Select it again to remove that evidence from the model.</p>
                  <div className="mt-3 space-y-2">
                    {scenario.probes.map((probe) => {
                      const selected = selectedProbeIds.includes(probe.id);
                      return (
                        <button
                          key={probe.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleProbe(probe.id)}
                          className={`w-full rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            selected
                              ? 'border-violet-300 bg-violet-50 text-violet-950 ring-1 ring-violet-300 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-50 dark:ring-violet-800'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            {selected ? (
                              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{probe.label}</span>
                              <span className="mt-1 block text-xs leading-5 opacity-75">{probe.question}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            }
          >
            <div aria-live="polite">
              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed symptom</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">{scenario.symptom}</p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">A symptom narrows the search, but it does not identify the constrained resource by itself.</p>
              </section>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <LabMetric
                  label="Evidence collected"
                  value={`${model.selectedProbes.length} / ${scenario.probes.length}`}
                  detail={model.selectedProbes.length === 0 ? 'No causal evidence yet.' : 'Only selected observations affect the score.'}
                  icon={Microscope}
                  tone={model.selectedProbes.length >= 2 ? 'emerald' : 'neutral'}
                />
                <LabMetric
                  label="Leading candidate"
                  value={model.selectedProbes.length === 0 ? 'Undetermined' : model.leader.label}
                  detail={model.selectedProbes.length === 0 ? 'Collect a discriminating probe first.' : `${model.leader.score}/100 evidence score in this teaching model.`}
                  icon={Search}
                  tone={model.supported ? 'emerald' : 'amber'}
                />
              </div>

              <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                  <p className="text-sm font-semibold text-neutral-950 dark:text-white">Competing explanations</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Scores are relative diagnostic weights, not statistical probabilities. Useful evidence should raise one explanation and rule down others.</p>
                </div>
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {model.candidates.map((candidate) => (
                    <li key={candidate.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">{candidate.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{candidate.score}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${scoreTone(candidate.score)}`}
                          style={{ width: `${candidate.score}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-5">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Evidence trail</h4>
                {model.selectedProbes.length === 0 ? (
                  <p className="mt-2 rounded-md border border-dashed border-neutral-300 p-4 text-sm leading-6 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">No probes selected. Resource utilization alone cannot prove the cause; collect evidence that separates waiting, active work, and dependency time.</p>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {model.selectedProbes.map((probe) => (
                      <li key={probe.id} className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{probe.label}: {probe.result}</p>
                        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{probe.interpretation}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className={`mt-5 rounded-md border p-4 ${
                model.supported
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
              }`}>
                <p className="text-xs font-semibold uppercase opacity-75">Diagnosis consequence</p>
                {model.supported ? (
                  <>
                    <p className="mt-2 text-sm font-semibold">The evidence now supports {model.leader.label.toLowerCase()} as the active constraint.</p>
                    <p className="mt-2 text-sm leading-6 opacity-90"><strong>Safe action:</strong> {scenario.safeAction}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90"><strong>Verify:</strong> {scenario.verification}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold">Keep the diagnosis provisional.</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{model.nextProbe ? `Next useful probe: ${model.nextProbe.label}. ${model.nextProbe.question}` : 'The selected evidence still conflicts; repeat the controlled test and check telemetry quality.'}</p>
                  </>
                )}
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}
