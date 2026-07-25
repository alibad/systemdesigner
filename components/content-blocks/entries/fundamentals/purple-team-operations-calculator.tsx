'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Eye,
  Radar,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/purple-team-operations-calculator';
const DEFAULTS = {
  executed: 12,
  observed: 10,
  alerted: 8,
  investigated: 6,
  retested: 4,
};

export default function PurpleTeamOperationsCalculator() {
  const [executed, setExecuted] = useState(DEFAULTS.executed);
  const [observed, setObserved] = useState(DEFAULTS.observed);
  const [alerted, setAlerted] = useState(DEFAULTS.alerted);
  const [investigated, setInvestigated] = useState(DEFAULTS.investigated);
  const [retested, setRetested] = useState(DEFAULTS.retested);

  const funnel = useMemo(() => {
    const telemetryCoverage = observed / executed;
    const detectionCoverage = alerted / executed;
    const investigationCoverage = investigated / executed;
    const closedLoopCoverage = retested / executed;
    const largestGap = [
      { label: 'telemetry', count: executed - observed },
      { label: 'analytics', count: observed - alerted },
      { label: 'triage', count: alerted - investigated },
      { label: 'verified improvement', count: investigated - retested },
    ].sort((left, right) => right.count - left.count)[0];

    return {
      telemetryCoverage,
      detectionCoverage,
      investigationCoverage,
      closedLoopCoverage,
      largestGap,
    };
  }, [alerted, executed, investigated, observed, retested]);

  function updateExecuted(value: number) {
    setExecuted(value);
    setObserved((current) => Math.min(current, value));
    setAlerted((current) => Math.min(current, value));
    setInvestigated((current) => Math.min(current, value));
    setRetested((current) => Math.min(current, value));
  }

  function updateObserved(value: number) {
    setObserved(value);
    setAlerted((current) => Math.min(current, value));
    setInvestigated((current) => Math.min(current, value));
    setRetested((current) => Math.min(current, value));
  }

  function updateAlerted(value: number) {
    setAlerted(value);
    setInvestigated((current) => Math.min(current, value));
    setRetested((current) => Math.min(current, value));
  }

  function updateInvestigated(value: number) {
    setInvestigated(value);
    setRetested((current) => Math.min(current, value));
  }

  function reset() {
    setExecuted(DEFAULTS.executed);
    setObserved(DEFAULTS.observed);
    setAlerted(DEFAULTS.alerted);
    setInvestigated(DEFAULTS.investigated);
    setRetested(DEFAULTS.retested);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Detection evidence lab"
          title="Trace every technique through the defensive evidence funnel"
          description="Move the observed counts. The lab reports exact coverage at each boundary; it does not invent an overall security score."
          icon={Radar}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <LabRange
                label="Techniques executed"
                value={executed}
                output={`${executed}`}
                min={1}
                max={30}
                accent="violet"
                lowLabel="Focused test"
                highLabel="Broad exercise"
                onChange={updateExecuted}
              />
              <LabRange
                label="Telemetry observed"
                value={observed}
                output={`${observed} / ${executed}`}
                min={0}
                max={executed}
                accent="cyan"
                onChange={updateObserved}
              />
              <LabRange
                label="Analytics alerted"
                value={alerted}
                output={`${alerted} / ${observed}`}
                min={0}
                max={observed}
                accent="blue"
                onChange={updateAlerted}
              />
              <LabRange
                label="Cases investigated"
                value={investigated}
                output={`${investigated} / ${alerted}`}
                min={0}
                max={alerted}
                accent="amber"
                onChange={updateInvestigated}
              />
              <LabRange
                label="Changes retested"
                value={retested}
                output={`${retested} / ${investigated}`}
                min={0}
                max={investigated}
                accent="emerald"
                onChange={setRetested}
              />
            </div>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Telemetry coverage"
              value={formatPercent(funnel.telemetryCoverage)}
              detail={`${observed} techniques left usable evidence`}
              icon={Eye}
              tone="cyan"
            />
            <LabMetric
              label="Detection coverage"
              value={formatPercent(funnel.detectionCoverage)}
              detail={`${alerted} techniques reached an analytic`}
              icon={Activity}
              tone="blue"
            />
            <LabMetric
              label="Investigation coverage"
              value={formatPercent(funnel.investigationCoverage)}
              detail={`${investigated} techniques reached an analyst`}
              icon={Crosshair}
              tone="amber"
            />
            <LabMetric
              label="Closed-loop coverage"
              value={formatPercent(funnel.closedLoopCoverage)}
              detail={`${retested} changes were proved by replay`}
              icon={RotateCcw}
              tone="emerald"
            />
          </div>

          <div className="mt-6 space-y-3" aria-label="Evidence funnel">
            <FunnelStage label="Executed" value={executed} total={executed} tone="bg-violet-500" />
            <FunnelStage label="Observed" value={observed} total={executed} tone="bg-cyan-500" />
            <FunnelStage label="Alerted" value={alerted} total={executed} tone="bg-blue-500" />
            <FunnelStage label="Investigated" value={investigated} total={executed} tone="bg-amber-500" />
            <FunnelStage label="Retested" value={retested} total={executed} tone="bg-emerald-500" />
          </div>

          <div className={`mt-6 rounded-md border p-4 ${
            funnel.closedLoopCoverage === 1
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
          }`}>
            <div className="flex items-start gap-3">
              {funnel.closedLoopCoverage === 1 ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {funnel.closedLoopCoverage === 1
                    ? 'Every tested technique has verified defensive evidence.'
                    : `The largest open boundary is ${funnel.largestGap.label}: ${funnel.largestGap.count} technique${funnel.largestGap.count === 1 ? '' : 's'}.`}
                </p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  Coverage is each stage count divided by {executed} executed techniques. A detection is not improved until the changed control survives the same authorized replay.
                </p>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FunnelStage({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const width = total === 0 ? 0 : (value / total) * 100;

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <div className="h-3 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-800">
        <div className={`h-full ${tone} transition-[width] duration-300`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-right font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</span>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
