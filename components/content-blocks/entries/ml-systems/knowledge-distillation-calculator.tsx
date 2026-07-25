'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  BrainCircuit,
  Check,
  Cpu,
  Gauge,
  HardDrive,
  Scale,
  Server,
  TriangleAlert,
  X,
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
  '/api/content/ml-systems/knowledge-distillation/data/soft-target-scenarios.json';
const SIGNAL_BLOCK_ID = 'ml-systems/knowledge-distillation-signal-lab';
const RELEASE_BLOCK_ID = 'ml-systems/knowledge-distillation-deployment-gate-lab';

interface SignalScenario {
  id: string;
  label: string;
  detail: string;
  groundTruthIndex: number;
  teacherLogits: number[];
  studentLogits: number[];
}

interface SignalLabData {
  kind: 'signal-lab';
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    temperature: number;
    teacherWeightPercent: number;
  };
  classes: string[];
  scenarios: SignalScenario[];
}

interface DeploymentProfile {
  id: string;
  label: string;
  detail: string;
  maxP95Ms: number;
  maxMemoryMb: number;
  minOverallScore: number;
  minWorstSliceScore: number;
}

interface CandidateBenchmark {
  p95Ms: number;
  peakMemoryMb: number;
}

interface DeploymentCandidate {
  id: string;
  label: string;
  detail: string;
  parametersM: number;
  artifactMb: number;
  overallScore: number;
  worstSliceScore: number;
  benchmarks: Record<string, CandidateBenchmark>;
}

interface ReleaseLabData {
  kind: 'release-lab';
  title: string;
  description: string;
  baselineCandidateId: string;
  defaults: {
    profileId: string;
    candidateId: string;
  };
  profiles: DeploymentProfile[];
  candidates: DeploymentCandidate[];
}

type LabData = SignalLabData | ReleaseLabData;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 1 && value.every(isFiniteNumber);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 1 && value.every((item) => typeof item === 'string');
}

function isSignalLabData(value: unknown): value is SignalLabData {
  if (!isRecord(value) || value.kind !== 'signal-lab') return false;
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    !isRecord(value.defaults) ||
    typeof value.defaults.scenarioId !== 'string' ||
    !isFiniteNumber(value.defaults.temperature) ||
    !isFiniteNumber(value.defaults.teacherWeightPercent) ||
    !isStringArray(value.classes) ||
    !Array.isArray(value.scenarios) ||
    value.scenarios.length === 0
  ) {
    return false;
  }

  const classes = value.classes;
  return value.scenarios.every((scenario) => {
    if (!isRecord(scenario)) return false;
    return (
      typeof scenario.id === 'string' &&
      typeof scenario.label === 'string' &&
      typeof scenario.detail === 'string' &&
      Number.isInteger(scenario.groundTruthIndex) &&
      Number(scenario.groundTruthIndex) >= 0 &&
      Number(scenario.groundTruthIndex) < classes.length &&
      isNumberArray(scenario.teacherLogits) &&
      isNumberArray(scenario.studentLogits) &&
      scenario.teacherLogits.length === classes.length &&
      scenario.studentLogits.length === classes.length
    );
  });
}

function isBenchmark(value: unknown): value is CandidateBenchmark {
  return (
    isRecord(value) &&
    isFiniteNumber(value.p95Ms) &&
    value.p95Ms > 0 &&
    isFiniteNumber(value.peakMemoryMb) &&
    value.peakMemoryMb > 0
  );
}

function isReleaseLabData(value: unknown): value is ReleaseLabData {
  if (!isRecord(value) || value.kind !== 'release-lab') return false;
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.baselineCandidateId !== 'string' ||
    !isRecord(value.defaults) ||
    typeof value.defaults.profileId !== 'string' ||
    typeof value.defaults.candidateId !== 'string' ||
    !Array.isArray(value.profiles) ||
    value.profiles.length === 0 ||
    !Array.isArray(value.candidates) ||
    value.candidates.length === 0
  ) {
    return false;
  }

  const profilesValid = value.profiles.every(
    (profile) =>
      isRecord(profile) &&
      typeof profile.id === 'string' &&
      typeof profile.label === 'string' &&
      typeof profile.detail === 'string' &&
      isFiniteNumber(profile.maxP95Ms) &&
      isFiniteNumber(profile.maxMemoryMb) &&
      isFiniteNumber(profile.minOverallScore) &&
      isFiniteNumber(profile.minWorstSliceScore),
  );
  if (!profilesValid) return false;

  const profileIds = value.profiles.map((profile) => profile.id);
  return value.candidates.every((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      typeof candidate.label !== 'string' ||
      typeof candidate.detail !== 'string' ||
      !isFiniteNumber(candidate.parametersM) ||
      !isFiniteNumber(candidate.artifactMb) ||
      !isFiniteNumber(candidate.overallScore) ||
      !isFiniteNumber(candidate.worstSliceScore) ||
      !isRecord(candidate.benchmarks)
    ) {
      return false;
    }
    const benchmarks = candidate.benchmarks;
    return profileIds.every((profileId) => isBenchmark(benchmarks[profileId]));
  });
}

function parseLabData(value: unknown): LabData | null {
  if (isSignalLabData(value)) return value;
  if (isReleaseLabData(value)) return value;
  return null;
}

export default function KnowledgeDistillationLearningLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load the learning lab (${response.status}).`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        const parsed = parseLabData(payload);
        if (!parsed) throw new Error('The learning-lab data contract is invalid.');
        setData(parsed);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Could not load the learning lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) {
    return (
      <div
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Knowledge distillation lab unavailable</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="not-prose my-7 h-80 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading knowledge distillation lab"
        role="status"
      />
    );
  }

  return data.kind === 'signal-lab' ? (
    <SignalLab data={data} />
  ) : (
    <ReleaseGateLab data={data} />
  );
}

function softmax(logits: number[], temperature: number) {
  const scaled = logits.map((logit) => logit / temperature);
  const maximum = Math.max(...scaled);
  const exponents = scaled.map((logit) => Math.exp(logit - maximum));
  const total = exponents.reduce((sum, value) => sum + value, 0);
  return exponents.map((value) => value / total);
}

function argMax(values: number[]) {
  return values.reduce(
    (bestIndex, value, index) => (value > values[bestIndex] ? index : bestIndex),
    0,
  );
}

function formatLoss(value: number) {
  return value.toFixed(3);
}

function SignalLab({ data }: { data: SignalLabData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [temperature, setTemperature] = useState(data.defaults.temperature);
  const [teacherWeightPercent, setTeacherWeightPercent] = useState(
    data.defaults.teacherWeightPercent,
  );

  const scenario =
    data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const result = useMemo(() => {
    const teacherProbabilities = softmax(scenario.teacherLogits, temperature);
    const studentSoftProbabilities = softmax(scenario.studentLogits, temperature);
    const studentHardProbabilities = softmax(scenario.studentLogits, 1);
    const epsilon = 1e-12;
    const softLoss =
      teacherProbabilities.reduce(
        (sum, probability, index) =>
          sum +
          probability *
            (Math.log(Math.max(probability, epsilon)) -
              Math.log(Math.max(studentSoftProbabilities[index], epsilon))),
        0,
      ) *
      temperature *
      temperature;
    const labelLoss = -Math.log(
      Math.max(studentHardProbabilities[scenario.groundTruthIndex], epsilon),
    );
    const teacherWeight = teacherWeightPercent / 100;
    const totalLoss = teacherWeight * softLoss + (1 - teacherWeight) * labelLoss;
    const entropy =
      -teacherProbabilities.reduce(
        (sum, probability) =>
          sum + probability * Math.log(Math.max(probability, epsilon)),
        0,
      ) / Math.log(teacherProbabilities.length);
    const teacherTopIndex = argMax(teacherProbabilities);
    const disagrees = teacherTopIndex !== scenario.groundTruthIndex;

    let consequence: string;
    if (disagrees && teacherWeightPercent >= 70) {
      consequence =
        'The teacher disagrees with the label and dominates this objective. The student receives a strong signal toward the teacher error.';
    } else if (disagrees) {
      consequence =
        'The teacher disagrees with the label, but the label loss still counters that error. Evaluate this disagreement slice explicitly.';
    } else if (temperature <= 1.5) {
      consequence =
        'The teacher signal is sharp. It reveals less about lower-ranked alternatives and behaves more like a hard target.';
    } else if (temperature >= 6) {
      consequence =
        'The teacher signal is diffuse. More alternatives are visible, but class contrast is weaker.';
    } else {
      consequence =
        'The teacher and label agree, while the softened distribution still exposes relative class preferences.';
    }

    return {
      consequence,
      disagrees,
      entropy,
      labelLoss,
      softLoss,
      studentSoftProbabilities,
      teacherProbabilities,
      teacherTopIndex,
      totalLoss,
    };
  }, [scenario, teacherWeightPercent, temperature]);

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setTemperature(data.defaults.temperature);
    setTeacherWeightPercent(data.defaults.teacherWeightPercent);
  };

  return (
    <div data-content-block={SIGNAL_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Soft-target microscope"
          title={data.title}
          description={data.description}
          icon={BrainCircuit}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose an example
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'teacher-disagrees' ? TriangleAlert : BarChart3}
                      accent={item.id === 'teacher-disagrees' ? 'rose' : 'cyan'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-6">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Shape the objective
                </legend>
                <LabRange
                  label="Temperature"
                  value={temperature}
                  output={`T = ${temperature.toFixed(1)}`}
                  min={1}
                  max={8}
                  step={0.5}
                  accent="violet"
                  lowLabel="Sharper"
                  highLabel="Softer"
                  onChange={setTemperature}
                />
                <LabRange
                  label="Teacher signal weight"
                  value={teacherWeightPercent}
                  output={`${teacherWeightPercent}%`}
                  min={0}
                  max={100}
                  step={5}
                  accent="amber"
                  lowLabel="Labels dominate"
                  highLabel="Teacher dominates"
                  onChange={setTeacherWeightPercent}
                />
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                result.disagrees
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
              }`}
            >
              <p className="text-xs font-semibold uppercase opacity-75">Visible consequence</p>
              <p className="mt-2 text-sm leading-6">{result.consequence}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Teacher top class"
                value={data.classes[result.teacherTopIndex]}
                detail={`Ground truth: ${data.classes[scenario.groundTruthIndex]}`}
                icon={BadgeCheck}
                tone={result.disagrees ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Signal spread"
                value={`${Math.round(result.entropy * 100)}%`}
                detail="Normalized teacher entropy for these logits"
                icon={BarChart3}
                tone="cyan"
              />
              <LabMetric
                label="Soft loss"
                value={formatLoss(result.softLoss)}
                detail="KL divergence multiplied by T squared"
                icon={Scale}
                tone="violet"
              />
              <LabMetric
                label="Blended loss"
                value={formatLoss(result.totalLoss)}
                detail={`Label loss: ${formatLoss(result.labelLoss)}`}
                icon={Gauge}
                tone="amber"
              />
            </div>

            <DistributionComparison
              classes={data.classes}
              groundTruthIndex={scenario.groundTruthIndex}
              teacher={result.teacherProbabilities}
              student={result.studentSoftProbabilities}
            />

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              These values are a sensitivity analysis for one fixed pair of logit vectors.
              Only a training run and untouched evaluation set can establish student quality.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function DistributionComparison({
  classes,
  groundTruthIndex,
  teacher,
  student,
}: {
  classes: string[];
  groundTruthIndex: number;
  teacher: number[];
  student: number[];
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-cyan-500" aria-hidden="true" />
          Teacher
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 bg-violet-500" aria-hidden="true" />
          Student
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {classes.map((label, index) => (
          <div key={label} className="grid min-w-0 gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-100">
              <span className="truncate">{label}</span>
              {index === groundTruthIndex ? (
                <span className="shrink-0 rounded-sm bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100">
                  label
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <ProbabilityBar probability={teacher[index]} tone="teacher" />
              <ProbabilityBar probability={student[index]} tone="student" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProbabilityBar({
  probability,
  tone,
}: {
  probability: number;
  tone: 'teacher' | 'student';
}) {
  const percentage = probability * 100;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
        <div
          className={tone === 'teacher' ? 'h-full bg-cyan-500' : 'h-full bg-violet-500'}
          style={{ width: `${Math.max(1, percentage)}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

function ReleaseGateLab({ data }: { data: ReleaseLabData }) {
  const [profileId, setProfileId] = useState(data.defaults.profileId);
  const [candidateId, setCandidateId] = useState(data.defaults.candidateId);
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];
  const candidate =
    data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];
  const baseline =
    data.candidates.find((item) => item.id === data.baselineCandidateId) ??
    data.candidates[0];
  const benchmark = candidate.benchmarks[profile.id];
  const compressionRatio = baseline.parametersM / candidate.parametersM;

  const gates = [
    {
      id: 'overall',
      label: 'Overall quality',
      measured: `${candidate.overallScore.toFixed(1)}%`,
      required: `at least ${profile.minOverallScore.toFixed(1)}%`,
      pass: candidate.overallScore >= profile.minOverallScore,
    },
    {
      id: 'slice',
      label: 'Worst required slice',
      measured: `${candidate.worstSliceScore.toFixed(1)}%`,
      required: `at least ${profile.minWorstSliceScore.toFixed(1)}%`,
      pass: candidate.worstSliceScore >= profile.minWorstSliceScore,
    },
    {
      id: 'latency',
      label: 'Target-runtime p95',
      measured: `${benchmark.p95Ms.toFixed(1)} ms`,
      required: `at most ${profile.maxP95Ms} ms`,
      pass: benchmark.p95Ms <= profile.maxP95Ms,
    },
    {
      id: 'memory',
      label: 'Peak memory',
      measured: `${benchmark.peakMemoryMb} MB`,
      required: `at most ${profile.maxMemoryMb} MB`,
      pass: benchmark.peakMemoryMb <= profile.maxMemoryMb,
    },
  ];
  const failedGates = gates.filter((gate) => !gate.pass);
  const qualifies = failedGates.length === 0;

  const reset = () => {
    setProfileId(data.defaults.profileId);
    setCandidateId(data.defaults.candidateId);
  };

  return (
    <div data-content-block={RELEASE_BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Deployment evidence lab"
          title={data.title}
          description={data.description}
          icon={Server}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the target
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Cpu}
                      accent="blue"
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the candidate
                </legend>
                <div className="mt-3 space-y-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === candidate.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Boxes}
                      accent="violet"
                      onClick={() => setCandidateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          }
        >
          <div className="space-y-6">
            <div
              className={`rounded-md border p-5 ${
                qualifies
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
              }`}
              role="status"
            >
              <p className="text-xs font-semibold uppercase opacity-75">Promotion decision</p>
              <h4 className="mt-1 text-xl font-semibold">
                {qualifies ? 'Qualifies for a bounded canary' : 'Blocked by the release contract'}
              </h4>
              <p className="mt-2 text-sm leading-6 opacity-80">
                {qualifies
                  ? `${candidate.label} passes all four illustrative gates for ${profile.label}. Canary monitoring and rollback are still required.`
                  : `${candidate.label} fails ${failedGates.map((gate) => gate.label.toLowerCase()).join(', ')} for ${profile.label}. Smaller is not enough.`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Parameter ratio"
                value={
                  candidate.id === baseline.id
                    ? 'Baseline'
                    : `${compressionRatio.toFixed(1)}x smaller`
                }
                detail={`${candidate.parametersM}M versus ${baseline.parametersM}M parameters`}
                icon={Boxes}
                tone="violet"
              />
              <LabMetric
                label="Artifact"
                value={`${candidate.artifactMb} MB`}
                detail="Inventory size, not a latency estimate"
                icon={HardDrive}
                tone="blue"
              />
              <LabMetric
                label="p95 latency"
                value={`${benchmark.p95Ms.toFixed(1)} ms`}
                detail={`Gate: at most ${profile.maxP95Ms} ms`}
                icon={Gauge}
                tone={benchmark.p95Ms <= profile.maxP95Ms ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Peak memory"
                value={`${benchmark.peakMemoryMb} MB`}
                detail={`Gate: at most ${profile.maxMemoryMb} MB`}
                icon={Cpu}
                tone={benchmark.peakMemoryMb <= profile.maxMemoryMb ? 'cyan' : 'rose'}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {gates.map((gate) => (
                <div
                  key={gate.id}
                  className={`rounded-md border p-4 ${
                    gate.pass
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        gate.pass
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {gate.pass ? (
                        <Check aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <X aria-hidden="true" className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {gate.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                        Measured {gate.measured}; requires {gate.required}.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              The snapshot is intentionally illustrative. Real gates must use repeated,
              versioned measurements from the exact artifact, runtime, inputs, and target
              hardware.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
