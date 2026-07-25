'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ListChecks,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'ml-systems/training-data-management-release-gate-lab';
const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/training-data-management/data/release-gate-lab.json';

type Accent = 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose';
type GateDirection = 'maximum' | 'minimum';
type GateSeverity = 'quarantine' | 'block';
type GateUnit = 'percent' | 'count';
type QualityGate = {
  id: string;
  label: string;
  detail: string;
  direction: GateDirection;
  severity: GateSeverity;
  unit: GateUnit;
  threshold: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  contributesToReviewQueue: boolean;
  accent: Accent;
};
type ReleaseGateData = {
  title: string;
  description: string;
  rowCount: number;
  gates: QualityGate[];
};

type ReleaseDecision = 'pass' | 'quarantine' | 'block';

function isReleaseGateData(value: unknown): value is ReleaseGateData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseGateData>;
  const accents: Accent[] = ['cyan', 'violet', 'emerald', 'amber', 'rose'];

  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      typeof data.rowCount === 'number' &&
      data.rowCount > 0 &&
      Array.isArray(data.gates) &&
      data.gates.length >= 4 &&
      data.gates.every(
        (gate) =>
          gate &&
          typeof gate.id === 'string' &&
          typeof gate.label === 'string' &&
          typeof gate.detail === 'string' &&
          ['maximum', 'minimum'].includes(gate.direction) &&
          ['quarantine', 'block'].includes(gate.severity) &&
          ['percent', 'count'].includes(gate.unit) &&
          typeof gate.threshold === 'number' &&
          typeof gate.min === 'number' &&
          typeof gate.max === 'number' &&
          typeof gate.step === 'number' &&
          typeof gate.defaultValue === 'number' &&
          typeof gate.contributesToReviewQueue === 'boolean' &&
          accents.includes(gate.accent),
      ),
  );
}

function formatGateValue(value: number, unit: GateUnit) {
  return unit === 'percent' ? `${value.toFixed(value % 1 === 0 ? 0 : 1)}%` : value.toFixed(0);
}

function decisionStyle(decision: ReleaseDecision) {
  if (decision === 'pass') {
    return {
      box: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
      icon: 'text-emerald-700 dark:text-emerald-300',
      label: 'Pass',
    };
  }
  if (decision === 'block') {
    return {
      box: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
      icon: 'text-rose-700 dark:text-rose-300',
      label: 'Block',
    };
  }
  return {
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    icon: 'text-amber-700 dark:text-amber-300',
    label: 'Quarantine',
  };
}

export default function TrainingDataManagementReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ReleaseGateData | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load release gate data (${response.status}).`);
        }
        return response.json();
      })
      .then((value: unknown) => {
        if (!isReleaseGateData(value)) {
          throw new Error('The release gate data does not match the expected contract.');
        }
        setData(value);
        setValues(
          Object.fromEntries(value.gates.map((gate) => [gate.id, gate.defaultValue])),
        );
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(
            fetchError instanceof Error ? fetchError.message : 'Could not load release gate data.',
          );
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data) return null;

    const results = data.gates.map((gate) => {
      const value = values[gate.id] ?? gate.defaultValue;
      const passed =
        gate.direction === 'maximum' ? value <= gate.threshold : value >= gate.threshold;
      return { gate, value, passed };
    });
    const failed = results.filter((result) => !result.passed);
    const decision: ReleaseDecision = failed.some(
      ({ gate }) => gate.severity === 'block',
    )
      ? 'block'
      : failed.length > 0
        ? 'quarantine'
        : 'pass';
    const reviewRows = Math.min(
      data.rowCount,
      Math.ceil(
        results.reduce((total, { gate, value }) => {
          if (!gate.contributesToReviewQueue) return total;
          return total + (gate.unit === 'percent' ? (value / 100) * data.rowCount : value);
        }, 0),
      ),
    );

    return {
      results,
      failed,
      decision,
      reviewRows,
      passedCount: results.length - failed.length,
    };
  }, [data, values]);

  const reset = () => {
    if (!data) return;
    setValues(Object.fromEntries(data.gates.map((gate) => [gate.id, gate.defaultValue])));
  };

  if (error) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || !model) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading training data release gate lab"
      />
    );
  }

  const status = decisionStyle(model.decision);
  const StatusIcon =
    model.decision === 'pass' ? CheckCircle2 : model.decision === 'block' ? Ban : TriangleAlert;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Candidate release lab"
          title={data.title}
          description={data.description}
          icon={ClipboardCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <fieldset className="space-y-6">
              <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Candidate measurements
              </legend>
              {data.gates.map((gate) => {
                const value = values[gate.id] ?? gate.defaultValue;
                return (
                  <LabRange
                    key={gate.id}
                    label={gate.label}
                    value={value}
                    output={formatGateValue(value, gate.unit)}
                    min={gate.min}
                    max={gate.max}
                    step={gate.step}
                    accent={gate.accent}
                    lowLabel={formatGateValue(gate.min, gate.unit)}
                    highLabel={formatGateValue(gate.max, gate.unit)}
                    onChange={(nextValue) =>
                      setValues((current) => ({ ...current, [gate.id]: nextValue }))
                    }
                  />
                );
              })}
            </fieldset>
          }
        >
          <div aria-live="polite" className={`rounded-md border p-4 ${status.box}`}>
            <div className="flex items-start gap-3">
              <StatusIcon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${status.icon}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Decision: {status.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {model.decision === 'pass'
                    ? 'Every measured contract passes. The candidate can proceed to model-level evaluation.'
                    : model.decision === 'quarantine'
                      ? 'Keep the candidate isolated while repairable quality failures are investigated or corrected.'
                      : 'A critical slice or restricted-record failure prevents release, even when aggregate checks pass.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Gates passed"
              value={`${model.passedCount}/${model.results.length}`}
              detail="Each gate is evaluated independently"
              icon={ListChecks}
              tone={model.decision === 'pass' ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Review queue"
              value={model.reviewRows.toLocaleString()}
              detail="Upper bound before issue overlap"
              icon={Database}
              tone={model.reviewRows === 0 ? 'emerald' : 'violet'}
            />
            <LabMetric
              label="Release state"
              value={status.label}
              detail={`${data.rowCount.toLocaleString()} candidate rows`}
              icon={ShieldAlert}
              tone={
                model.decision === 'pass'
                  ? 'emerald'
                  : model.decision === 'block'
                    ? 'rose'
                    : 'amber'
              }
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Contract evaluation
              </p>
            </div>
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {model.results.map(({ gate, value, passed }) => (
                <li key={gate.id} className="flex items-start gap-3 px-4 py-4">
                  {passed ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                  ) : (
                    <TriangleAlert
                      aria-hidden="true"
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        gate.severity === 'block'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {gate.label}
                      </p>
                      <p className="shrink-0 text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
                        {formatGateValue(value, gate.unit)} /{' '}
                        {gate.direction === 'maximum' ? 'max' : 'min'}{' '}
                        {formatGateValue(gate.threshold, gate.unit)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                      {gate.detail}
                    </p>
                    {!passed ? (
                      <p className="mt-1 text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
                        Action: {gate.severity}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Passing these data checks does not prove that a model is useful or fair. It only establishes
            that this candidate meets its declared data contract and is ready for downstream evaluation.
          </p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
