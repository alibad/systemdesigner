'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  ShieldCheck,
  TrafficCone,
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
  '/api/content/ml-systems/model-evaluation/data/promotion-gate-model.json';

type Candidate = {
  id: string;
  label: string;
  detail: string;
  qualityLiftPercent: number;
  criticalSliceDeltaPercent: number;
  latencyDeltaPercent: number;
  errorRateDeltaPercent: number;
};

type RolloutMode = {
  id: string;
  label: string;
  detail: string;
  authority: number;
  reversibility: number;
};

type LabData = {
  title: string;
  description: string;
  candidates: Candidate[];
  rolloutModes: RolloutMode[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.candidates) &&
      data.candidates.length > 0 &&
      Array.isArray(data.rolloutModes) &&
      data.rolloutModes.length > 0,
  );
}

export default function ModelEvaluationPromotionGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState('balanced');
  const [rolloutId, setRolloutId] = useState('shadow');
  const [trafficPercent, setTrafficPercent] = useState(5);
  const [samplesPerArm, setSamplesPerArm] = useState(8000);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load promotion model (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('Promotion data does not match the expected contract.');
        setData(value);
        setCandidateId(value.candidates[0].id);
        setRolloutId(value.rolloutModes[0].id);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load promotion data.');
        }
      });
    return () => controller.abort();
  }, [dataFile]);

  const result = useMemo(() => {
    if (!data) return null;
    const candidate = data.candidates.find((item) => item.id === candidateId) ?? data.candidates[0];
    const rollout = data.rolloutModes.find((item) => item.id === rolloutId) ?? data.rolloutModes[0];
    const evidencePower = Math.min(99, 35 + Math.log10(Math.max(100, samplesPerArm)) * 12);
    const qualityPass = candidate.qualityLiftPercent >= 1;
    const slicePass = candidate.criticalSliceDeltaPercent >= -1;
    const latencyPass = candidate.latencyDeltaPercent <= 20;
    const reliabilityPass = candidate.errorRateDeltaPercent <= 0.5;
    const guardrailsPass = slicePass && latencyPass && reliabilityPass;
    const evidencePass = evidencePower >= 80;
    const exposureRisk = (rollout.authority * trafficPercent) / 100;
    const fullAuthorityMismatch = rollout.id === 'full' && trafficPercent < 100;
    const passes = qualityPass && guardrailsPass && evidencePass && !fullAuthorityMismatch;
    const status = !guardrailsPass
      ? rollout.id === 'shadow'
        ? 'Keep observing'
        : 'Rollback or contain'
      : !evidencePass
        ? 'Collect more evidence'
        : fullAuthorityMismatch
          ? 'Fix rollout contract'
          : passes
            ? rollout.id === 'shadow'
              ? 'Ready for a limited canary'
              : 'Gate passes'
            : 'Hold promotion';
    const nextStep = !slicePass
      ? 'Investigate the critical slice before exposing users. Aggregate quality cannot cancel a subgroup regression.'
      : !latencyPass
        ? 'Reduce serving cost or reserve more latency budget before promotion.'
        : !reliabilityPass
          ? 'Explain the error-rate regression and add an automatic rollback trigger.'
          : !evidencePass
            ? 'Keep cohorts stable and collect more independent outcomes before declaring a winner.'
            : fullAuthorityMismatch
              ? 'Full rollout means full eligible traffic. Use canary or experiment mode for partial exposure.'
              : rollout.id === 'shadow'
                ? 'The offline and shadow evidence supports a reversible canary with explicit stop conditions.'
                : 'The modeled gate passes. Continue monitoring the same slices and guardrails after promotion.';
    return {
      candidate,
      rollout,
      evidencePower,
      qualityPass,
      slicePass,
      latencyPass,
      reliabilityPass,
      guardrailsPass,
      exposureRisk,
      passes,
      status,
      nextStep,
    };
  }, [candidateId, data, rolloutId, samplesPerArm, trafficPercent]);

  const reset = () => {
    if (!data) return;
    setCandidateId(data.candidates[0].id);
    setRolloutId(data.rolloutModes[0].id);
    setTrafficPercent(5);
    setSamplesPerArm(8000);
  };

  if (error) {
    return (
      <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
        {error}
      </p>
    );
  }

  if (!data || !result) {
    return (
      <div
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading model promotion lab"
      />
    );
  }

  const warning = !result.guardrailsPass || !result.passes;

  return (
    <div data-content-block="ml-systems/model-evaluation-promotion-gate-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence and authority lab"
          title={data.title}
          description={data.description}
          icon={GitCompareArrows}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Compare a candidate
                </legend>
                <div className="mt-3 space-y-2">
                  {data.candidates.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === result.candidate.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={FlaskConical}
                      accent="violet"
                      onClick={() => setCandidateId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Grant limited authority
                </legend>
                <div className="mt-3 space-y-2">
                  {data.rolloutModes.map((rollout) => (
                    <LabChoice
                      key={rollout.id}
                      selected={rollout.id === result.rollout.id}
                      label={rollout.label}
                      detail={rollout.detail}
                      icon={TrafficCone}
                      accent="cyan"
                      onClick={() => setRolloutId(rollout.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Set exposure and evidence
                </legend>
                <LabRange
                  label="Eligible traffic exposed"
                  value={trafficPercent}
                  output={`${trafficPercent}%`}
                  min={1}
                  max={100}
                  accent="rose"
                  lowLabel="Small blast radius"
                  highLabel="Full blast radius"
                  onChange={setTrafficPercent}
                />
                <LabRange
                  label="Outcomes per experiment arm"
                  value={samplesPerArm}
                  output={samplesPerArm.toLocaleString()}
                  min={500}
                  max={50000}
                  step={500}
                  accent="emerald"
                  lowLabel="Wide uncertainty"
                  highLabel="Narrower uncertainty"
                  onChange={setSamplesPerArm}
                />
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Promotion decision
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.candidate.label} in {result.rollout.label.toLowerCase()} mode
                </h4>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  warning
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                }`}
              >
                {warning ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
                {result.status}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <LabMetric label="Primary quality lift" value={`${result.candidate.qualityLiftPercent > 0 ? '+' : ''}${result.candidate.qualityLiftPercent.toFixed(1)}%`} detail={result.qualityPass ? 'Primary metric clears the modeled floor' : 'Primary metric does not clear the floor'} icon={Activity} tone={result.qualityPass ? 'emerald' : 'rose'} />
              <LabMetric label="Critical-slice delta" value={`${result.candidate.criticalSliceDeltaPercent > 0 ? '+' : ''}${result.candidate.criticalSliceDeltaPercent.toFixed(1)}%`} detail="Must remain above the -1% guardrail" icon={ShieldCheck} tone={result.slicePass ? 'cyan' : 'rose'} />
              <LabMetric label="Latency delta" value={`+${result.candidate.latencyDeltaPercent}%`} detail="Modeled guardrail allows at most +20%" icon={Gauge} tone={result.latencyPass ? 'blue' : 'rose'} />
              <LabMetric label="Error-rate delta" value={`${result.candidate.errorRateDeltaPercent > 0 ? '+' : ''}${result.candidate.errorRateDeltaPercent.toFixed(1)}%`} detail="Reliability must not regress by more than 0.5%" icon={AlertTriangle} tone={result.reliabilityPass ? 'emerald' : 'rose'} />
              <LabMetric label="Evidence power" value={`${result.evidencePower.toFixed(0)}%`} detail={`${samplesPerArm.toLocaleString()} outcomes per comparison arm`} icon={FlaskConical} tone={result.evidencePower >= 80 ? 'violet' : 'amber'} />
              <LabMetric label="Exposure risk" value={`${result.exposureRisk.toFixed(0)} / 100`} detail={`${result.rollout.reversibility}% modeled reversibility`} icon={TrafficCone} tone={result.exposureRisk > 50 ? 'rose' : 'amber'} />
            </div>
            <div className={`mt-6 rounded-md border p-4 ${warning ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'}`}>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">Recommended next action</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.nextStep}</p>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
