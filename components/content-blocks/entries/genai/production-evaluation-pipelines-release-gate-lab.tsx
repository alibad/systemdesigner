'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  GitPullRequestArrow,
  Rocket,
  ShieldCheck,
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

type RolloutId = 'shadow' | 'canary-5' | 'canary-25' | 'full';
type Tone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

interface CandidateScenario {
  id: string;
  label: string;
  detail: string;
  baselineQuality: number;
  candidateQuality: number;
  criticalSliceLabel: string;
  criticalSliceShare: number;
  criticalSliceQuality: number;
  safetyFailureRate: number;
  judgeAgreement: number;
  latencyDeltaPct: number;
  costDeltaPct: number;
}

interface ReleaseGateData {
  title: string;
  description: string;
  defaults: {
    candidateId: string;
    sampleSize: number;
    regressionTolerancePct: number;
    rolloutId: RolloutId;
  };
  gates: {
    minCriticalSliceQuality: number;
    maxSafetyFailureUpperPct: number;
    minJudgeAgreement: number;
    maxLatencyIncreasePct: number;
    maxCostIncreasePct: number;
  };
  candidates: CandidateScenario[];
}

const BLOCK_ID = 'genai/production-evaluation-pipelines-release-gate-lab';

const rolloutOptions: Array<{ id: RolloutId; label: string; detail: string }> = [
  { id: 'shadow', label: 'Shadow only', detail: 'Observe outputs without user exposure.' },
  { id: 'canary-5', label: '5% canary', detail: 'Bound exposure while collecting live evidence.' },
  { id: 'canary-25', label: '25% canary', detail: 'Expand only after the first canary remains healthy.' },
  { id: 'full', label: '100% release', detail: 'Global exposure requires production evidence.' },
];

const rolloutRank: Record<RolloutId, number> = {
  shadow: 0,
  'canary-5': 1,
  'canary-25': 2,
  full: 3,
};

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ReleaseGateData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.gates
      && Array.isArray(candidate.candidates)
      && candidate.candidates.length > 0,
  );
}

function wilsonBounds(successes: number, total: number) {
  if (total <= 0) return { lower: 0, upper: 1 };
  const z = 1.96;
  const rate = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = rate + (z * z) / (2 * total);
  const spread = z * Math.sqrt((rate * (1 - rate)) / total + (z * z) / (4 * total * total));
  return {
    lower: Math.max(0, (center - spread) / denominator),
    upper: Math.min(1, (center + spread) / denominator),
  };
}

const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const signedPoints = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;

export default function ProductionEvaluationPipelinesReleaseGateLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No release-gate evidence model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseGateData(payload)) throw new Error('Release-gate evidence is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load release-gate evidence.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <ReleaseGateLab data={data} />;
}

function ReleaseGateLab({ data }: { data: ReleaseGateData }) {
  const [candidateId, setCandidateId] = useState(data.defaults.candidateId);
  const [sampleSize, setSampleSize] = useState(data.defaults.sampleSize);
  const [regressionTolerancePct, setRegressionTolerancePct] = useState(
    data.defaults.regressionTolerancePct,
  );
  const [rolloutId, setRolloutId] = useState<RolloutId>(data.defaults.rolloutId);

  const candidate = data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];

  const result = useMemo(() => {
    const baselineSuccesses = Math.round(candidate.baselineQuality * sampleSize);
    const candidateSuccesses = Math.round(candidate.candidateQuality * sampleSize);
    const baselineRate = baselineSuccesses / sampleSize;
    const candidateRate = candidateSuccesses / sampleSize;
    const standardError = Math.sqrt(
      (baselineRate * (1 - baselineRate)) / sampleSize
        + (candidateRate * (1 - candidateRate)) / sampleSize,
    );
    const conservativeDelta = candidateRate - baselineRate - 1.96 * standardError;
    const qualityPass = conservativeDelta >= -(regressionTolerancePct / 100);

    const sliceSize = Math.max(30, Math.round(sampleSize * candidate.criticalSliceShare));
    const sliceSuccesses = Math.round(sliceSize * candidate.criticalSliceQuality);
    const sliceLower = wilsonBounds(sliceSuccesses, sliceSize).lower;
    const slicePass = sliceLower >= data.gates.minCriticalSliceQuality;

    const safetyFailures = Math.round(sampleSize * candidate.safetyFailureRate);
    const safetyUpper = wilsonBounds(safetyFailures, sampleSize).upper;
    const safetyPass = safetyUpper <= data.gates.maxSafetyFailureUpperPct / 100;
    const judgePass = candidate.judgeAgreement >= data.gates.minJudgeAgreement;
    const latencyPass = candidate.latencyDeltaPct <= data.gates.maxLatencyIncreasePct;
    const costPass = candidate.costDeltaPct <= data.gates.maxCostIncreasePct;

    const blockers = [
      !qualityPass ? 'The conservative quality delta exceeds the allowed regression.' : null,
      !slicePass ? `${candidate.criticalSliceLabel} misses its quality floor.` : null,
      !safetyPass ? 'The safety-failure upper bound exceeds the hard limit.' : null,
      !judgePass ? 'Automated-judge agreement needs human calibration.' : null,
    ].filter((item): item is string => Boolean(item));

    const warnings = [
      !latencyPass ? `P95 latency rises ${candidate.latencyDeltaPct.toFixed(0)}%.` : null,
      !costPass ? `Cost per request rises ${candidate.costDeltaPct.toFixed(0)}%.` : null,
    ].filter((item): item is string => Boolean(item));

    const maxRollout: RolloutId | 'hold' = blockers.length > 0
      ? 'hold'
      : warnings.length > 0
        ? 'canary-5'
        : 'canary-25';
    const requestedAllowed = maxRollout !== 'hold' && rolloutRank[rolloutId] <= rolloutRank[maxRollout];
    const verdict = maxRollout === 'hold'
      ? 'Hold the candidate and repair the evidence'
      : requestedAllowed
        ? `Approve ${rolloutOptions.find((option) => option.id === rolloutId)?.label ?? 'bounded exposure'}`
        : `Reduce exposure to ${rolloutOptions.find((option) => option.id === maxRollout)?.label ?? 'a bounded canary'}`;

    return {
      blockers,
      candidateRate,
      conservativeDelta,
      costPass,
      judgePass,
      latencyPass,
      maxRollout,
      requestedAllowed,
      safetyFailures,
      safetyPass,
      safetyUpper,
      sliceLower,
      slicePass,
      sliceSize,
      verdict,
      warnings,
    };
  }, [candidate, data.gates, regressionTolerancePct, rolloutId, sampleSize]);

  const reset = () => {
    setCandidateId(data.defaults.candidateId);
    setSampleSize(data.defaults.sampleSize);
    setRegressionTolerancePct(data.defaults.regressionTolerancePct);
    setRolloutId(data.defaults.rolloutId);
  };

  const outcomeTone: Tone = result.maxRollout === 'hold'
    ? 'rose'
    : result.requestedAllowed
      ? 'emerald'
      : 'amber';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Release evidence lab"
          title={data.title}
          description={data.description}
          icon={GitPullRequestArrow}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Candidate evidence
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.candidates.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={candidate.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={ClipboardCheck}
                      accent={item.id === data.defaults.candidateId ? 'emerald' : 'amber'}
                      onClick={() => setCandidateId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Independent evaluation cases"
                value={sampleSize}
                output={sampleSize.toLocaleString()}
                min={100}
                max={4_000}
                step={100}
                accent="blue"
                lowLabel="Wide uncertainty"
                highLabel="Narrower uncertainty"
                onChange={setSampleSize}
              />

              <LabRange
                label="Allowed quality regression"
                value={regressionTolerancePct}
                output={`${regressionTolerancePct.toFixed(1)} pp`}
                min={0}
                max={5}
                step={0.5}
                accent="amber"
                lowLabel="No regression"
                highLabel="More permissive"
                onChange={setRegressionTolerancePct}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Requested exposure
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {rolloutOptions.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={rolloutId === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={Rocket}
                      accent={option.id === 'full' ? 'rose' : 'violet'}
                      onClick={() => setRolloutId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-h-[620px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Conservative quality delta"
                value={signedPoints(result.conservativeDelta)}
                detail={`Point estimate: ${percent(result.candidateRate)}`}
                icon={Gauge}
                tone={result.conservativeDelta >= -(regressionTolerancePct / 100) ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Safety failure upper bound"
                value={percent(result.safetyUpper, 2)}
                detail={`${result.safetyFailures} observed; limit ${data.gates.maxSafetyFailureUpperPct.toFixed(1)}%`}
                icon={ShieldCheck}
                tone={result.safetyPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label={`${candidate.criticalSliceLabel} lower bound`}
                value={percent(result.sliceLower)}
                detail={`${result.sliceSize} cases; floor ${percent(data.gates.minCriticalSliceQuality)}`}
                icon={Users}
                tone={result.slicePass ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Judge-human agreement"
                value={percent(candidate.judgeAgreement)}
                detail={`Required: ${percent(data.gates.minJudgeAgreement)}`}
                icon={Activity}
                tone={result.judgePass ? 'violet' : 'amber'}
              />
            </div>

            <section>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Evidence path
              </p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <GateStage
                  number={1}
                  label="Freeze identities"
                  detail="Candidate, baseline, test set, rubric, and judge versions are attached to one run."
                  state="complete"
                />
                <GateStage
                  number={2}
                  label="Quantify uncertainty"
                  detail={`${sampleSize.toLocaleString()} cases produce a ${signedPoints(result.conservativeDelta)} conservative quality delta.`}
                  state={result.conservativeDelta >= -(regressionTolerancePct / 100) ? 'complete' : 'blocked'}
                />
                <GateStage
                  number={3}
                  label="Protect hard slices"
                  detail={result.slicePass && result.safetyPass && result.judgePass
                    ? 'Critical slice, safety, and judge calibration gates pass.'
                    : 'At least one hard evidence gate fails.'}
                  state={result.slicePass && result.safetyPass && result.judgePass ? 'complete' : 'blocked'}
                />
                <GateStage
                  number={4}
                  label="Bound exposure"
                  detail={result.maxRollout === 'hold'
                    ? 'No production exposure is justified.'
                    : `Offline evidence permits at most ${rolloutOptions.find((option) => option.id === result.maxRollout)?.label}.`}
                  state={result.maxRollout === 'hold' ? 'blocked' : result.requestedAllowed ? 'complete' : 'warning'}
                />
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${outcomeClasses[outcomeTone]}`}>
              <div className="flex items-start gap-3">
                {outcomeTone === 'emerald'
                  ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Gate decision</p>
                  <p className="mt-1 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    Offline evidence can authorize a bounded experiment, not an unmonitored global release.
                  </p>
                </div>
              </div>
              {result.blockers.length > 0 || result.warnings.length > 0 ? (
                <ul className="mt-4 grid gap-2 text-sm leading-6 md:grid-cols-2">
                  {[...result.blockers, ...result.warnings].map((item) => (
                    <li key={item} className="rounded-md border border-current/20 bg-white/40 px-3 py-2 dark:bg-black/10">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function GateStage({
  number,
  label,
  detail,
  state,
}: {
  number: number;
  label: string;
  detail: string;
  state: 'complete' | 'warning' | 'blocked';
}) {
  const classes = {
    complete: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    blocked: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  };

  return (
    <li className={`min-w-0 rounded-md border p-4 ${classes[state]}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-75">
        <span>Stage {number}</span>
        <span>{state}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </li>
  );
}

const outcomeClasses: Record<Tone, string> = {
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
  violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
};

function LabLoading() {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="min-h-[720px] rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Loading release evidence lab"
    />
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div
      data-content-block={BLOCK_ID}
      className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      role="alert"
    >
      <p className="font-semibold">Release evidence lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}
