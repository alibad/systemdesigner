'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
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

type ScenarioId = 'representative' | 'night' | 'preprocessing';
type StageId = 'shadow' | 'canary' | 'expand';

const scenarios: Record<ScenarioId, {
  label: string;
  detail: string;
  mapDelta: number;
  sliceRecallDelta: number;
  calibrationError: number;
  driftPsi: number;
  latencyMs: number;
}> = {
  representative: {
    label: 'Representative holdout',
    detail: 'The candidate sees the same camera mix, lighting, and preprocessing contract as its training data.',
    mapDelta: 1.8,
    sliceRecallDelta: 0.4,
    calibrationError: 0.6,
    driftPsi: 0.08,
    latencyMs: 98,
  },
  night: {
    label: 'Night-camera shift',
    detail: 'Low light and motion blur are overrepresented. Aggregate quality improves, but the night slice is less reliable.',
    mapDelta: 0.7,
    sliceRecallDelta: -4.8,
    calibrationError: 2.4,
    driftPsi: 0.29,
    latencyMs: 101,
  },
  preprocessing: {
    label: 'Preprocessing mismatch',
    detail: 'A resize and color-space change reached serving without the training transform. Both quality and calibration are untrusted.',
    mapDelta: -1.4,
    sliceRecallDelta: -7.0,
    calibrationError: 4.1,
    driftPsi: 0.38,
    latencyMs: 128,
  },
};

const stages: Record<StageId, { label: string; detail: string; percentage: number }> = {
  shadow: { label: 'Shadow', detail: 'Score live traffic without changing a returned prediction.', percentage: 0 },
  canary: { label: '5% canary', detail: 'Expose a stable, bounded cohort with automatic rollback.', percentage: 5 },
  expand: { label: '25% expansion', detail: 'Only allowed after a clean 5% canary window.', percentage: 25 },
};

const scenarioIds = Object.keys(scenarios) as ScenarioId[];
const stageIds = Object.keys(stages) as StageId[];

function signedPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} pts`;
}

export default function ComputerVisionEvaluationReleaseGateLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('representative');
  const [threshold, setThreshold] = useState(55);
  const [stageId, setStageId] = useState<StageId>('canary');

  const model = useMemo(() => {
    const scenario = scenarios[scenarioId];
    const thresholdOffset = threshold - 55;
    const sliceRecallDelta = scenario.sliceRecallDelta - thresholdOffset * 0.14;
    const falseAlertRate = Math.max(1.2, 7.0 - thresholdOffset * 0.11 + (scenarioId === 'night' ? 1.1 : 0));
    const qualityPass = scenario.mapDelta >= 0 && sliceRecallDelta >= -2;
    const calibrationPass = scenario.calibrationError <= 1.5;
    const driftPass = scenario.driftPsi <= 0.2;
    const latencyPass = scenario.latencyMs <= 120;
    const evidencePass = qualityPass && calibrationPass && driftPass && latencyPass;
    const stage = stages[stageId];
    const stagePass = stage.percentage <= 5 || stageId === 'shadow';
    const decision = !evidencePass
      ? 'Hold and investigate'
      : !stagePass
        ? 'Stop at the 5% canary'
        : stageId === 'shadow'
          ? 'Shadow comparison allowed'
          : 'Canary release allowed';

    return {
      scenario,
      sliceRecallDelta,
      falseAlertRate,
      qualityPass,
      calibrationPass,
      driftPass,
      latencyPass,
      evidencePass,
      stagePass,
      decision,
    };
  }, [scenarioId, stageId, threshold]);

  const reset = () => {
    setScenarioId('representative');
    setThreshold(55);
    setStageId('canary');
  };

  const gates = [
    { label: 'Aggregate and slice quality', pass: model.qualityPass, detail: `mAP ${signedPercent(model.scenario.mapDelta)}; critical-slice recall ${signedPercent(model.sliceRecallDelta)} (floor: -2.0 pts).` },
    { label: 'Calibration', pass: model.calibrationPass, detail: `Expected calibration error is ${model.scenario.calibrationError.toFixed(1)}% (maximum: 1.5%).` },
    { label: 'Input drift', pass: model.driftPass, detail: `Population stability index is ${model.scenario.driftPsi.toFixed(2)} (maximum: 0.20).` },
    { label: 'Serving latency', pass: model.latencyPass, detail: `Replay p95 is ${model.scenario.latencyMs} ms (maximum: 120 ms).` },
  ];

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evaluation, drift, and release gate lab"
        title="Make a release decision from more than average accuracy"
        description="Change the evaluation condition, operating threshold, and proposed rollout stage. A candidate must clear slice quality, calibration, drift, and latency gates before it can affect a camera feed."
        icon={ShieldCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Evaluation condition</legend>
              <div className="mt-3 space-y-2">
                {scenarioIds.map((id) => (
                  <LabChoice
                    key={id}
                    selected={scenarioId === id}
                    label={scenarios[id].label}
                    detail={scenarios[id].detail}
                    icon={Eye}
                    accent={id === 'representative' ? 'emerald' : id === 'night' ? 'amber' : 'rose'}
                    onClick={() => setScenarioId(id)}
                  />
                ))}
              </div>
            </fieldset>
            <LabRange
              label="Detection confidence threshold"
              value={threshold}
              output={`${threshold}%`}
              min={40}
              max={75}
              accent="violet"
              lowLabel="More recall"
              highLabel="Fewer alerts"
              onChange={setThreshold}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Proposed rollout stage</legend>
              <div className="mt-3 space-y-2">
                {stageIds.map((id) => (
                  <LabChoice
                    key={id}
                    selected={stageId === id}
                    label={stages[id].label}
                    detail={stages[id].detail}
                    icon={id === 'shadow' ? Activity : id === 'canary' ? ShieldCheck : SlidersHorizontal}
                    accent={id === 'shadow' ? 'blue' : id === 'canary' ? 'emerald' : 'amber'}
                    onClick={() => setStageId(id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric label="mAP versus production" value={signedPercent(model.scenario.mapDelta)} detail="Aggregate quality is necessary, not sufficient." icon={Activity} tone={model.scenario.mapDelta >= 0 ? 'emerald' : 'rose'} />
          <LabMetric label="Critical-slice recall" value={signedPercent(model.sliceRecallDelta)} detail="No worse than -2.0 pts." icon={Eye} tone={model.qualityPass ? 'violet' : 'rose'} />
          <LabMetric label="Input drift PSI" value={model.scenario.driftPsi.toFixed(2)} detail="Maximum allowed: 0.20." icon={SlidersHorizontal} tone={model.driftPass ? 'cyan' : 'rose'} />
          <LabMetric label="Replay p95" value={`${model.scenario.latencyMs} ms`} detail="Maximum allowed: 120 ms." icon={Clock3} tone={model.latencyPass ? 'blue' : 'rose'} />
        </div>

        <div className={`mt-5 rounded-md border p-4 ${model.evidencePass && model.stagePass
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'}`}
        >
          <div className="flex items-start gap-3">
            {model.evidencePass && model.stagePass ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-semibold">{model.decision}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                At a {threshold}% threshold, the modeled false-alert rate is {model.falseAlertRate.toFixed(1)}%. Changing a threshold can trade alerts for recall; it cannot repair a preprocessing mismatch or conceal a failing night-camera slice.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {gates.map((gate) => (
            <div key={gate.label} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                {gate.pass ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-300" />}
                {gate.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{gate.detail}</p>
            </div>
          ))}
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
